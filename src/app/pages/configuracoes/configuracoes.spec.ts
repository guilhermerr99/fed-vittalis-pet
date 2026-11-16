import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Cobertura } from './cobertura';
import { Parametros, lerDias } from './parametros';
import { Planos } from './planos';

const plano = { id: 'p1', codigo: 'basico', nome: 'Básico', mensalidadeCentavos: 8990, ativo: true };
const proc = { id: 'x1', codigo: 'consulta', nome: 'Consulta', categoria: 'Consulta', precoParticularCentavos: 12000, ativo: true };

describe('Configurações', () => {
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
  });

  it('lerDias aceita lista com vírgula e rejeita texto', () => {
    expect(lerDias('0, 3, 7')).toEqual([0, 3, 7]);
    expect(lerDias('')).toEqual([]);
    expect(lerDias('0, três')).toBeNull();
  });

  it('planos: lista com mensalidade em reais e envia centavos ao criar', () => {
    const f = TestBed.createComponent(Planos);
    f.detectChanges();
    ctrl.expectOne('/api/planos').flush([plano]);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Básico');
    expect(el.textContent).toContain('89,90');

    (el.querySelector('header button') as HTMLButtonElement).click();
    f.detectChanges();
    const set = (id: string, v: string) => {
      const i = el.querySelector('#' + id) as HTMLInputElement;
      i.value = v;
      i.dispatchEvent(new Event('input'));
    };
    set('nome', 'Premium');
    set('mensalidade', '149,90');
    f.detectChanges();
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    const req = ctrl.expectOne('/api/planos');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nome: 'Premium', descricao: '', mensalidadeCentavos: 14990 });
  });

  it('planos: mensalidade inválida não chama a API', () => {
    const f = TestBed.createComponent(Planos);
    f.detectChanges();
    ctrl.expectOne('/api/planos').flush([]);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    (el.querySelector('header button') as HTMLButtonElement).click();
    f.detectChanges();
    const i = el.querySelector('#nome') as HTMLInputElement;
    i.value = 'Teste';
    i.dispatchEvent(new Event('input'));
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    f.detectChanges();
    ctrl.expectNone('/api/planos');
    expect(el.querySelector('[role=alert]')?.textContent).toContain('mensalidade');
  });

  it('cobertura: mostra o plano, os procedimentos e quem não é coberto', () => {
    const f = TestBed.createComponent(Cobertura);
    f.detectChanges();
    ctrl.expectOne('/api/planos').flush([plano]);
    ctrl.expectOne('/api/planos/p1/cobertura').flush([
      {
        procedimento: proc,
        regra: { id: 'r1', carenciaDias: 30, limiteAnual: 2, coparticipacaoCentavos: 2500, vigenciaInicio: '2026-11-01' },
      },
      { procedimento: { ...proc, id: 'x2', nome: 'Cirurgia' } },
    ]);
    f.detectChanges();
    const t = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(t).toContain('Consulta');
    expect(t).toContain('30 d');
    expect(t).toContain('25,00');
    expect(t).toContain('Não coberto');
    expect(t).toContain('1 de 2 procedimentos cobertos');
  });

  it('parâmetros: valida o cancelamento e salva', () => {
    const f = TestBed.createComponent(Parametros);
    f.detectChanges();
    ctrl.expectOne('/api/parametros').flush({
      especiesAceitas: ['Cão', 'Gato'],
      atrasoDiasSuspensao: 15,
      atrasoDiasAvisos: [0, 3, 7],
      descontoSegundoAnimalPercentual: 0,
    });
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect((el.querySelector('#especies') as HTMLInputElement).value).toBe('Cão, Gato');

    const c = el.querySelector('#cancelamento') as HTMLInputElement;
    c.value = '10';
    c.dispatchEvent(new Event('input'));
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    f.detectChanges();
    ctrl.expectNone('/api/parametros');
    expect(el.querySelector('[role=alert]')?.textContent).toContain('cancelamento');

    c.value = '60';
    c.dispatchEvent(new Event('input'));
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    const req = ctrl.expectOne('/api/parametros');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.atrasoDiasCancelamento).toBe(60);
  });
});
