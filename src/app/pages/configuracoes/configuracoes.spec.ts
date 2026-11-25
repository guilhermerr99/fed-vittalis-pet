import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Cobertura } from './cobertura';
import { lerDias } from './rascunho';

const plano = { id: 'p1', codigo: 'basico', nome: 'Básico', mensalidadeCentavos: 8990, ativo: true };
const proc = { id: 'x1', codigo: 'consulta', nome: 'Consulta', categoria: 'Consulta', precoParticularCentavos: 12000, ativo: true };

describe('Configurações', () => {
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    ctrl = TestBed.inject(HttpTestingController);
  });

  it('lerDias aceita lista com vírgula e rejeita texto', () => {
    expect(lerDias('0, 3, 7')).toEqual([0, 3, 7]);
    expect(lerDias('')).toEqual([]);
    expect(lerDias('0, três')).toBeNull();
  });

  it('importar cobertura: carrega planos e procedimentos, só habilita a prévia com arquivo e volta para a matriz', () => {
    const f = TestBed.createComponent(Cobertura);
    f.detectChanges();
    ctrl.expectOne('/api/planos').flush([plano]);
    ctrl.expectOne('/api/procedimentos').flush([proc]);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Importar cobertura');
    expect(el.textContent).toContain('Baixar modelo');
    const previa = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Ver o que mudaria')) as HTMLButtonElement;
    expect(previa.disabled).toBe(true);
    expect(el.querySelector('a[href="/configuracoes/planos"]')).not.toBeNull();
    ctrl.expectNone('/api/cobertura/importacao/previa');
  });
});
