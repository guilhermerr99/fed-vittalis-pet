import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { Perfil } from './core/auth/auth.models';
import { AuthService } from './core/auth/auth.service';
import { sessaoDeTeste } from './core/auth/testes';

describe('App', () => {
  let ctrl: HttpTestingController;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    ctrl = TestBed.inject(HttpTestingController);
  });

  function entrarComo(perfil: Perfil) {
    TestBed.inject(AuthService).entrar('a@b.com', 's').subscribe();
    ctrl.expectOne('/api/auth/login').flush(sessaoDeTeste(perfil));
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const links = (el: HTMLElement) => Array.from(el.querySelectorAll('nav a')).map((a) => a.textContent?.trim());

  it('sem login não mostra menu nem dados de usuário', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.topo')).toBeNull();
    expect(el.querySelector('nav')).toBeNull();
  });

  it('veterinário vê só o atendimento', () => {
    expect(links(entrarComo('VETERINARIO'))).toEqual(['Atendimento']);
  });

  it('gestão vê painel, configurações, usuários e auditoria', () => {
    expect(links(entrarComo('GESTAO'))).toEqual(['Painel', 'Usuários', 'Auditoria', 'Planos', 'Procedimentos', 'Cobertura', 'Parâmetros']);
  });

  it('suporte técnico vê só os usuários', () => {
    expect(links(entrarComo('ADMIN_TECNICO'))).toEqual(['Usuários']);
  });

  it('mostra o nome e o perfil de quem está logado, e o botão de sair', () => {
    const el = entrarComo('GESTAO');
    expect(el.querySelector('.quem')?.textContent).toContain('Pessoa de Teste');
    expect(el.querySelector('.quem')?.textContent).toContain('Gestão');
    expect(Array.from(el.querySelectorAll('button')).some((b) => b.textContent?.includes('Sair'))).toBe(true);
  });
});
