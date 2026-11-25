import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { sessaoDeTeste } from '../../core/auth/testes';
import { Contrato } from './contrato';
import { ContratoNovo } from './contrato-novo';
import { Contratos } from './contratos';

const tutor = {
  id: 't1',
  nome: 'Maria da Silva',
  cpf: '52998224725',
  cpfFormatado: '529.982.247-25',
  telefone: '11912345678',
  lgpdConsentidoEm: '2026-11-16T12:00:00Z',
  ativo: true,
  animais: [
    { id: 'a1', tutorId: 't1', nome: 'Thor', especie: 'cao', raca: 'SRD', sexo: 'M', nascimento: '2023-05-10', ativo: true },
    { id: 'a2', tutorId: 't1', nome: 'Rex', especie: 'cao', nascimento: '2020-01-01', ativo: false },
    { id: 'a3', tutorId: 't1', nome: 'Piu', especie: 'ave', nascimento: '2022-01-01', ativo: true },
  ],
};

const contrato = {
  id: 'c1',
  numero: 'VP-2026-0001',
  situacao: 'RASCUNHO',
  situacaoRotulo: 'Rascunho',
  tutor: { id: 't1', nome: 'Maria da Silva', telefone: '11912345678', cpfMascarado: '***.982.247-**' },
  planoId: 'p1',
  planoNome: 'Essencial',
  planoMensalidadeCentavos: 10000,
  descontoPercentual: 10,
  animais: [
    { id: 'a1', nome: 'Thor', especie: 'cao', mensalidadeCentavos: 10000, inicioCarencia: null },
    { id: 'a4', nome: 'Mel', especie: 'gato', mensalidadeCentavos: 9000, inicioCarencia: null },
  ],
  mensalidadeTotalCentavos: 19000,
  dataContratacao: '2026-11-16',
  criadoEm: '2026-11-16T12:00:00Z',
  criadoPor: 'Dra. Ana',
};

const assinatura = {
  contratoId: 'c9',
  provedor: 'simulado',
  simulacao: true,
  situacao: 'ENVIADA',
  situacaoRotulo: 'Aguardando assinatura',
  link: 'https://assinatura.exemplo/SIM-1234',
  enviadaEm: '2026-11-16T12:00:00Z',
  assinadaEm: null,
  contratoSituacao: 'AGUARDANDO_ASSINATURA',
  mensagem: {
    texto: 'Olá, Maria! Aqui é a Reino Animal. Assine pelo link: https://assinatura.exemplo/SIM-1234 O link vale por 48 horas.',
    situacao: 'SIMULADA',
    situacaoRotulo: 'Simulada',
    canal: 'simulado',
    telefone: '11912345678',
    criadaEm: '2026-11-16T12:00:00Z',
  },
};

function provedores(params: Record<string, string>, query: Record<string, string> = {}) {
  return [
    provideRouter([]),
    provideHttpClient(),
    provideHttpClientTesting(),
    { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(params), queryParamMap: convertToParamMap(query) } } },
  ];
}

describe('Contratos', () => {
  let ctrl: HttpTestingController;

  function preparar(params: Record<string, string> = {}, query: Record<string, string> = {}) {
    TestBed.configureTestingModule({ providers: provedores(params, query) });
    ctrl = TestBed.inject(HttpTestingController);
  }

  it('lista mostra número, tutor, animais, plano, total e situação', () => {
    preparar();
    const f = TestBed.createComponent(Contratos);
    f.detectChanges();
    ctrl.expectOne((r) => r.url === '/api/contratos').flush({ itens: [contrato], pagina: 0, tamanho: 15, total: 1 });
    f.detectChanges();
    const t = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(t).toContain('VP-2026-0001');
    expect(t).toContain('Maria da Silva');
    expect(t).toContain('Thor · Cão');
    expect(t).toContain('Essencial');
    expect(t).toContain('190,00');
    expect(t).toContain('Rascunho');
    expect(t).toContain('Cadastrado por');
    expect(t).toContain('Dra. Ana');
    expect(t).toContain('1 contratos');
  });

  describe('nova contratação', () => {
    function abrir(contratosDoTutor: unknown[] = [], planos?: unknown[]) {
      preparar({}, { tutor: 't1' });
      const f = TestBed.createComponent(ContratoNovo);
      f.detectChanges();
      ctrl.expectOne('/api/parametros').flush({ especiesAceitas: ['cao', 'gato'], atrasoDiasSuspensao: 15, atrasoDiasAvisos: [], descontoSegundoAnimalPercentual: 10 });
      ctrl.expectOne('/api/planos').flush(
        planos ?? [
          { id: 'p1', codigo: 'essencial', nome: 'Essencial', mensalidadeCentavos: 10000, ativo: true },
          { id: 'p2', codigo: 'premium', nome: 'Premium', mensalidadeCentavos: 15000, ativo: true },
          { id: 'p3', codigo: 'antigo', nome: 'Antigo', mensalidadeCentavos: 5000, ativo: false },
        ],
      );
      ctrl.expectOne('/api/tutores/t1').flush(tutor);
      ctrl
        .expectOne((r) => r.url === '/api/contratos' && r.params.get('tutorId') === 't1')
        .flush({ itens: contratosDoTutor, pagina: 0, tamanho: 100, total: contratosDoTutor.length });
      f.detectChanges();
      return f;
    }

    const atual = (el: HTMLElement) => el.querySelector('.passos .atual')?.textContent?.trim();
    const botao = (el: HTMLElement, texto: string) =>
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(texto)) as HTMLButtonElement;

    it('animal que já está em contrato aberto fica bloqueado, com o número do contrato', () => {
      const f = abrir([{ ...contrato, situacao: 'ATIVO', animais: [{ id: 'a1', nome: 'Thor', especie: 'cao', mensalidadeCentavos: 10000 }] }]);
      const el = f.nativeElement as HTMLElement;
      const caixas = Array.from(el.querySelectorAll<HTMLInputElement>('input[type=checkbox]'));
      expect(caixas.map((c) => c.checked)).toEqual([false, false, false]);
      expect(caixas[0].disabled).toBe(true);
      expect(el.textContent).toContain('Já está no contrato VP-2026-0001');
      expect(botao(el, 'Selecionar o plano').disabled).toBe(true);
    });

    it('plano de uma espécie só não aparece para animal de outra espécie', () => {
      const f = abrir([], [
        { id: 'p1', codigo: 'essencial', nome: 'Essencial', mensalidadeCentavos: 10000, ativo: true },
        { id: 'p2', codigo: 'gatos', nome: 'Essencial Gatos', mensalidadeCentavos: 8000, ativo: true, especie: 'gato' },
        { id: 'p3', codigo: 'caes', nome: 'Essencial Cães', mensalidadeCentavos: 9000, ativo: true, especie: 'cao' },
      ]);
      const el = f.nativeElement as HTMLElement;
      botao(el, 'Selecionar o plano').click();
      f.detectChanges();
      const nomes = Array.from(el.querySelectorAll('.planos-grid h3')).map((h) => h.textContent?.trim());
      // Thor é cão: vale o plano geral e o de cães; o de gatos fica de fora.
      expect(nomes).toEqual(['Essencial', 'Essencial Cães']);
      expect(el.textContent).toContain('Só cão');
    });

    it('contrato cancelado não prende o animal', () => {
      const f = abrir([{ ...contrato, situacao: 'CANCELADO', animais: [{ id: 'a1', nome: 'Thor', especie: 'cao', mensalidadeCentavos: 10000 }] }]);
      const caixas = Array.from((f.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input[type=checkbox]'));
      expect(caixas[0].disabled).toBe(false);
      expect(caixas[0].checked).toBe(true);
    });

    it('com o tutor na URL: vai para Animais, marca o único elegível e bloqueia inativo e espécie não aceita', () => {
      const f = abrir();
      const el = f.nativeElement as HTMLElement;
      expect(atual(el)).toContain('2. Animais');
      expect(el.textContent).toContain('Maria da Silva');
      const caixas = Array.from(el.querySelectorAll<HTMLInputElement>('input[type=checkbox]'));
      expect(caixas.map((c) => c.checked)).toEqual([true, false, false]);
      expect(caixas.map((c) => c.disabled)).toEqual([false, true, true]);
      expect(el.textContent).toContain('Inativo');
      expect(el.textContent).toContain('Espécie não aceita');
      expect(el.textContent).toContain('1º animal');
      expect(botao(el, 'Selecionar o plano').disabled).toBe(false);
      expect(el.textContent).toContain('Resumo da contratação');
    });

    it('conduz da escolha do plano até o contrato ativo, passo a passo', () => {
      const f = abrir();
      const el = f.nativeElement as HTMLElement;

      // 3. Plano: só os planos ativos, e o botão espera a escolha.
      botao(el, 'Selecionar o plano').click();
      f.detectChanges();
      expect(atual(el)).toContain('3. Plano');
      const planos = Array.from(el.querySelectorAll<HTMLButtonElement>('.plano'));
      expect(planos.length).toBe(2);
      expect(el.textContent).not.toContain('Antigo');
      expect(botao(el, 'Revisar contrato').disabled).toBe(true);

      planos[0].click();
      const sim = ctrl.expectOne('/api/contratos/simulacao');
      expect(sim.request.body).toEqual({ planoId: 'p1', animais: 1 });
      sim.flush({ mensalidadesCentavos: [10000], totalCentavos: 10000, descontoPercentual: 10 });
      f.detectChanges();
      expect(botao(el, 'Revisar contrato').disabled).toBe(false);

      // 4. Revisão: mostra os dados, o total de 12 meses e as carências do plano.
      botao(el, 'Revisar contrato').click();
      ctrl.expectOne('/api/planos/p1/cobertura').flush([
        { procedimento: { id: 'x1', codigo: 'c', nome: 'Consulta', ativo: true, precoParticularCentavos: 100 }, regra: { id: 'r1', carenciaDias: 90, limiteAnual: 2, coparticipacaoCentavos: 0, vigenciaInicio: '2026-01-01' } },
        { procedimento: { id: 'x2', codigo: 's', nome: 'Sutura', ativo: true, precoParticularCentavos: 100 } },
      ]);
      f.detectChanges();
      expect(atual(el)).toContain('4. Revisão');
      expect(el.textContent).toContain('Revisão do contrato');
      expect(el.textContent).toContain('1.200,00');
      expect(el.textContent).toContain('90 dias');
      expect(el.textContent).toContain('Consulta');

      // 5. Assinatura: o contrato é criado e enviado para assinatura (PDF, provedor e WhatsApp ficam por conta do servidor).
      botao(el, 'Enviar para assinatura').click();
      const criar = ctrl.expectOne('/api/contratos');
      expect(criar.request.body).toEqual({ tutorId: 't1', planoId: 'p1', animais: ['a1'] });
      criar.flush({ contrato: { ...contrato, id: 'c9' }, historico: [], transicoes: [] });
      const enviar = ctrl.expectOne('/api/contratos/c9/assinatura');
      expect(enviar.request.method).toBe('POST');
      enviar.flush(assinatura);
      ctrl.expectOne('/api/contratos/c9').flush({
        contrato: { ...contrato, id: 'c9', situacao: 'AGUARDANDO_ASSINATURA', situacaoRotulo: 'Aguardando assinatura', expiraEm: '2026-11-18T12:00:00Z' },
        historico: [],
        transicoes: [],
      });
      f.detectChanges();
      expect(atual(el)).toContain('5. Assinatura');
      expect(el.textContent).toContain('Aguardando assinatura');
      expect(el.textContent).toContain('VP-2026-0001');
      expect(el.textContent).toContain('Assine pelo link');
      expect(el.textContent).toContain('https://assinatura.exemplo/SIM-1234');
      expect(el.textContent).toContain('registrada, não enviada');

      // Com o provedor simulado, a equipe faz de conta que o tutor assinou; o contrato segue para o pagamento.
      botao(el, 'Simular assinatura de Maria').click();
      const assinar = ctrl.expectOne('/api/contratos/c9/assinatura/simular');
      assinar.flush({ ...assinatura, situacao: 'ASSINADA', situacaoRotulo: 'Assinada', assinadaEm: '2026-11-16T12:05:00Z', contratoSituacao: 'AGUARDANDO_PAGAMENTO' });
      ctrl.expectOne('/api/contratos/c9').flush({
        contrato: { ...contrato, id: 'c9', situacao: 'AGUARDANDO_PAGAMENTO', situacaoRotulo: 'Aguardando pagamento' },
        historico: [],
        transicoes: [],
      });
      ctrl.expectOne((r) => r.url === '/api/cobrancas').flush([
        { id: 'cb1', contratoId: 'c9', competencia: '2026-11', valorCentavos: 19000, vencimento: '2026-11-16', situacao: 'PENDENTE', situacaoRotulo: 'Pendente', primeira: true, gateway: 'simulado', tentativas: 1, criadaEm: '2026-11-16T12:00:00Z' },
      ]);
      ctrl.expectOne('/api/cobrancas/gateway').flush({ nome: 'simulado', simulacao: true });
      f.detectChanges();
      expect(atual(el)).toContain('6. Pagamento');
      expect(el.textContent).toContain('Aguardando o tutor pagar');
      expect(el.textContent).toContain('190,00');

      // Pagamento confirmado: contrato ativo.
      botao(el, 'Já pagou').click();
      ctrl.expectOne('/api/contratos/c9').flush({ contrato: { ...contrato, id: 'c9', situacao: 'ATIVO', situacaoRotulo: 'Ativo', ativadoEm: '2026-11-16' }, historico: [], transicoes: [] });
      ctrl.expectOne((r) => r.url === '/api/cobrancas').flush([]);
      f.detectChanges();
      expect(el.textContent).toContain('Contrato ativo');
      expect(el.querySelector('.sucesso')).not.toBeNull();
    });

    it('com o provedor real não há botão de simular, só verificar; o aviso de que não assinou aparece', () => {
      const f = abrir();
      const el = f.nativeElement as HTMLElement;
      botao(el, 'Selecionar o plano').click();
      f.detectChanges();
      (el.querySelectorAll<HTMLButtonElement>('.plano')[0]).click();
      ctrl.expectOne('/api/contratos/simulacao').flush({ mensalidadesCentavos: [10000], totalCentavos: 10000, descontoPercentual: 10 });
      f.detectChanges();
      botao(el, 'Revisar contrato').click();
      ctrl.expectOne('/api/planos/p1/cobertura').flush([]);
      f.detectChanges();
      botao(el, 'Enviar para assinatura').click();
      ctrl.expectOne('/api/contratos').flush({ contrato: { ...contrato, id: 'c9' }, historico: [], transicoes: [] });
      ctrl.expectOne('/api/contratos/c9/assinatura').flush({ ...assinatura, provedor: 'zapsign', simulacao: false, mensagem: { ...assinatura.mensagem, situacao: 'ENVIADA' } });
      ctrl.expectOne('/api/contratos/c9').flush({ contrato: { ...contrato, id: 'c9', situacao: 'AGUARDANDO_ASSINATURA' }, historico: [], transicoes: [] });
      f.detectChanges();
      expect(botao(el, 'Simular assinatura')).toBeUndefined();
      expect(el.textContent).toContain('enviada pelo WhatsApp da clínica');

      botao(el, 'Verificar assinatura').click();
      const conferir = ctrl.expectOne('/api/contratos/c9/assinatura/conferir');
      expect(conferir.request.method).toBe('POST');
      conferir.flush({ ...assinatura, provedor: 'zapsign', simulacao: false });
      f.detectChanges();
      expect(atual(el)).toContain('5. Assinatura');
      expect(el.textContent).toContain('Maria ainda não assinou.');
    });

    it('sem tutor escolhido, começa em Tutor com a busca', () => {
      preparar();
      const f = TestBed.createComponent(ContratoNovo);
      f.detectChanges();
      ctrl.expectOne('/api/parametros').flush({ especiesAceitas: ['cao'], atrasoDiasSuspensao: 15, atrasoDiasAvisos: [], descontoSegundoAnimalPercentual: 0 });
      ctrl.expectOne('/api/planos').flush([]);
      f.detectChanges();
      const el = f.nativeElement as HTMLElement;
      expect(atual(el)).toContain('1. Tutor');
      expect(el.textContent).toContain('Dados do tutor');
      expect(el.textContent).toContain('Continuar para os dados do animal');
      expect(el.querySelector('#cpf')).not.toBeNull();
      expect(el.querySelector('#aviso')).not.toBeNull();
    });
  });

  describe('detalhe', () => {
    const detalhe = (situacao: string, rotulo: string, transicoes: unknown[]) => ({
      contrato: { ...contrato, situacao, situacaoRotulo: rotulo },
      historico: [{ de: null, para: 'Rascunho', motivo: 'Contrato criado', por: 'vet@clinica.com', quando: '2026-11-16T12:00:00Z' }],
      transicoes,
    });

    function abrir(d: ReturnType<typeof detalhe>, assinaturaDoDetalhe?: unknown) {
      preparar({ id: 'c1' });
      const f = TestBed.createComponent(Contrato);
      f.detectChanges();
      ctrl.expectOne('/api/contratos/c1').flush(d);
      ctrl.expectOne((r) => r.url === '/api/contratos/c1/assinatura').flush(assinaturaDoDetalhe ?? null, assinaturaDoDetalhe ? { status: 200, statusText: 'OK' } : { status: 404, statusText: 'Not Found' });
      f.detectChanges();
      return f;
    }

    it('mostra os dados, os animais com o valor de cada um e o histórico', () => {
      const f = abrir(detalhe('RASCUNHO', 'Rascunho', [{ situacao: 'AGUARDANDO_ASSINATURA', rotulo: 'Aguardando assinatura', exigeMotivo: false }]));
      const t = (f.nativeElement as HTMLElement).textContent ?? '';
      expect(t).toContain('VP-2026-0001');
      expect(t).toContain('Thor');
      expect(t).toContain('1º animal');
      expect(t).toContain('2º animal');
      expect(t).toContain('90,00');
      expect(t).toContain('190,00');
      expect(t).toContain('Quando o contrato ficar ativo');
      expect(t).toContain('vet@clinica.com');
      expect(t).toContain('Enviar para assinatura');
    });

    it('enviar para assinatura gera o documento e mostra a mensagem e o link', () => {
      const f = abrir(detalhe('RASCUNHO', 'Rascunho', [{ situacao: 'AGUARDANDO_ASSINATURA', rotulo: 'Aguardando assinatura', exigeMotivo: false }]));
      const el = f.nativeElement as HTMLElement;
      // O botão genérico de "Aguardando assinatura" não aparece: o envio tem botão próprio.
      expect(el.textContent).not.toContain('Próximos passos');
      (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Enviar para assinatura')) as HTMLButtonElement).click();
      const req = ctrl.expectOne((r) => r.method === 'POST' && r.url === '/api/contratos/c1/assinatura');
      req.flush({ ...assinatura, contratoId: 'c1' });
      ctrl.expectOne('/api/contratos/c1').flush(detalhe('AGUARDANDO_ASSINATURA', 'Aguardando assinatura', []));
      ctrl.match((r) => r.url === '/api/cobrancas').forEach((q) => q.flush([]));
      ctrl.expectOne((r) => r.method === 'GET' && r.url === '/api/contratos/c1/assinatura').flush({ ...assinatura, contratoId: 'c1' });
      f.detectChanges();
      expect(el.textContent).toContain('Contrato enviado para assinatura.');
      expect(el.textContent).toContain('Assine pelo link');
      expect(el.textContent).toContain('https://assinatura.exemplo/SIM-1234');
      expect(Array.from(el.querySelectorAll('button')).some((b) => b.textContent?.includes('Verificar assinatura'))).toBe(true);
      expect(Array.from(el.querySelectorAll('button')).some((b) => b.textContent?.includes('Simular assinatura do tutor'))).toBe(true);
    });

    it('com o provedor real a equipe só verifica; registrar à mão fica para a gestão', () => {
      const real = { ...assinatura, contratoId: 'c1', provedor: 'zapsign', simulacao: false };
      const doDetalhe = detalhe('AGUARDANDO_ASSINATURA', 'Aguardando assinatura', [{ situacao: 'AGUARDANDO_PAGAMENTO', rotulo: 'Aguardando pagamento', exigeMotivo: false }]);
      const f = abrir(doDetalhe, real);
      const textos = () => Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).map((b) => b.textContent?.trim());
      expect(textos()).toContain('Verificar assinatura');
      expect(textos().some((t) => t?.includes('Simular assinatura'))).toBe(false);
      // O veterinário (perfil do teste) não registra a assinatura do tutor à mão.
      expect(textos()).not.toContain('Registrar assinatura manualmente');
    });

    it('passagem com motivo pede o motivo e não envia sem ele', () => {
      const f = abrir(detalhe('AGUARDANDO_PAGAMENTO', 'Aguardando pagamento', [{ situacao: 'ATIVO', rotulo: 'Ativo', exigeMotivo: true }]));
      const el = f.nativeElement as HTMLElement;
      (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Confirmar pagamento')) as HTMLButtonElement).click();
      f.detectChanges();
      expect(el.querySelector('#motivo')).not.toBeNull();
      expect(el.textContent).toContain('confirmação é manual');

      const confirmar = () => (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Confirmar pagamento')) as HTMLButtonElement).click();
      confirmar();
      ctrl.expectNone('/api/contratos/c1/situacao');
      f.detectChanges();
      expect(el.textContent).toContain('Informe o motivo');

      const campo = el.querySelector('#motivo') as HTMLTextAreaElement;
      campo.value = 'Pago no balcão';
      campo.dispatchEvent(new Event('input'));
      confirmar();
      const req = ctrl.expectOne('/api/contratos/c1/situacao');
      expect(req.request.body).toEqual({ destino: 'ATIVO', motivo: 'Pago no balcão' });
    });

    it('mostra as cobranças e, para a gestão com gateway simulado, os botões de simular', () => {
      TestBed.configureTestingModule({ providers: provedores({ id: 'c1' }) });
      const ctrl2 = TestBed.inject(HttpTestingController);
      TestBed.inject(AuthService).entrar('a@b.com', 's').subscribe();
      ctrl2.expectOne('/api/auth/login').flush(sessaoDeTeste('GESTAO'));
      const f = TestBed.createComponent(Contrato);
      f.detectChanges();
      ctrl2.expectOne('/api/cobrancas/gateway').flush({ nome: 'simulado', simulacao: true });
      ctrl2.expectOne('/api/contratos/c1').flush(detalhe('AGUARDANDO_PAGAMENTO', 'Aguardando pagamento', []));
      ctrl2.expectOne((r) => r.url === '/api/cobrancas').flush([
        { id: 'cb1', contratoId: 'c1', competencia: '2026-11', valorCentavos: 19000, vencimento: '2026-11-16', situacao: 'PENDENTE', situacaoRotulo: 'Aguardando pagamento', primeira: true, gateway: 'simulado', idNoGateway: 'SIM-1234', tentativas: 1, criadaEm: '2026-11-16T12:00:00Z' },
        { id: 'cb0', contratoId: 'c1', competencia: '2026-10', valorCentavos: 19000, vencimento: '2026-10-16', situacao: 'RECUSADA', situacaoRotulo: 'Recusada', primeira: false, gateway: 'simulado', tentativas: 2, motivoDaRecusa: 'Cartão sem limite', criadaEm: '2026-10-16T12:00:00Z' },
      ]);
      f.detectChanges();
      const el = f.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Gateway: simulado');
      expect(el.textContent).toContain('11/2026 · primeira');
      expect(el.textContent).toContain('SIM-1234');
      expect(el.textContent).toContain('Cartão sem limite');
      expect(el.textContent).toContain('2 tentativas');
      expect(Array.from(el.querySelectorAll('button')).filter((b) => b.textContent?.trim() === 'Simular aprovação').length).toBe(2);
      expect(Array.from(el.querySelectorAll('button')).filter((b) => b.textContent?.trim() === 'Nova tentativa').length).toBe(1);

      (Array.from(el.querySelectorAll('button')).filter((b) => b.textContent?.trim() === 'Simular aprovação')[0] as HTMLButtonElement).click();
      const req = ctrl2.expectOne('/api/cobrancas/cb1/simular');
      expect(req.request.body).toEqual({ resultado: 'APROVADA', motivo: '' });
    });

    it('sem passagens permitidas não mostra o bloco de próximos passos', () => {
      const f = abrir(detalhe('CANCELADO', 'Cancelado', []));
      expect((f.nativeElement as HTMLElement).textContent).not.toContain('Próximos passos');
    });
  });
});
