import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ReaisPipe } from '../../shared/dinheiro';
import { mascaraTelefone, rotuloDaEspecie } from '../../shared/documentos';
import { mensagemDeErro } from '../login/login';
import { DetalheDoContrato, ContratosService, SituacaoDoContrato, Transicao, classeDaSituacao } from './contratos.service';

/** Nome do botão para cada passagem do ciclo. Depende da situação de origem quando o destino é o mesmo. */
function rotuloDaAcao(destino: SituacaoDoContrato, atual: SituacaoDoContrato): string {
  switch (destino) {
    case 'AGUARDANDO_ASSINATURA':
      return 'Enviar para assinatura';
    case 'AGUARDANDO_PAGAMENTO':
      return 'Registrar assinatura';
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

  private id = '';

  ngOnInit(): void {
    this.id = this.rota.snapshot.paramMap.get('id') ?? '';
    if (this.rota.snapshot.queryParamMap.get('novo')) {
      this.aviso.set('Contrato criado em rascunho. Quando o tutor estiver pronto, envie para assinatura.');
    }
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
  }
}
