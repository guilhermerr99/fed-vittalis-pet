import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('mostra a marca e os links das três áreas', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.marca')?.textContent).toContain('Vittalis Pet');
    const links = Array.from(el.querySelectorAll('nav a')).map((a) => a.textContent?.trim());
    expect(links).toEqual(['Veterinário', 'Gestão', 'Cliente']);
  });

  it('abre a área do veterinário por padrão', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Atendimento');
  });

  it('abre a área da gestão', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/gestao');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Painel da clínica');
  });

  it('abre o portal do cliente', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/cliente');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Seu plano');
  });
});
