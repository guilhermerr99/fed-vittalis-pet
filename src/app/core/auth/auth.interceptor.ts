import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const ROTAS_PUBLICAS = ['/api/auth/login', '/api/auth/refresh', '/api/auth/logout'];

function comToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}

/**
 * Anexa o token de acesso às chamadas da API. Se a API responder 401, renova a sessão uma vez e repete a
 * chamada; se a renovação falhar, leva o usuário ao login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/') || ROTAS_PUBLICAS.some((r) => req.url.startsWith(r))) {
    return next(req);
  }
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(comToken(req, auth.token())).pipe(
    catchError((erro: unknown) => {
      if (!(erro instanceof HttpErrorResponse) || erro.status !== 401) {
        return throwError(() => erro);
      }
      return auth.renovar().pipe(
        switchMap((s) => next(comToken(req, s.tokenAcesso))),
        catchError((erroRenovacao: unknown) => {
          void router.navigateByUrl('/entrar');
          return throwError(() => erroRenovacao);
        }),
      );
    }),
  );
};
