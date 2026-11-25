import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { provideRouter } from '@angular/router';
import { PainelDaGestao } from './painel';

const painel = (extra: Record<string, unknown> = {}) => ({
  indicadores: {
    contratosAtivos: 12,
    animaisCobertos: 15,
    mensalidadeRecorrenteCentavos: 134850,
    receitaDoMesCentavos: 89900,
    aReceberNoMesCentavos: 44950,
    contratosEmAtraso: 2,
    valorEmAtrasoCentavos: 17980,
    atendimentosNoMes: 9,
    coparticipacaoPendenteCentavos: 5000,
  },
  contratosPorSituacao: [
    { chave: 'RASCUNHO', rotulo: 'Rascunho', valor: 1 },
    { chave: 'ATIVO', rotulo: 'Ativo', valor: 12 },
    { chave: 'EM_ATRASO', rotulo: 'Em atraso', valor: 2 },
    { chave: 'CANCELADO', rotulo: 'Cancelado', valor: 0 },
  ],
  receitaPorMes: ['jun/26', 'jul/26', 'ago/26', 'set/26', 'out/26', 'nov/26'].map((rotulo, i) => ({ mes: `2026-0${i + 6}`, rotulo, valor: i * 20000 })),
  contratosAtivadosPorMes: ['jun/26', 'jul/26', 'ago/26', 'set/26', 'out/26', 'nov/26'].map((rotulo, i) => ({ mes: `2026-0${i + 6}`, rotulo, valor: i })),
  vendas: {
    contratosHoje: 1,
    valorHojeCentavos: 19000,
    contratosNoMes: 4,
    valorNoMesCentavos: 61000,
    porDia: Array.from({ length: 30 }, (_, i) => ({ chave: `2026-11-${i + 1}`, rotulo: `${String(i + 1).padStart(2, '0')}/11`, contratos: i === 29 ? 1 : 0, valorCentavos: i === 29 ? 19000 : 0 })),
    porMes: ['jun/26', 'jul/26', 'ago/26', 'set/26', 'out/26', 'nov/26'].map((rotulo, i) => ({ chave: `2026-0${i + 6}`, rotulo, contratos: i, valorCentavos: i * 12000 })),
    porPessoaNoMes: [
      { nome: 'Dra. Ana', contratos: 3, valorCentavos: 42000 },
      { nome: 'Dr. Paulo', contratos: 1, valorCentavos: 19000 },
    ],
  },
  procedimentosMaisUsados: [
    { chave: 'Consulta clínica', rotulo: 'Consulta clínica', valor: 7 },
    { chave: 'Vacina V10', rotulo: 'Vacina V10', valor: 3 },
  ],
  atencao: [{ codigo: 'excecoes', rotulo: 'Exceções de carência aguardando a gestão', quantidade: 2, rota: '/excecoes' }],
  geradoEm: '2026-11-16T15:30:00Z',
  ...extra,
});

describe('Painel da gestão', () => {
  let ctrl: HttpTestingController;

  beforeEach(() => {
    // Sem animação nos números: o valor final aparece na hora.
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }));
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => vi.unstubAllGlobals());

  function abrir(dados: ReturnType<typeof painel>) {
    const f = TestBed.createComponent(PainelDaGestao);
    f.detectChanges();
    ctrl.expectOne('/api/painel').flush(dados);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  it('mostra os indicadores, os gráficos, as situações, os mais usados e a atenção', () => {
    const el = abrir(painel());
    const t = el.textContent ?? '';
    expect(t).toContain('1.348,50');
    expect(t).toContain('15 animal(is) cobertos');
    expect(t).toContain('899,00');
    expect(t).toContain('449,50 ainda a receber');
    expect(t).toContain('Contratos ativos');
    expect(t).toContain('179,80 por mês em risco');
    expect(t).toContain('nov/26');
    expect(t).toContain('Consulta clínica');
    expect(t).toContain('Exceções de carência aguardando a gestão');
    expect(t).toContain('15 contratos no total');
    expect(t).toContain('9 atendimento(s) concluído(s)');
    expect(t).toContain('50,00 em coparticipação pendente');
    expect(el.querySelectorAll('app-barras').length).toBe(3);
    expect(el.querySelector('a[href="/excecoes"]')).not.toBeNull();
  });

  it('vendas: resumo do dia e do mês, gráfico por dia ou por mês e quem cadastrou', () => {
    const el = abrir(painel());
    const t = el.textContent ?? '';
    expect(t).toContain('Vendas de planos');
    expect(t).toContain('Vendido hoje');
    expect(t).toContain('190,00');
    expect(t).toContain('610,00');
    expect(t).toContain('Dra. Ana');
    expect(t).toContain('Dr. Paulo');
    // Começa por dia (30 colunas) e alterna para os 6 meses.
    const colunas = () => el.querySelectorAll('section[aria-label="Vendas de planos"] app-barras .coluna').length;
    expect(colunas()).toBe(30);
    const mes = Array.from(el.querySelectorAll<HTMLButtonElement>('section[aria-label="Vendas de planos"] .abas button')).find((b) => b.textContent?.includes('Por mês'))!;
    mes.click();
    TestBed.inject(ApplicationRef).tick();
    expect(colunas()).toBe(6);
  });

  it('sem nada pendente, diz que está tudo em dia', () => {
    const el = abrir(painel({ atencao: [], procedimentosMaisUsados: [] }));
    expect(el.textContent).toContain('Tudo em dia');
    expect(el.textContent).toContain('Ainda não há atendimentos concluídos');
  });

  it('o erro do servidor aparece como alerta', () => {
    const f = TestBed.createComponent(PainelDaGestao);
    f.detectChanges();
    ctrl.expectOne('/api/painel').flush({ detail: 'O painel é da gestão.' }, { status: 403, statusText: 'Forbidden' });
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('[role=alert]')).not.toBeNull();
  });
});
