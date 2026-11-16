import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Perfil } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { sessaoDeTeste } from '../../core/auth/testes';
import { Excecoes } from '../excecoes/excecoes';
import { TelaDeAtendimento } from './atendimento';

const procedimento = (extra: Record<string, unknown>) => ({
  procedimentoId: 'x',
  nome: 'Procedimento',
  categoria: 'consulta',
  precoParticularCentavos: 15000,
  estado: 'LIBERADO',
  estadoRotulo: 'Liberado',
  liberado: true,
  coberto: true,
  carenciaDias: 0,
  limiteAnual: 2,
  usosNoPeriodo: 0,
  coparticipacaoCentavos: 0,
  liberacaoEm: '2026-11-16',
  excecao: null,
  ...extra,
});

const atendimento = (extra: Record<string, unknown> = {}) => ({
  id: 'at1',
  animalId: 'a1',
  animalNome: 'Thor',
  procedimentoId: 'p1',
  procedimentoNome: 'Consulta clínica',
  data: '2026-11-16',
  situacao: 'AUTORIZADO',
  situacaoRotulo: 'Autorizado',
  decisao: 'AUTORIZADO_COM_COPARTICIPACAO',
  coparticipacaoCentavos: 2500,
  coparticipacaoPaga: null,
  coparticipacaoPendente: false,
  usosNoPeriodo: 0,
  limiteAnual: 2,
  porExcecao: false,
  criadoEm: '2026-11-16T12:00:00Z',
  ...extra,
});

const ficha = (extra: Record<string, unknown> = {}) => ({
  animal: { id: 'a1', tutorId: 't1', nome: 'Thor', especie: 'cao', raca: 'SRD', sexo: 'M', nascimento: '2023-05-10' },
  tutor: { id: 't1', nome: 'Maria da Silva', telefone: '11912345678' },
  contrato: { id: 'c1', numero: 'VP-2026-0001', situacao: 'ATIVO', situacaoRotulo: 'Ativo', planoNome: 'Essencial', inicioCarencia: '2026-11-01', autoriza: true },
  procedimentos: [
    procedimento({ procedimentoId: 'p1', nome: 'Consulta clínica', estado: 'LIBERADO_COM_COPARTICIPACAO', estadoRotulo: 'Liberado com coparticipação', coparticipacaoCentavos: 2500 }),
    procedimento({ procedimentoId: 'p2', nome: 'Castração', categoria: 'cirurgia', estado: 'EM_CARENCIA', estadoRotulo: 'Em carência', liberado: false, carenciaDias: 90, liberacaoEm: '2027-01-30' }),
    procedimento({ procedimentoId: 'p3', nome: 'Ressonância', categoria: 'exame', estado: 'NAO_COBERTO', estadoRotulo: 'Não coberto', liberado: false, coberto: false, carenciaDias: null, limiteAnual: null }),
  ],
  abertos: [],
  recentes: [],
  ...extra,
});

function configurar(params: Record<string, string>, query: Record<string, string> = {}) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(params), queryParamMap: convertToParamMap(query) } } },
    ],
  });
  return TestBed.inject(HttpTestingController);
}

describe('Atendimento', () => {
  function abrir(f: ReturnType<typeof ficha>) {
    const ctrl = configurar({}, { animal: 'a1' });
    const fixture = TestBed.createComponent(TelaDeAtendimento);
    fixture.detectChanges();
    ctrl.expectOne('/api/atendimentos/animal/a1').flush(f);
    fixture.detectChanges();
    return { ctrl, fixture, el: fixture.nativeElement as HTMLElement };
  }

  const botao = (el: HTMLElement, texto: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(texto)) as HTMLButtonElement;

  it('mostra animal, contrato e a cobertura de cada procedimento, agrupada por categoria', () => {
    const { el } = abrir(ficha());
    const t = el.textContent ?? '';
    expect(t).toContain('Thor');
    expect(t).toContain('Maria da Silva');
    expect(t).toContain('VP-2026-0001');
    expect(t).toContain('Liberado com coparticipação');
    expect(t).toContain('Libera em 30/01/2027');
    expect(t).toContain('Valor particular');
    expect(t).toContain('150,00');
    expect(Array.from(el.querySelectorAll('thead th .cap')).map((c) => c.textContent?.trim())).toEqual(['consulta', 'cirurgia', 'exame']);
    // Só o liberado tem Autorizar; o em carência tem Pedir exceção; o não coberto não tem ação.
    expect(Array.from(el.querySelectorAll('button')).filter((b) => b.textContent?.trim() === 'Autorizar').length).toBe(1);
    expect(Array.from(el.querySelectorAll('button')).filter((b) => b.textContent?.trim() === 'Pedir exceção').length).toBe(1);
  });

  it('autorizar envia animal e procedimento e recarrega a ficha', () => {
    const { ctrl, fixture, el } = abrir(ficha());
    botao(el, 'Autorizar').click();
    const req = ctrl.expectOne('/api/atendimentos');
    expect(req.request.body).toEqual({ animalId: 'a1', procedimentoId: 'p1' });
    req.flush(atendimento());
    ctrl.expectOne('/api/atendimentos/animal/a1').flush(ficha({ abertos: [atendimento()] }));
    fixture.detectChanges();
    expect(el.textContent).toContain('Consulta clínica autorizado');
    expect(el.textContent).toContain('Em andamento');
  });

  it('concluir com coparticipação pede para informar se foi paga', () => {
    const { ctrl, fixture, el } = abrir(ficha({ abertos: [atendimento()] }));
    botao(el, 'Concluir').click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Coparticipação de');
    expect(el.textContent).toContain('25,00');

    botao(el, 'Concluir atendimento').click();
    fixture.detectChanges();
    ctrl.expectNone('/api/atendimentos/at1/concluir');
    expect(el.textContent).toContain('Informe se a coparticipação foi paga');

    (el.querySelectorAll<HTMLInputElement>('input[name=copart]')[1]).click();
    fixture.detectChanges();
    botao(el, 'Concluir atendimento').click();
    const req = ctrl.expectOne('/api/atendimentos/at1/concluir');
    expect(req.request.body).toEqual({ coparticipacaoPaga: false });
  });

  it('pedir exceção exige justificativa e envia o dia', () => {
    const { ctrl, fixture, el } = abrir(ficha());
    botao(el, 'Pedir exceção').click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Pedir exceção de carência: Castração');

    botao(el, 'Solicitar exceção').click();
    fixture.detectChanges();
    ctrl.expectNone('/api/excecoes');
    expect(el.textContent).toContain('pelo menos 10 caracteres');

    const campo = el.querySelector('#justificativa') as HTMLTextAreaElement;
    campo.value = 'Animal com dor intensa, tutor sem condição de esperar.';
    campo.dispatchEvent(new Event('input'));
    botao(el, 'Solicitar exceção').click();
    const req = ctrl.expectOne('/api/excecoes');
    expect(req.request.body.animalId).toBe('a1');
    expect(req.request.body.procedimentoId).toBe('p2');
    expect(req.request.body.justificativa).toContain('dor intensa');
    expect(req.request.body.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('animal sem contrato não mostra cobertura e oferece a contratação', () => {
    const { el } = abrir(ficha({ contrato: null, procedimentos: [] }));
    expect(el.textContent).toContain('não tem contrato em andamento');
    expect(el.textContent).toContain('Contratar plano');
    expect(el.textContent).not.toContain('O que o plano libera hoje');
  });

  it('contrato suspenso avisa que não autoriza', () => {
    const { el } = abrir(ficha({ contrato: { id: 'c1', numero: 'VP-2026-0001', situacao: 'SUSPENSO', situacaoRotulo: 'Suspenso', planoNome: 'Essencial', autoriza: false } }));
    expect(el.textContent).toContain('não autoriza procedimentos');
  });

  it('coparticipação pendente tem botão para registrar o pagamento', () => {
    const { ctrl, fixture, el } = abrir(ficha({ recentes: [atendimento({ situacao: 'CONCLUIDO', situacaoRotulo: 'Concluído', coparticipacaoPaga: false, coparticipacaoPendente: true })] }));
    expect(el.textContent).toContain('Pendente');
    botao(el, 'Registrar pagamento').click();
    ctrl.expectOne('/api/atendimentos/at1/coparticipacao/quitar').flush(atendimento());
    ctrl.expectOne('/api/atendimentos/animal/a1').flush(ficha());
    fixture.detectChanges();
    expect(el.textContent).toContain('registrada como paga');
  });
});

describe('Exceções de carência', () => {
  const excecao = {
    id: 'e1',
    animalId: 'a1',
    animalNome: 'Thor',
    procedimentoId: 'p2',
    procedimentoNome: 'Castração',
    data: '2026-11-16',
    justificativa: 'Animal com dor intensa.',
    situacao: 'SOLICITADA',
    situacaoRotulo: 'Aguardando a gestão',
    solicitadaPor: 'vet@clinica.com',
    solicitadaEm: '2026-11-16T12:00:00Z',
  };

  function abrir(perfil: Perfil) {
    const ctrl = configurar({});
    TestBed.inject(AuthService).entrar('a@b.com', 's').subscribe();
    ctrl.expectOne('/api/auth/login').flush(sessaoDeTeste(perfil));
    const fixture = TestBed.createComponent(Excecoes);
    fixture.detectChanges();
    return { ctrl, fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('a gestão abre nas pendentes, analisa e só decide com motivo', () => {
    const { ctrl, fixture, el } = abrir('GESTAO');
    const req = ctrl.expectOne((r) => r.url === '/api/excecoes');
    expect(req.request.params.get('situacao')).toBe('SOLICITADA');
    req.flush({ itens: [excecao], pagina: 0, tamanho: 15, total: 1 });
    fixture.detectChanges();
    expect(el.textContent).toContain('Castração');
    expect(el.textContent).toContain('vet@clinica.com');

    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Analisar') as HTMLButtonElement).click();
    fixture.detectChanges();
    const aprovar = () => (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Aprovar') as HTMLButtonElement).click();
    aprovar();
    fixture.detectChanges();
    ctrl.expectNone('/api/excecoes/e1/aprovar');
    expect(el.textContent).toContain('Informe o motivo');

    const campo = el.querySelector('#motivo') as HTMLTextAreaElement;
    campo.value = 'Urgência confirmada';
    campo.dispatchEvent(new Event('input'));
    aprovar();
    const decisao = ctrl.expectOne('/api/excecoes/e1/aprovar');
    expect(decisao.request.body).toEqual({ motivo: 'Urgência confirmada' });
  });

  it('o veterinário vê o relatório, mas não tem botão de decisão', () => {
    const { ctrl, fixture, el } = abrir('VETERINARIO');
    const req = ctrl.expectOne((r) => r.url === '/api/excecoes');
    expect(req.request.params.has('situacao')).toBe(false);
    req.flush({ itens: [excecao], pagina: 0, tamanho: 15, total: 1 });
    fixture.detectChanges();
    expect(el.textContent).toContain('Castração');
    expect(Array.from(el.querySelectorAll('button')).some((b) => b.textContent?.trim() === 'Analisar')).toBe(false);
  });
});
