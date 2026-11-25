import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatrizDaConfiguracao } from './configuracoes.service';
import { PlanosECoberturas } from './planos-e-coberturas';
import { analisarRascunho, chaveDaCelula, rascunhoDe } from './rascunho';

const matriz: MatrizDaConfiguracao = {
  planos: [
    { id: 'p1', codigo: 'essencial', nome: 'Essencial', descricao: '', mensalidadeCentavos: 8990, ativo: true, especie: null },
    { id: 'p2', codigo: 'premium', nome: 'Premium', descricao: '', mensalidadeCentavos: 29900, ativo: true, especie: 'cao' },
  ],
  procedimentos: [
    { id: 'x1', codigo: 'consulta', nome: 'Consulta', categoria: 'consulta', precoParticularCentavos: 12000, ativo: true },
    { id: 'x2', codigo: 'cirurgia', nome: 'Cirurgia', categoria: 'cirurgia', precoParticularCentavos: 150000, ativo: true },
  ],
  regras: [{ planoId: 'p1', procedimentoId: 'x1', carenciaDias: 30, limiteAnual: 2, coparticipacaoCentavos: 2500, intervaloMinimoDias: null, vigenciaInicio: '2026-11-01' }],
  contratosEmAndamento: { p1: 7 },
  parametros: {
    especiesAceitas: ['cao', 'gato'],
    atrasoDiasSuspensao: 15,
    atrasoDiasCancelamento: null,
    atrasoDiasAvisos: [0, 3, 7],
    descontoSegundoAnimalPercentual: 10,
    descontoTerceiroAnimalEmDiantePercentual: 15,
  },
};

describe('Rascunho da configuração', () => {
  it('sem mexer em nada não há alteração nem nada a enviar', () => {
    const a = analisarRascunho(matriz, rascunhoDe(matriz), null);
    expect(a.quantidade).toBe(0);
    expect(a.erros).toEqual([]);
    expect(a.pacote).toEqual({ planos: [], procedimentos: [], regras: [], parametros: null, vigenciaInicio: null });
  });

  it('mudar uma célula vira uma regra; deixar de cobrir vira coberto falso', () => {
    const r = rascunhoDe(matriz);
    r.celulas[chaveDaCelula('p1', 'x1')] = { ...r.celulas[chaveDaCelula('p1', 'x1')], carencia: '60' };
    r.celulas[chaveDaCelula('p2', 'x2')] = { coberto: true, carencia: '90', limite: '1', copart: '10,50', intervalo: '30' };
    let a = analisarRascunho(matriz, r, '2026-12-01');
    expect(a.quantidade).toBe(2);
    expect(a.pacote.vigenciaInicio).toBe('2026-12-01');
    expect(a.pacote.regras).toContainEqual({ planoId: 'p1', procedimentoId: 'x1', coberto: true, carenciaDias: 60, limiteAnual: 2, coparticipacaoCentavos: 2500, intervaloMinimoDias: null });
    expect(a.pacote.regras).toContainEqual({ planoId: 'p2', procedimentoId: 'x2', coberto: true, carenciaDias: 90, limiteAnual: 1, coparticipacaoCentavos: 1050, intervaloMinimoDias: 30 });
    expect([...a.mudados.celulas].sort()).toEqual(['p1|x1', 'p2|x2']);

    r.celulas[chaveDaCelula('p1', 'x1')] = { ...r.celulas[chaveDaCelula('p1', 'x1')], coberto: false };
    a = analisarRascunho(matriz, r, null);
    expect(a.pacote.regras).toContainEqual({ planoId: 'p1', procedimentoId: 'x1', coberto: false, carenciaDias: 0, limiteAnual: 0, coparticipacaoCentavos: 0, intervaloMinimoDias: null });
  });

  it('célula coberta com número inválido vira frase de erro, não vai ao pacote', () => {
    const r = rascunhoDe(matriz);
    r.celulas[chaveDaCelula('p1', 'x1')] = { coberto: true, carencia: 'trinta', limite: '2', copart: '25,00', intervalo: '' };
    const a = analisarRascunho(matriz, r, null);
    expect(a.erros[0]).toContain('Essencial · Consulta');
    expect(a.pacote.regras).toEqual([]);
  });

  it('plano: muda a mensalidade em reais para centavos; mensalidade inválida pede correção', () => {
    const r = rascunhoDe(matriz);
    r.planos[0] = { ...r.planos[0], mensalidade: '99,90' };
    let a = analisarRascunho(matriz, r, null);
    expect(a.pacote.planos).toEqual([{ id: 'p1', nome: 'Essencial', descricao: '', mensalidadeCentavos: 9990, especie: '', ativo: true }]);

    r.planos[0] = { ...r.planos[0], mensalidade: 'abc' };
    a = analisarRascunho(matriz, r, null);
    expect(a.pacote.planos).toEqual([]);
    expect(a.erros[0]).toContain('Essencial');
  });

  it('regras gerais: só entram se mudaram; cancelamento antes da suspensão é recusado', () => {
    const r = rascunhoDe(matriz);
    r.gerais = { ...r.gerais, suspensao: '20' };
    let a = analisarRascunho(matriz, r, null);
    expect(a.pacote.parametros?.atrasoDiasSuspensao).toBe(20);
    expect(a.quantidade).toBe(1);

    r.gerais = { ...r.gerais, cancelamento: '10' };
    a = analisarRascunho(matriz, r, null);
    expect(a.pacote.parametros).toBeNull();
    expect(a.erros[0]).toContain('cancelamento');
  });
});

describe('Planos e coberturas', () => {
  let ctrl: HttpTestingController;
  let f: ComponentFixture<PlanosECoberturas>;
  let el: HTMLElement;

  beforeEach(() => {
    if (typeof crypto.randomUUID !== 'function') {
      Object.defineProperty(crypto, 'randomUUID', { value: () => 'novo-' + Math.random().toString(16).slice(2), configurable: true });
    }
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    ctrl = TestBed.inject(HttpTestingController);
    f = TestBed.createComponent(PlanosECoberturas);
    f.detectChanges();
    ctrl.expectOne('/api/configuracao/matriz').flush(matriz);
    f.detectChanges();
    el = f.nativeElement as HTMLElement;
  });

  const botao = (texto: string) =>
    Array.from(el.querySelectorAll('button, a')).find((b) => b.textContent?.trim().startsWith(texto)) as HTMLButtonElement;
  const digitar = (id: string, valor: string) => {
    const campo = el.querySelector('#' + id) as HTMLInputElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    f.detectChanges();
  };

  it('mostra os planos lado a lado, com preço, contratos em andamento e o que cada um cobre', () => {
    const t = (el.textContent ?? '').replace(/ /g, ' ');
    expect(t).toContain('Essencial');
    expect(t).toContain('Premium');
    expect(t).toContain('89,90');
    expect(t).toContain('7 contratos');
    expect(t).toContain('Só cão');
    expect(t).toContain('Carência 30 dias');
    expect(t).toContain('2× por ano · paga');
    expect(t).toContain('Não coberto');
    expect(el.querySelector('.barra-de-rascunho')).toBeNull();
  });

  it('editar uma célula entra no rascunho; revisar descreve; aplicar grava e recarrega', () => {
    (el.querySelector('button[aria-label^="Coberto: Consulta no plano Essencial"]') as HTMLButtonElement).click();
    f.detectChanges();
    digitar('c-carencia', '60');
    botao('Guardar no rascunho').click();
    f.detectChanges();
    expect(el.querySelector('.barra-de-rascunho')?.textContent).toContain('1 alteração');

    botao('Revisar e aplicar').click();
    const revisao = ctrl.expectOne('/api/configuracao/revisao');
    expect(revisao.request.body.regras).toEqual([
      { planoId: 'p1', procedimentoId: 'x1', coberto: true, carenciaDias: 60, limiteAnual: 2, coparticipacaoCentavos: 2500, intervaloMinimoDias: null },
    ]);
    revisao.flush({
      mudancas: [{ area: 'cobertura', titulo: 'Essencial · Consulta', detalhe: 'Muda: carência de 30 para 60 dias.' }],
      avisos: ['Confira o valor.'],
      bloqueios: [],
      podeAplicar: true,
    });
    f.detectChanges();
    const t = el.textContent ?? '';
    expect(t).toContain('Revise antes de aplicar');
    expect(t).toContain('carência de 30 para 60 dias');
    expect(t).toContain('Confira o valor.');

    botao('Aplicar tudo (1)').click();
    ctrl.expectOne('/api/configuracao/aplicar').flush({ mudancas: [{ area: 'cobertura', titulo: 'x', detalhe: 'y' }], avisos: [], bloqueios: [], podeAplicar: true });
    ctrl.expectOne('/api/configuracao/matriz').flush(matriz);
    f.detectChanges();
    expect(el.textContent).toContain('1 mudança aplicada');
    expect(el.querySelector('.barra-de-rascunho')).toBeNull();
  });

  it('bloqueio da revisão desativa o botão de aplicar', () => {
    (el.querySelector('button[aria-label^="Não coberto: Cirurgia no plano Essencial"]') as HTMLButtonElement).click();
    f.detectChanges();
    botao('Guardar no rascunho').click();
    f.detectChanges();
    botao('Revisar e aplicar').click();
    ctrl.expectOne('/api/configuracao/revisao').flush({ mudancas: [{ area: 'cobertura', titulo: 'a', detalhe: 'b' }], avisos: [], bloqueios: ['Há um erro.'], podeAplicar: false });
    f.detectChanges();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Há um erro.');
    expect(botao('Aplicar tudo').disabled).toBe(true);
  });

  it('descartar volta tudo ao que está gravado, sem chamar o servidor', () => {
    (el.querySelector('button[aria-label^="Não coberto: Cirurgia no plano Premium"]') as HTMLButtonElement).click();
    f.detectChanges();
    botao('Guardar no rascunho').click();
    f.detectChanges();
    expect(el.querySelector('.barra-de-rascunho')).not.toBeNull();
    botao('Descartar').click();
    f.detectChanges();
    expect(el.querySelector('.barra-de-rascunho')).toBeNull();
    expect(el.textContent).toContain('Rascunho descartado');
    ctrl.expectNone('/api/configuracao/revisao');
  });

  it('plano novo: pede nome e mensalidade, copia a cobertura de outro plano e aparece como coluna nova', () => {
    (el.querySelector('.novo-plano') as HTMLButtonElement).click();
    f.detectChanges();
    botao('Guardar no rascunho').click();
    f.detectChanges();
    expect(el.querySelector('.painel-lateral [role=alert]')?.textContent).toContain('nome');

    digitar('p-nome', 'Família');
    digitar('p-mensalidade', '120,00');
    const copiar = el.querySelector('#p-copiar') as HTMLSelectElement;
    copiar.value = 'p1';
    copiar.dispatchEvent(new Event('change'));
    f.detectChanges();
    botao('Guardar no rascunho').click();
    f.detectChanges();

    expect(el.querySelector('.matriz thead')?.textContent).toContain('Família');
    expect(el.querySelector('.barra-de-rascunho')?.textContent).toContain('2 alterações');
    botao('Revisar e aplicar').click();
    const corpo = ctrl.expectOne('/api/configuracao/revisao').request.body;
    expect(corpo.planos[0]).toMatchObject({ nome: 'Família', mensalidadeCentavos: 12000, ativo: true });
    expect(corpo.regras).toHaveLength(1);
    expect(corpo.regras[0]).toMatchObject({ planoId: corpo.planos[0].id, procedimentoId: 'x1', coberto: true, carenciaDias: 30 });
  });

  it('plano novo pode ser removido do rascunho sem deixar rastro', () => {
    (el.querySelector('.novo-plano') as HTMLButtonElement).click();
    f.detectChanges();
    digitar('p-nome', 'Teste');
    digitar('p-mensalidade', '50,00');
    botao('Guardar no rascunho').click();
    f.detectChanges();
    (el.querySelector('button[aria-label="Editar o plano Teste"]') as HTMLButtonElement).click();
    f.detectChanges();
    botao('Remover do rascunho').click();
    f.detectChanges();
    expect(el.textContent).not.toContain('Teste');
    expect(el.querySelector('.barra-de-rascunho')).toBeNull();
  });

  it('as abas trocam entre cobertura, procedimentos e regras gerais', () => {
    botao('Procedimentos').click();
    f.detectChanges();
    expect(el.querySelector('.tbl')?.textContent).toContain('Cirurgia');
    expect(el.textContent).toContain('1 de 2');
    botao('Regras gerais').click();
    f.detectChanges();
    expect((el.querySelector('#g-suspensao') as HTMLInputElement).value).toBe('15');
    digitar('g-suspensao', '20');
    expect(el.querySelector('.barra-de-rascunho')?.textContent).toContain('1 alteração');
  });
});
