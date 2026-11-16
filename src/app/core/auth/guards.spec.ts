import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, isObservable, of } from 'rxjs';
import { AuthService } from './auth.service';
import { autenticadoGuard, perfilGuard, visitanteGuard } from './guards';
import { sessaoDeTeste } from './testes';
import { Perfil } from './auth.models';

describe('guards', () => {
  let ctrl: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => ctrl.verify());

  async function rodar(guard: CanActivateFn): Promise<boolean | UrlTree> {
    const r = TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    const obs: Observable<boolean | UrlTree> = isObservable(r) ? (r as Observable<boolean | UrlTree>) : of(r as boolean | UrlTree);
    return firstValueFrom(obs);
  }

  function entrarComo(perfil: Perfil): void {
    auth.entrar('a@b.com', 's').subscribe();
    ctrl.expectOne('/api/auth/login').flush(sessaoDeTeste(perfil));
  }

  it('autenticadoGuard: sem sessão, vai para /entrar', async () => {
    const r = await rodar(autenticadoGuard);
    expect(router.serializeUrl(r as UrlTree)).toBe('/entrar');
  });

  it('autenticadoGuard: com sessão, libera', async () => {
    entrarComo('VETERINARIO');
    expect(await rodar(autenticadoGuard)).toBe(true);
  });

  it('perfilGuard: libera o perfil permitido', async () => {
    entrarComo('GESTAO');
    expect(await rodar(perfilGuard('GESTAO'))).toBe(true);
  });

  it('perfilGuard: perfil sem permissão volta para o início do próprio perfil', async () => {
    entrarComo('VETERINARIO');
    const r = await rodar(perfilGuard('GESTAO'));
    expect(router.serializeUrl(r as UrlTree)).toBe('/veterinario');
  });

  it('perfilGuard: sem sessão, vai para /entrar', async () => {
    const r = await rodar(perfilGuard('GESTAO'));
    expect(router.serializeUrl(r as UrlTree)).toBe('/entrar');
  });

  it('visitanteGuard: quem já entrou vai para o seu início; visitante passa', async () => {
    expect(await rodar(visitanteGuard)).toBe(true);
    entrarComo('GESTAO');
    const r = await rodar(visitanteGuard);
    expect(router.serializeUrl(r as UrlTree)).toBe('/gestao');
  });
});
