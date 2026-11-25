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
  lancadoSimplesVet: false,
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
  const linha = (el: HTMLElement, nome: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('.prow')).find((b) => b.textContent?.includes(nome)) as HTMLButtonElement;
  const etapaAtual = (el: HTMLElement) => el.querySelector('.passos .atual')?.textContent?.trim();

  /** Abre a ficha e vai para a tela de autorização. */
  function abrirAutorizacao(f: ReturnType<typeof ficha>) {
    const aberto = abrir(f);
    botao(aberto.el, 'Selecionar procedimento').click();
    aberto.fixture.detectChanges();
    return aberto;
  }

  it('abre com a lista de animais e filtra conforme o texto é digitado', async () => {
    const ctrl = configurar({});
    const fixture = TestBed.createComponent(TelaDeAtendimento);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const tutor = (nome: string, animal: string) => ({
      id: nome,
      nome,
      telefone: '11912345678',
      animais: [{ id: animal, nome: animal, especie: 'cao', ativo: true }],
    });
    const pagina = (itens: unknown[]) => ({ itens, pagina: 0, tamanho: 15, total: itens.length });

    await new Promise((r) => setTimeout(r, 20));
    const inicial = ctrl.expectOne((r) => r.url === '/api/tutores');
    expect(inicial.request.params.has('busca')).toBe(false);
    inicial.flush(pagina([tutor('Maria', 'Thor'), tutor('João', 'Mel')]));
    fixture.detectChanges();
    expect(etapaAtual(el)).toContain('1. Chegada');
    expect(el.querySelectorAll('.lista-linhas .linha').length).toBe(2);

    const campo = el.querySelector('#busca') as HTMLInputElement;
    campo.value = 'tho';
    campo.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 320));
    const filtrada = ctrl.expectOne((r) => r.url === '/api/tutores');
    expect(filtrada.request.params.get('busca')).toBe('tho');
    filtrada.flush(pagina([tutor('Maria', 'Thor')]));
    fixture.detectChanges();
    expect(el.querySelectorAll('.lista-linhas .linha').length).toBe(1);
    expect(el.querySelector('.lista-linhas')?.textContent).toContain('Thor');
  });

  it('Conferir mostra dados do animal, contrato e carências do plano', () => {
    const { el } = abrir(ficha());
    const t = el.textContent ?? '';
    expect(etapaAtual(el)).toContain('2. Conferir');
    expect(t).toContain('Thor');
    expect(t).toContain('Maria da Silva');
    expect(t).toContain('VP-2026-0001');
    expect(t).toContain('Plano Essencial');
    expect(t).toContain('Carências do plano');
    expect(t).toContain('90 dias');
    expect(t).toContain('Castração');
  });

  it('Autorização lista os procedimentos e só libera o botão quando tudo marcado está liberado', () => {
    const { fixture, el } = abrirAutorizacao(ficha());
    expect(etapaAtual(el)).toContain('3. Autorização');
    expect(el.querySelectorAll('.prow').length).toBe(3);
    expect(botao(el, 'Autorizar e iniciar').disabled).toBe(true);
    expect(el.textContent).toContain('Nenhum procedimento selecionado');

    linha(el, 'Consulta clínica').click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Autorizado com coparticipação');
    expect(el.textContent).toContain('25,00');
    expect(botao(el, 'Autorizar e iniciar').disabled).toBe(false);

    linha(el, 'Castração').click();
    fixture.detectChanges();
    expect(el.textContent).toContain('1 de 2 não autorizados');
    expect(botao(el, 'Autorizar e iniciar').disabled).toBe(true);
  });

  it('o filtro de texto reduz a lista de procedimentos, sem diferenciar acento nem maiúscula', () => {
    const { fixture, el } = abrirAutorizacao(ficha());
    const campo = el.querySelector('#filtro-proc') as HTMLInputElement;
    campo.value = 'CASTRACAO';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(Array.from(el.querySelectorAll('.prow')).map((l) => l.textContent)).toEqual([expect.stringContaining('Castração')]);

    campo.value = 'exame';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.querySelectorAll('.prow').length).toBe(1);
    expect(el.textContent).toContain('Ressonância');

    campo.value = 'zzz';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.querySelectorAll('.prow').length).toBe(0);
    expect(el.textContent).toContain('Nenhum procedimento com esse nome');
  });

  it('autorizar e iniciar envia animal e procedimento e vai para a tela de atendimento', () => {
    const { ctrl, fixture, el } = abrirAutorizacao(ficha());
    linha(el, 'Consulta clínica').click();
    fixture.detectChanges();
    botao(el, 'Autorizar e iniciar').click();
    const req = ctrl.expectOne('/api/atendimentos');
    expect(req.request.body).toEqual({ animalId: 'a1', procedimentoId: 'p1' });
    req.flush(atendimento());
    ctrl.expectOne('/api/atendimentos/animal/a1').flush(ficha({ abertos: [atendimento()] }));
    fixture.detectChanges();
    expect(etapaAtual(el)).toContain('4. Atendimento');
    expect(el.textContent).toContain('Atendimento em andamento');
    expect(el.textContent).toContain('Procedimento autorizado');
    expect(el.textContent).toContain('Consulta clínica');
  });

  it('com procedimento já autorizado em aberto, a ficha abre direto no atendimento', () => {
    const { el } = abrir(ficha({ abertos: [atendimento()] }));
    expect(etapaAtual(el)).toContain('4. Atendimento');
    expect(el.textContent).toContain('Em atendimento');
  });

  it('ao retomar um atendimento em aberto, avisa e oferece voltar à lista', () => {
    const { fixture, el } = abrir(ficha({ abertos: [atendimento()] }));
    expect(el.textContent).toContain('já tem um atendimento em andamento');
    botao(el, 'Voltar à lista').click();
    fixture.detectChanges();
    expect(etapaAtual(el)).toContain('1. Chegada');
    expect(el.textContent).not.toContain('já tem um atendimento em andamento');
  });

  it('o aviso de retomada não aparece logo depois de autorizar', () => {
    const { ctrl, fixture, el } = abrirAutorizacao(ficha());
    linha(el, 'Consulta clínica').click();
    fixture.detectChanges();
    botao(el, 'Autorizar e iniciar').click();
    ctrl.expectOne('/api/atendimentos').flush(atendimento());
    ctrl.expectOne('/api/atendimentos/animal/a1').flush(ficha({ abertos: [atendimento()] }));
    fixture.detectChanges();
    expect(etapaAtual(el)).toContain('4. Atendimento');
    expect(el.textContent).not.toContain('já tem um atendimento em andamento');
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

  it('a confirmação abre em uma janela e fecha com Esc, com o X ou clicando fora', () => {
    const { fixture, el } = abrir(ficha({ abertos: [atendimento()] }));
    const abrirJanela = () => {
      botao(el, 'Cancelar').click();
      fixture.detectChanges();
      expect(el.querySelector('.modal-fundo .modal')).not.toBeNull();
      expect(el.querySelector('.modal')?.getAttribute('aria-modal')).toBe('true');
    };

    abrirJanela();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('.modal')).toBeNull();

    abrirJanela();
    (el.querySelector('.modal-fechar') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.modal')).toBeNull();

    abrirJanela();
    (el.querySelector('.modal-fundo') as HTMLElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.modal')).toBeNull();
  });

  it('pedir exceção exige justificativa e envia o dia', () => {
    const { ctrl, fixture, el } = abrirAutorizacao(ficha());
    linha(el, 'Castração').click();
    fixture.detectChanges();
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

  it('animal sem contrato oferece a contratação e não deixa selecionar procedimento', () => {
    const { el } = abrir(ficha({ contrato: null, procedimentos: [] }));
    expect(el.textContent).toContain('não tem contrato em andamento');
    expect(el.textContent).toContain('Contratar plano');
    expect(botao(el, 'Selecionar procedimento').disabled).toBe(true);
  });

  it('contrato suspenso avisa que não autoriza', () => {
    const { fixture, el } = abrir(ficha({ contrato: { id: 'c1', numero: 'VP-2026-0001', situacao: 'SUSPENSO', situacaoRotulo: 'Suspenso', planoNome: 'Essencial', autoriza: false } }));
    expect(el.textContent).toContain('não autoriza procedimentos');
    botao(el, 'Selecionar procedimento').click();
    fixture.detectChanges();
    linha(el, 'Consulta clínica').click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Não autorizado: contrato suspenso');
    expect(botao(el, 'Autorizar e iniciar').disabled).toBe(true);
  });

  it('coparticipação pendente tem botão para registrar o pagamento', () => {
    const { ctrl, fixture, el } = abrir(ficha({ recentes: [atendimento({ situacao: 'CONCLUIDO', situacaoRotulo: 'Concluído', coparticipacaoPaga: false, coparticipacaoPendente: true })] }));
    expect(el.textContent).toContain('Coparticipação pendente');
    botao(el, 'Registrar pagamento').click();
    ctrl.expectOne('/api/atendimentos/at1/coparticipacao/quitar').flush(atendimento());
    ctrl.expectOne('/api/atendimentos/animal/a1').flush(ficha());
    fixture.detectChanges();
    expect(el.textContent).toContain('registrada como paga');
  });

  it('depois de concluir, avisa para cadastrar no SimplesVet e o botão "Cadastrei" confirma', () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const aberto = atendimento({ data: hoje, coparticipacaoCentavos: 0 });
    const concluido = { ...aberto, situacao: 'CONCLUIDO', situacaoRotulo: 'Concluído' };
    const { ctrl, fixture, el } = abrir(ficha({ abertos: [aberto] }));
    expect(el.textContent).not.toContain('Cadastre este atendimento no SimplesVet');

    botao(el, 'Concluir').click();
    fixture.detectChanges();
    botao(el, 'Concluir atendimento').click();
    ctrl.expectOne('/api/atendimentos/at1/concluir').flush(concluido);
    ctrl.expectOne('/api/atendimentos/animal/a1').flush(ficha({ recentes: [concluido] }));
    fixture.detectChanges();
    expect(el.textContent).toContain('Cadastre este atendimento no SimplesVet');

    botao(el, 'Cadastrei').click();
    ctrl.expectOne('/api/atendimentos/at1/simples-vet').flush(atendimento({ ...concluido, lancadoSimplesVet: true }));
    ctrl.expectOne('/api/atendimentos/animal/a1').flush(
      ficha({
        recentes: [{ ...concluido, lancadoSimplesVet: true, lancadoSimplesVetPor: 'vet@clinica.com', lancadoSimplesVetEm: '2026-11-17T12:00:00Z' }],
      }),
    );
    fixture.detectChanges();
    expect(el.textContent).toContain('marcado como cadastrado no SimplesVet');
    expect(el.textContent).toContain('Cadastrado no SimplesVet');
    expect(el.textContent).toContain('vet@clinica.com');
    expect(botao(el, 'Cadastrei')).toBeUndefined();
  });

  it('atendimento de dia anterior sem cadastro no SimplesVet continua avisando', () => {
    const { ctrl, fixture, el } = abrir(
      ficha({ recentes: [atendimento({ situacao: 'CONCLUIDO', situacaoRotulo: 'Concluído', data: '2026-11-10', coparticipacaoCentavos: 0 })] }),
    );
    expect(el.textContent).toContain('Falta cadastrar no SimplesVet');
    botao(el, 'Cadastrei').click();
    ctrl.expectOne('/api/atendimentos/at1/simples-vet').flush(atendimento({ lancadoSimplesVet: true }));
    ctrl.expectOne('/api/atendimentos/animal/a1').flush(
      ficha({ recentes: [atendimento({ situacao: 'CONCLUIDO', data: '2026-11-10', coparticipacaoCentavos: 0, lancadoSimplesVet: true })] }),
    );
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Falta cadastrar no SimplesVet');
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
