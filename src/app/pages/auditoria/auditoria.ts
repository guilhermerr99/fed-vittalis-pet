import { HttpClient, HttpParams } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Icone } from '../../shared/icone';
import { PERFIS, interpretar, rotuloDoObjeto } from './auditoria-detalhes';
import { mensagemDeErro } from '../login/login';

interface Registro {
  id: string;
  quando: string;
  acao: string;
  autorEmail?: string;
  autorPerfil?: string;
  ip?: string;
  objetoTipo?: string;
  objetoId?: string;
  detalhes?: Record<string, unknown>;
}

interface Pagina {
  itens: Registro[];
  pagina: number;
  tamanho: number;
  total: number;
}

const ACOES: Record<string, string> = {
  LOGIN_SUCESSO: 'Login',
  LOGIN_FALHA: 'Login recusado',
  LOGOUT: 'Logout',
  SESSAO_RENOVADA: 'Sessão renovada',
  SESSAO_REUSO_DETECTADO: 'Reuso de sessão detectado',
  SENHA_ALTERADA: 'Senha alterada',
  USUARIO_CRIADO: 'Usuário cadastrado',
  USUARIO_ATIVADO: 'Usuário ativado',
  USUARIO_DESATIVADO: 'Usuário desativado',
  ADMINISTRADOR_INICIAL_CRIADO: 'Administrador inicial criado',
  PLANO_CRIADO: 'Plano criado',
  PLANO_ALTERADO: 'Plano alterado',
  PLANO_SITUACAO_ALTERADA: 'Situação do plano alterada',
  PROCEDIMENTO_CRIADO: 'Procedimento criado',
  PROCEDIMENTO_ALTERADO: 'Procedimento alterado',
  PROCEDIMENTO_SITUACAO_ALTERADA: 'Situação do procedimento alterada',
  COBERTURA_ALTERADA: 'Cobertura alterada',
  COBERTURA_REMOVIDA: 'Cobertura removida',
  COBERTURA_IMPORTADA: 'Cobertura importada por planilha',
  PARAMETRO_ALTERADO: 'Parâmetro alterado',
  TUTOR_CRIADO: 'Tutor cadastrado',
  TUTOR_ALTERADO: 'Tutor alterado',
  ANIMAL_CADASTRADO: 'Animal cadastrado',
  ANIMAL_ALTERADO: 'Animal alterado',
  ANIMAL_SITUACAO_ALTERADA: 'Situação do animal alterada',
  CONTRATO_CRIADO: 'Contrato criado',
  CONTRATO_SITUACAO_ALTERADA: 'Situação do contrato alterada',
  CONTRATO_RENOVADO: 'Contrato renovado',
  ATENDIMENTO_AUTORIZADO: 'Atendimento autorizado',
  ATENDIMENTO_NEGADO: 'Atendimento negado',
  ATENDIMENTO_CONCLUIDO: 'Atendimento concluído',
  ATENDIMENTO_LANCADO_SIMPLES_VET: 'Atendimento cadastrado no SimplesVet',
  ATENDIMENTO_CANCELADO: 'Atendimento cancelado',
  ASSINATURA_ENVIADA: 'Contrato enviado para assinatura',
  ASSINATURA_CONFIRMADA: 'Assinatura confirmada',
  ASSINATURA_RECUSADA: 'Assinatura recusada',
  ASSINATURA_CANCELADA: 'Assinatura cancelada',
  MODELO_CONTRATO_PUBLICADO: 'Modelo do contrato publicado',
  COPARTICIPACAO_QUITADA: 'Coparticipação quitada',
  EXCECAO_SOLICITADA: 'Exceção de carência solicitada',
  EXCECAO_APROVADA: 'Exceção de carência aprovada',
  EXCECAO_RECUSADA: 'Exceção de carência recusada',
  EXCECAO_EXPIRADA: 'Exceção de carência expirada',
  ROTINAS_EXECUTADAS: 'Rotinas automáticas executadas',
  COBRANCA_GERADA: 'Cobrança gerada',
  COBRANCA_PAGA: 'Cobrança paga',
  COBRANCA_RECUSADA: 'Cobrança recusada',
  COBRANCA_NOVA_TENTATIVA: 'Nova tentativa de cobrança',
  COBRANCA_CANCELADA: 'Cobrança cancelada',
};

@Component({
  selector: 'app-auditoria',
  imports: [ReactiveFormsModule, DatePipe, Icone],
  templateUrl: './auditoria.html',
  host: { '(document:keydown.escape)': 'fechar()' },
})
export class Auditoria implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);

  protected readonly acoes = Object.entries(ACOES);
  protected readonly dados = signal<Pagina | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly pagina = signal(0);
  protected readonly totalDePaginas = computed(() => {
    const d = this.dados();
    return d ? Math.max(1, Math.ceil(d.total / d.tamanho)) : 1;
  });

  protected readonly aberto = signal<Registro | null>(null);
  protected readonly detalhe = computed(() => {
    const r = this.aberto();
    return interpretar(r?.acao ?? '', r?.detalhes);
  });

  protected readonly filtro = this.fb.nonNullable.group({ acao: [''] });

  ngOnInit(): void {
    this.carregar();
  }

  protected rotulo(acao: string): string {
    return ACOES[acao] ?? acao;
  }

  protected filtrar(): void {
    this.pagina.set(0);
    this.carregar();
  }

  protected irPara(delta: number): void {
    this.pagina.update((p) => Math.max(0, Math.min(this.totalDePaginas() - 1, p + delta)));
    this.carregar();
  }

  protected origem(ip?: string): string {
    return !ip ? '—' : ip === '0:0:0:0:0:0:0:1' || ip === '::1' || ip === '127.0.0.1' ? 'este computador' : ip;
  }

  protected perfil(perfil?: string): string {
    return perfil ? (PERFIS[perfil] ?? perfil) : '';
  }

  protected objeto(tipo?: string): string {
    return rotuloDoObjeto(tipo);
  }

  protected abrir(registro: Registro): void {
    this.aberto.set(registro);
    // A janela abre sobre a tela: o foco vai para o botão de fechar, para o Esc e o teclado já valerem.
    setTimeout(() => document.querySelector<HTMLElement>('.modal .modal-fechar')?.focus());
  }

  protected fechar(): void {
    this.aberto.set(null);
  }

  protected fundoClicado(evento: Event): void {
    if (evento.target === evento.currentTarget) {
      this.fechar();
    }
  }

  private carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);
    let params = new HttpParams().set('pagina', this.pagina()).set('tamanho', 20);
    const acao = this.filtro.getRawValue().acao;
    if (acao) {
      params = params.set('acao', acao);
    }
    this.http.get<Pagina>('/api/auditoria', { params }).subscribe({
      next: (d) => {
        this.dados.set(d);
        this.carregando.set(false);
      },
      error: (e: unknown) => {
        this.carregando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }
}
