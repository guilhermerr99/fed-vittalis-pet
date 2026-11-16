import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { Perfil } from './auth.models';
import { AuthService } from './auth.service';

/** Exige usuário logado. Sem login, retoma a sessão guardada; se não houver, vai para a tela de entrada. */
export const autenticadoGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.retomar().pipe(map((ok) => ok || router.createUrlTree(['/entrar'])));
};

/** Exige um dos perfis informados. Outro perfil volta para o início do próprio perfil. */
export const perfilGuard =
  (...permitidos: Perfil[]): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.retomar().pipe(
      map((ok) => {
        if (!ok) {
          return router.createUrlTree(['/entrar']);
        }
        const perfil = auth.perfil();
        return perfil && permitidos.includes(perfil) ? true : router.parseUrl(auth.inicioDoPerfil());
      }),
    );
  };

/** Só para quem ainda não entrou: quem já tem sessão vai direto ao seu início. */
export const visitanteGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.retomar().pipe(map((ok) => (ok ? router.parseUrl(auth.inicioDoPerfil()) : true)));
};
