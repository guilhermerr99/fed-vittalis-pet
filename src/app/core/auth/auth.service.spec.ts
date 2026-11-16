import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { sessaoDeTeste } from './testes';

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('entrar guarda o usuário e o token, e o token de renovação fica na sessão do navegador', () => {
    auth.entrar('a@b.com', 'senha').subscribe();
    const req = http.expectOne('/api/auth/login');
    expect(req.request.body).toEqual({ email: 'a@b.com', senha: 'senha' });
    req.flush(sessaoDeTeste('GESTAO'));

    expect(auth.autenticado()).toBe(true);
    expect(auth.perfil()).toBe('GESTAO');
    expect(auth.token()).toBe('acesso-1');
    expect(sessionStorage.getItem('vittalis.renovacao')).toBe('renovacao-1');
    expect(auth.inicioDoPerfil()).toBe('/gestao');
  });

  it('retomar sem token de renovação não chama a API', () => {
    let resultado: boolean | undefined;
    auth.retomar().subscribe((ok) => (resultado = ok));
    expect(resultado).toBe(false);
  });

  it('retomar usa o token de renovação guardado e restaura a sessão', () => {
    sessionStorage.setItem('vittalis.renovacao', 'renovacao-antigo');
    let resultado: boolean | undefined;
    auth.retomar().subscribe((ok) => (resultado = ok));

    const req = http.expectOne('/api/auth/refresh');
    expect(req.request.body).toEqual({ tokenRenovacao: 'renovacao-antigo' });
    req.flush(sessaoDeTeste('VETERINARIO', '2'));

    expect(resultado).toBe(true);
    expect(auth.token()).toBe('acesso-2');
    expect(sessionStorage.getItem('vittalis.renovacao')).toBe('renovacao-2');
  });

  it('retomar com token de renovação recusado limpa tudo e devolve falso', () => {
    sessionStorage.setItem('vittalis.renovacao', 'invalido');
    let resultado: boolean | undefined;
    auth.retomar().subscribe((ok) => (resultado = ok));

    http.expectOne('/api/auth/refresh').flush({ codigo: 'sessao_invalida' }, { status: 401, statusText: 'Unauthorized' });

    expect(resultado).toBe(false);
    expect(auth.autenticado()).toBe(false);
    expect(sessionStorage.getItem('vittalis.renovacao')).toBeNull();
  });

  it('renovações simultâneas compartilham uma única chamada', () => {
    sessionStorage.setItem('vittalis.renovacao', 'r');
    auth.renovar().subscribe();
    auth.renovar().subscribe();

    const req = http.expectOne('/api/auth/refresh');
    req.flush(sessaoDeTeste());
  });

  it('sair limpa a sessão local, avisa o servidor e leva para a tela de entrada', () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    auth.entrar('a@b.com', 's').subscribe();
    http.expectOne('/api/auth/login').flush(sessaoDeTeste());

    auth.sair();

    expect(navegar).toHaveBeenCalledWith('/entrar');
    expect(auth.autenticado()).toBe(false);
    expect(auth.token()).toBeNull();
    expect(sessionStorage.getItem('vittalis.renovacao')).toBeNull();
    const logout = http.expectOne('/api/auth/logout');
    expect(logout.request.body).toEqual({ tokenRenovacao: 'renovacao-1' });
    logout.flush(null);
  });
});
