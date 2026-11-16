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
};

@Component({
  selector: 'app-auditoria',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './auditoria.html',
  styleUrl: '../usuarios/usuarios.scss',
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

  protected resumo(r: Registro): string {
    const d = r.detalhes;
    if (!d) {
      return '';
    }
    return Object.entries(d)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(' · ');
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
