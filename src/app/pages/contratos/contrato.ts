import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ReaisPipe } from '../../shared/dinheiro';
import { mascaraTelefone, rotuloDaEspecie } from '../../shared/documentos';
import { abrirPdf } from '../../shared/pdf';
import { mensagemDeErro } from '../login/login';
import {
  Assinatura,
  Cobranca,
  Contrato as ContratoDados,
  ContratosService,
  DetalheDoContrato,
  Gateway,
  SituacaoDoContrato,
  Transicao,
  classeDaCobranca,
  classeDaSituacao,
} from './contratos.service';

/** Nome do botão para cada passagem do ciclo. Depende da situação de origem quando o destino é o mesmo. */
function rotuloDaAcao(destino: SituacaoDoContrato, atual: SituacaoDoContrato): string {
  switch (destino) {
    case 'AGUARDANDO_ASSINATURA':
      return 'Enviar para assinatura';
    case 'AGUARDANDO_PAGAMENTO':
      return 'Registrar assinatura manualmente';
    case 'ATIVO':
      return atual === 'AGUARDANDO_PAGAMENTO' ? 'Confirmar pagamento' : 'Regularizar';
    case 'EM_ATRASO':
      return 'Marcar em atraso';
    case 'SUSPENSO':
      return 'Suspender';
    case 'CANCELADO':
      return 'Cancelar contrato';
    case 'EXPIRADO':
      return 'Marcar como expirado';
    default:
      return destino;
  }
}

/** Orientação para o motivo, conforme a passagem. */
function ajudaDoMotivo(destino: SituacaoDoContrato, atual: SituacaoDoContrato): string {
  if (destino === 'ATIVO' && atual === 'AGUARDANDO_PAGAMENTO') {
    return 'Informe como o pagamento foi confirmado (por exemplo, pago no balcão). Enquanto a cobrança automática não está integrada, a confirmação é manual e fica registrada. A carência passa a contar a partir de hoje.';
  }
  if (destino === 'ATIVO') {
    return 'Informe como a cobrança foi regularizada. A carência e a vigência não recomeçam.';
  }
  if (destino === 'CANCELADO') {
    return 'Informe o motivo do cancelamento (por exemplo, pedido do tutor). Os animais ficam livres para um novo contrato.';
  }
  return 'Informe o motivo. Ele fica registrado no histórico, com o seu nome e a hora.';
}

@Component({
  selector: 'app-contrato',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, ReaisPipe],
  templateUrl: './contrato.html',
})
export class Contrato implements OnInit {
  private readonly api = inject(ContratosService);
  private readonly rota = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  protected readonly detalhe = signal<DetalheDoContrato | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly salvando = signal(false);
  /** Passagem aguardando o motivo e a confirmação. */
  protected readonly acao = signal<Transicao | null>(null);
  protected readonly motivo = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(240)] });

  protected readonly classe = classeDaSituacao;
  protected readonly especie = rotuloDaEspecie;
  protected readonly telefone = mascaraTelefone;
  protected readonly rotuloDaAcao = rotuloDaAcao;
  protected readonly ajuda = ajudaDoMotivo;

  // ----- cobranças -----

  protected readonly cobrancas = signal<Cobranca[]>([]);
  protected readonly gateway = signal<Gateway | null>(null);
  protected readonly ehGestao = computed(() => this.auth.perfil() === 'GESTAO');
  /** Cobrança cuja recusa está sendo simulada (precisa do motivo). */
  protected readonly recusando = signal<Cobranca | null>(null);
  protected readonly motivoDaRecusa = new FormControl('', { nonNullable: true });
  protected readonly classeCobranca = classeDaCobranca;
  /** "2026-11" → "11/2026". */
  protected readonly mes = (competencia: string): string => `${competencia.slice(5)}/${competencia.slice(0, 4)}`;
  protected readonly hoje = new Date().toISOString().slice(0, 10);

  /** Desconto do terceiro animal em diante, tirado do valor que ele paga (o contrato guarda os valores). */
  protected descontoDoTerceiro(c: ContratoDados): number {
    const terceiro = c.animais[2]?.mensalidadeCentavos ?? c.planoMensalidadeCentavos;
    return Math.round((1 - terceiro / c.planoMensalidadeCentavos) * 1000) / 10;
  }

  protected simular(c: Cobranca, resultado: 'APROVADA' | 'RECUSADA'): void {
    if (resultado === 'RECUSADA' && this.recusando()?.id !== c.id) {
      this.motivoDaRecusa.setValue('');
      this.recusando.set(c);
      return;
    }
    this.cobrancaEmAcao(this.api.simularCobranca(c.id, resultado, this.motivoDaRecusa.value.trim()), resultado === 'APROVADA' ? 'Pagamento aprovado (simulado).' : 'Pagamento recusado (simulado).');
  }

  protected novaTentativa(c: Cobranca): void {
    this.cobrancaEmAcao(this.api.novaTentativa(c.id), 'Cobrança enviada de novo ao gateway.');
  }

  private cobrancaEmAcao(chamada: Observable<unknown>, sucesso: string): void {
    this.erro.set(null);
    this.aviso.set(null);
    this.salvando.set(true);
    chamada.subscribe({
      next: () => {
        this.salvando.set(false);
        this.recusando.set(null);
        this.aviso.set(sucesso);
        this.carregar();
      },
      error: (e: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  // ----- assinatura eletrônica -----

  protected readonly assinatura = signal<Assinatura | null>(null);
  protected readonly linkCopiado = signal(false);

  /**
   * Passagens que o botão de "Próximos passos" oferece. O envio para assinatura tem botão próprio (gera o PDF e manda o
   * WhatsApp), e a assinatura em si é do tutor: só a gestão registra à mão, como reserva.
   */
  protected visiveis(d: DetalheDoContrato): Transicao[] {
    return d.transicoes.filter((t) => t.situacao !== 'AGUARDANDO_ASSINATURA' && (t.situacao !== 'AGUARDANDO_PAGAMENTO' || this.ehGestao()));
  }

  protected enviarParaAssinatura(): void {
    this.assinaturaEmAcao(this.api.enviarParaAssinatura(this.id), 'Contrato enviado para assinatura.');
  }

  protected verificarAssinatura(): void {
    this.assinaturaEmAcao(this.api.conferirAssinatura(this.id), null);
  }

  /** Só com o provedor simulado: faz de conta que o tutor assinou. */
  protected simularAssinatura(): void {
    this.assinaturaEmAcao(this.api.simularAssinatura(this.id), 'Assinatura simulada. O contrato aguarda o pagamento.');
  }

  /** Abre o PDF do contrato numa aba nova (a rota exige login, por isso baixa antes e abre o arquivo). */
  protected verContrato(): void {
    abrirPdf(this.api.documento(this.id), (e) => this.erro.set(e));
  }

  protected copiarLink(): void {
    const link = this.assinatura()?.link;
    if (!link) {
      return;
    }
    navigator.clipboard?.writeText(link).then(
      () => {
        this.linkCopiado.set(true);
        setTimeout(() => this.linkCopiado.set(false), 2500);
      },
      () => undefined,
    );
  }

  private assinaturaEmAcao(chamada: Observable<Assinatura>, sucesso: string | null): void {
    this.erro.set(null);
    this.aviso.set(null);
    this.salvando.set(true);
    chamada.subscribe({
      next: (a) => {
        this.salvando.set(false);
        this.assinatura.set(a);
        this.aviso.set(sucesso ?? (a.situacao === 'ENVIADA' ? 'O tutor ainda não assinou.' : 'Assinatura confirmada. O contrato aguarda o pagamento.'));
        this.carregar();
      },
      error: (e: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  private id = '';

  ngOnInit(): void {
    this.id = this.rota.snapshot.paramMap.get('id') ?? '';
    if (this.rota.snapshot.queryParamMap.get('novo')) {
      this.aviso.set('Contrato criado em rascunho. Quando o tutor estiver pronto, envie para assinatura.');
    }
    this.api.gateway().subscribe({ next: (g) => this.gateway.set(g), error: () => this.gateway.set(null) });
    this.carregar();
  }

  protected escolher(t: Transicao): void {
    this.erro.set(null);
    this.aviso.set(null);
    if (t.exigeMotivo) {
      this.motivo.reset('');
      this.acao.set(t);
    } else {
      this.executar(t);
    }
  }

  protected confirmar(): void {
    const t = this.acao();
    if (!t) {
      return;
    }
    if (!this.motivo.value.trim()) {
      this.motivo.markAsTouched();
      return;
    }
    this.executar(t);
  }

  protected desistir(): void {
    this.acao.set(null);
  }

  private executar(t: Transicao): void {
    this.salvando.set(true);
    this.erro.set(null);
    this.api.mudarSituacao(this.id, t.situacao, this.motivo.value.trim()).subscribe({
      next: (d) => {
        this.salvando.set(false);
        this.acao.set(null);
        this.detalhe.set(d);
        this.aviso.set(`Contrato agora: ${d.contrato.situacaoRotulo}.`);
        this.api.cobrancas(this.id).subscribe({ next: (c) => this.cobrancas.set(c), error: () => this.cobrancas.set([]) });
        this.api.assinatura(this.id).subscribe({ next: (a) => this.assinatura.set(a), error: () => this.assinatura.set(null) });
      },
      error: (e: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  private carregar(): void {
    this.api.consultar(this.id).subscribe({
      next: (d) => {
        this.detalhe.set(d);
        this.carregando.set(false);
      },
      error: (e: unknown) => {
        this.carregando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
    this.api.cobrancas(this.id).subscribe({ next: (c) => this.cobrancas.set(c), error: () => this.cobrancas.set([]) });
    // 404: o contrato ainda não foi enviado para assinatura.
    this.api.assinatura(this.id).subscribe({ next: (a) => this.assinatura.set(a), error: () => this.assinatura.set(null) });
  }
}
