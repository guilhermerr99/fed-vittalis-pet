import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { sessaoDeTeste } from '../../core/auth/testes';
import { Login } from './login';

describe('Login', () => {
  let ctrl: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    ctrl = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  function preencher(email: string, senha: string) {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const campo = (id: string) => el.querySelector<HTMLInputElement>('#' + id)!;
    campo('email').value = email;
    campo('email').dispatchEvent(new Event('input'));
    campo('senha').value = senha;
    campo('senha').dispatchEvent(new Event('input'));
    return { fixture, el };
  }

  it('não envia com campos vazios e mostra os avisos', async () => {
    const { fixture, el } = preencher('', '');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    ctrl.expectNone('/api/auth/login');
    expect(el.textContent).toContain('Informe o e-mail.');
    expect(el.textContent).toContain('Informe a senha.');
  });

  it('login correto leva o veterinário para a tela de atendimento', async () => {
    const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const { fixture, el } = preencher('vet@vittalis.local', 'Senha-Forte-123');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));

    ctrl.expectOne('/api/auth/login').flush(sessaoDeTeste('VETERINARIO'));
    fixture.detectChanges();

    expect(navegar).toHaveBeenCalledWith('/veterinario');
  });

  it('senha provisória leva à tela de alterar senha', async () => {
    const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const { el } = preencher('novo@vittalis.local', 'Provisoria-2026');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));

    ctrl.expectOne('/api/auth/login').flush(sessaoDeTeste('VETERINARIO', '1', { deveTrocarSenha: true }));

    expect(navegar).toHaveBeenCalledWith('/senha');
  });

  it('mostra a mensagem do servidor quando o login é recusado', async () => {
    const { fixture, el } = preencher('vet@vittalis.local', 'errada');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));

    ctrl
      .expectOne('/api/auth/login')
      .flush(
        { codigo: 'credenciais_invalidas', detail: 'E-mail ou senha incorretos, ou acesso temporariamente bloqueado.' },
        { status: 401, statusText: 'Unauthorized' },
      );
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('E-mail ou senha incorretos');
  });
});
