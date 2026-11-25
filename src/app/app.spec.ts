import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
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
    expect(links(entrarComo('VETERINARIO'))).toEqual(['Atendimento', 'Nova contratação', 'Contratos', 'Tutores e animais', 'Exceções']);
  });

  it('gestão vê painel, configurações, usuários e auditoria', () => {
    expect(links(entrarComo('GESTAO'))).toEqual(['Atendimento', 'Nova contratação', 'Contratos', 'Tutores e animais', 'Exceções', 'Painel', 'Usuários', 'Auditoria', 'Planos e coberturas', 'Modelo do contrato']);
  });

  it('suporte técnico vê só os usuários', () => {
    expect(links(entrarComo('ADMIN_TECNICO'))).toEqual(['Usuários']);
  });

  it('mostra o nome e o perfil de quem está logado, com alterar senha e sair no menu de três pontinhos', () => {
    const el = entrarComo('GESTAO');
    expect(el.querySelector('.quem')?.textContent).toContain('Pessoa de Teste');
    expect(el.querySelector('.quem')?.textContent).toContain('Gestão');

    // Fechado, o menu não aparece; aberto, traz as duas ações.
    expect(el.querySelector('.popover')).toBeNull();
    expect(el.querySelector('.topo')?.textContent).not.toContain('Alterar senha');
    (el.querySelector('.rodape .mais') as HTMLButtonElement).click();
    TestBed.inject(ApplicationRef).tick();
    const itens = Array.from(el.querySelectorAll('.rodape .popover [role=menuitem]')).map((i) => i.textContent?.trim());
    expect(itens).toEqual(['Alterar senha', 'Sair']);

    // Clicar fora fecha.
    document.body.click();
    TestBed.inject(ApplicationRef).tick();
    expect(el.querySelector('.popover')).toBeNull();
  });
});
