import { HttpClient, HttpParams } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { mensagemDeErro } from '../login/login';

interface Registro {
  id: string;
  quando: string;
  acao: string;
  autorEmail?: string;
  autorPerfil?: string;
  ip?: string;
  objetoTipo?: string;
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
};

const CAMPOS: Record<string, string> = {
  antes: 'antes',
  depois: 'depois',
  plano: 'plano',
  procedimento: 'procedimento',
  origem: 'origem',
  vigenciaInicio: 'a partir de',
  carenciaDias: 'carência (dias)',
  limiteAnual: 'limite/ano',
  coparticipacaoCentavos: 'coparticipação',
  intervaloMinimoDias: 'intervalo mín. (dias)',
  mensalidadeCentavos: 'mensalidade',
  precoParticularCentavos: 'preço particular',
};

function formatar(valor: unknown, chave = ''): string {
  if (valor == null) {
    return 'nenhum';
  }
  if (typeof valor === 'object') {
    if (Array.isArray(valor)) {
      return valor.map((v) => formatar(v)).join(', ');
    }
    return Object.entries(valor as Record<string, unknown>)
      .map(([k, v]) => `${CAMPOS[k] ?? k}: ${formatar(v, k)}`)
      .join(' · ');
  }
  if (typeof valor === 'number' && chave.endsWith('Centavos')) {
    return (valor / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  return String(valor);
}

@Component({
  selector: 'app-auditoria',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './auditoria.html',
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

  protected resumo(r: Registro): string {
    return r.detalhes ? formatar(r.detalhes) : '';
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
