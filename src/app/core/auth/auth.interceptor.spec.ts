import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { sessaoDeTeste } from './testes';

describe('authInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    auth.entrar('a@b.com', 's').subscribe();
    ctrl.expectOne('/api/auth/login').flush(sessaoDeTeste('GESTAO', '1'));
  });

  afterEach(() => ctrl.verify());

  it('anexa o token de acesso às chamadas da API', () => {
    http.get('/api/usuarios').subscribe();
    const req = ctrl.expectOne('/api/usuarios');
    expect(req.request.headers.get('Authorization')).toBe('Bearer acesso-1');
    req.flush([]);
  });

  it('não anexa o token ao login nem a endereços fora da API', () => {
    http.post('/api/auth/login', {}).subscribe();
    expect(ctrl.expectOne('/api/auth/login').request.headers.has('Authorization')).toBe(false);
    http.get('/outra-coisa').subscribe();
    expect(ctrl.expectOne('/outra-coisa').request.headers.has('Authorization')).toBe(false);
  });

  it('ao receber 401, renova a sessão e repete a chamada com o token novo', () => {
    let corpo: unknown;
    http.get('/api/usuarios').subscribe((c) => (corpo = c));

    ctrl.expectOne('/api/usuarios').flush({}, { status: 401, statusText: 'Unauthorized' });
    ctrl.expectOne('/api/auth/refresh').flush(sessaoDeTeste('GESTAO', '2'));
    const repetida = ctrl.expectOne('/api/usuarios');
    expect(repetida.request.headers.get('Authorization')).toBe('Bearer acesso-2');
    repetida.flush(['ok']);

    expect(corpo).toEqual(['ok']);
  });

  it('se a renovação falhar, leva o usuário para a tela de entrada', () => {
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    let falhou = false;
    http.get('/api/usuarios').subscribe({ error: () => (falhou = true) });

    ctrl.expectOne('/api/usuarios').flush({}, { status: 401, statusText: 'Unauthorized' });
    ctrl.expectOne('/api/auth/refresh').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(falhou).toBe(true);
    expect(navegar).toHaveBeenCalledWith('/entrar');
  });

  it('erros que não são 401 passam direto, sem renovar', () => {
    let status = 0;
    http.get('/api/usuarios').subscribe({ error: (e) => (status = e.status) });
    ctrl.expectOne('/api/usuarios').flush({}, { status: 403, statusText: 'Forbidden' });
    expect(status).toBe(403);
  });
});
