import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { INICIO_POR_PERFIL, Perfil, Sessao, Usuario } from './auth.models';

const CHAVE_RENOVACAO = 'vittalis.renovacao';

/**
 * Sessão do usuário da equipe. O token de acesso (curto) fica só em memória. O token de renovação fica no
 * sessionStorage: a página recarregada continua logada, mas fechar a aba encerra o acesso, o que convém a um
 * computador compartilhado entre consultórios.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _usuario = signal<Usuario | null>(null);
  private tokenAcesso: string | null = null;
  private renovando$: Observable<Sessao> | null = null;

  readonly usuario = this._usuario.asReadonly();
  readonly autenticado = computed(() => this._usuario() !== null);
  readonly perfil = computed<Perfil | null>(() => this._usuario()?.perfil ?? null);

  token(): string | null {
    return this.tokenAcesso;
  }

  entrar(email: string, senha: string): Observable<Sessao> {
    return this.http.post<Sessao>('/api/auth/login', { email, senha }).pipe(tap((s) => this.guardar(s)));
  }

  /** Tenta retomar a sessão ao abrir a página, usando o token de renovação guardado. */
  retomar(): Observable<boolean> {
    if (this.tokenAcesso) {
      return of(true);
    }
    if (!this.lerRenovacao()) {
      return of(false);
    }
    return this.renovar().pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  /** Troca o token de renovação por um novo par. Chamadas simultâneas compartilham a mesma requisição. */
  renovar(): Observable<Sessao> {
    const token = this.lerRenovacao();
    if (!token) {
      return throwError(() => new Error('sem sessão'));
    }
    if (!this.renovando$) {
      this.renovando$ = this.http.post<Sessao>('/api/auth/refresh', { tokenRenovacao: token }).pipe(
        tap((s) => this.guardar(s)),
        catchError((erro) => {
          this.limpar();
          return throwError(() => erro);
        }),
        finalize(() => (this.renovando$ = null)),
        shareReplay(1),
      );
    }
    return this.renovando$;
  }

  sair(): void {
    const token = this.lerRenovacao();
    this.limpar();
    if (token) {
      this.http.post('/api/auth/logout', { tokenRenovacao: token }).subscribe({ error: () => undefined });
    }
    void this.router.navigateByUrl('/entrar');
  }

  alterarSenha(senhaAtual: string, novaSenha: string): Observable<void> {
    return this.http.put<void>('/api/auth/senha', { senhaAtual, novaSenha });
  }

  /** Encerra a sessão local sem avisar o servidor (por exemplo, depois de trocar a senha). */
  encerrarLocalmente(): void {
    this.limpar();
  }

  inicioDoPerfil(): string {
    const perfil = this.perfil();
    return perfil ? INICIO_POR_PERFIL[perfil] : '/entrar';
  }

  private guardar(s: Sessao): void {
    this.tokenAcesso = s.tokenAcesso;
    this._usuario.set(s.usuario);
    try {
      sessionStorage.setItem(CHAVE_RENOVACAO, s.tokenRenovacao);
    } catch {
      /* sem armazenamento: a sessão dura até recarregar a página */
    }
  }

  private lerRenovacao(): string | null {
    try {
      return sessionStorage.getItem(CHAVE_RENOVACAO);
    } catch {
      return null;
    }
  }

  private limpar(): void {
    this.tokenAcesso = null;
    this._usuario.set(null);
    try {
      sessionStorage.removeItem(CHAVE_RENOVACAO);
    } catch {
      /* ignora */
    }
  }
}
