import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
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
    expect(t).toContain('1 contratos');
  });

  describe('nova contratação', () => {
    function abrir(contratosDoTutor: unknown[] = []) {
      preparar({}, { tutor: 't1' });
      const f = TestBed.createComponent(ContratoNovo);
      f.detectChanges();
      ctrl.expectOne('/api/parametros').flush({ especiesAceitas: ['cao', 'gato'], atrasoDiasSuspensao: 15, atrasoDiasAvisos: [], descontoSegundoAnimalPercentual: 10 });
      ctrl.expectOne('/api/planos').flush([
        { id: 'p1', codigo: 'essencial', nome: 'Essencial', mensalidadeCentavos: 10000, ativo: true },
        { id: 'p2', codigo: 'premium', nome: 'Premium', mensalidadeCentavos: 15000, ativo: true },
        { id: 'p3', codigo: 'antigo', nome: 'Antigo', mensalidadeCentavos: 5000, ativo: false },
      ]);
      ctrl.expectOne('/api/tutores/t1').flush(tutor);
      ctrl
        .expectOne((r) => r.url === '/api/contratos' && r.params.get('tutorId') === 't1')
        .flush({ itens: contratosDoTutor, pagina: 0, tamanho: 100, total: contratosDoTutor.length });
      f.detectChanges();
      return f;
    }

    it('animal que já está em contrato aberto fica bloqueado, com o número do contrato', () => {
      const f = abrir([{ ...contrato, situacao: 'ATIVO', animais: [{ id: 'a1', nome: 'Thor', especie: 'cao', mensalidadeCentavos: 10000 }] }]);
      const el = f.nativeElement as HTMLElement;
      const caixas = Array.from(el.querySelectorAll<HTMLInputElement>('input[type=checkbox]'));
      expect(caixas.map((c) => c.checked)).toEqual([false, false, false]);
      expect(caixas[0].disabled).toBe(true);
      expect(el.textContent).toContain('Já está no contrato VP-2026-0001');
      expect(el.textContent).toContain('Escolha pelo menos um animal primeiro');
    });

    it('contrato cancelado não prende o animal', () => {
      const f = abrir([{ ...contrato, situacao: 'CANCELADO', animais: [{ id: 'a1', nome: 'Thor', especie: 'cao', mensalidadeCentavos: 10000 }] }]);
      const caixas = Array.from((f.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input[type=checkbox]'));
      expect(caixas[0].disabled).toBe(false);
      expect(caixas[0].checked).toBe(true);
    });

    it('com o tutor na URL: marca o único animal elegível e bloqueia inativo e espécie não aceita', () => {
      const f = abrir();
      const el = f.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Maria da Silva');
      const caixas = Array.from(el.querySelectorAll<HTMLInputElement>('input[type=checkbox]'));
      expect(caixas.map((c) => c.checked)).toEqual([true, false, false]);
      expect(caixas.map((c) => c.disabled)).toEqual([false, true, true]);
      expect(el.textContent).toContain('Inativo');
      expect(el.textContent).toContain('Espécie não aceita');
      expect(el.textContent).toContain('1º animal');
      // só os planos ativos aparecem
      expect(Array.from(el.querySelectorAll('input[type=radio]')).length).toBe(2);
      expect(el.textContent).not.toContain('Antigo');
    });

    it('escolher o plano calcula o resumo no servidor e criar envia tutor, plano e animais', () => {
      const f = abrir();
      const el = f.nativeElement as HTMLElement;
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      expect(el.textContent).not.toContain('Resumo');

      (el.querySelectorAll<HTMLInputElement>('input[type=radio]')[0]).click();
      const sim = ctrl.expectOne('/api/contratos/simulacao');
      expect(sim.request.body).toEqual({ planoId: 'p1', animais: 1 });
      sim.flush({ mensalidadesCentavos: [10000], totalCentavos: 10000, descontoPercentual: 10 });
      f.detectChanges();
      expect(el.textContent).toContain('Resumo');
      expect(el.textContent).toContain('R$');
      expect(el.textContent).toContain('100,00');

      const criar = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Criar contrato')) as HTMLButtonElement;
      criar.click();
      const req = ctrl.expectOne('/api/contratos');
      expect(req.request.body).toEqual({ tutorId: 't1', planoId: 'p1', animais: ['a1'] });
      req.flush({ contrato: { ...contrato, id: 'c9' }, historico: [], transicoes: [] });
      expect(navegar).toHaveBeenCalledWith(['/contratos', 'c9'], { queryParams: { novo: 1 } });
    });

    it('sem tutor escolhido, animais e plano ficam bloqueados', () => {
      preparar();
      const f = TestBed.createComponent(ContratoNovo);
      f.detectChanges();
      ctrl.expectOne('/api/parametros').flush({ especiesAceitas: ['cao'], atrasoDiasSuspensao: 15, atrasoDiasAvisos: [], descontoSegundoAnimalPercentual: 0 });
      ctrl.expectOne('/api/planos').flush([]);
      f.detectChanges();
      const el = f.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Escolha o tutor primeiro');
      expect(el.textContent).toContain('Escolha pelo menos um animal primeiro');
      expect(el.querySelectorAll('.passo.bloqueado').length).toBe(2);
    });
  });

  describe('detalhe', () => {
    const detalhe = (situacao: string, rotulo: string, transicoes: unknown[]) => ({
      contrato: { ...contrato, situacao, situacaoRotulo: rotulo },
      historico: [{ de: null, para: 'Rascunho', motivo: 'Contrato criado', por: 'vet@clinica.com', quando: '2026-11-16T12:00:00Z' }],
      transicoes,
    });

    function abrir(d: ReturnType<typeof detalhe>) {
      preparar({ id: 'c1' });
      const f = TestBed.createComponent(Contrato);
      f.detectChanges();
      ctrl.expectOne('/api/contratos/c1').flush(d);
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

    it('passagem sem motivo é feita direto', () => {
      const f = abrir(detalhe('RASCUNHO', 'Rascunho', [{ situacao: 'AGUARDANDO_ASSINATURA', rotulo: 'Aguardando assinatura', exigeMotivo: false }]));
      const botao = Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Enviar para assinatura')) as HTMLButtonElement;
      botao.click();
      const req = ctrl.expectOne('/api/contratos/c1/situacao');
      expect(req.request.body).toEqual({ destino: 'AGUARDANDO_ASSINATURA', motivo: '' });
      req.flush(detalhe('AGUARDANDO_ASSINATURA', 'Aguardando assinatura', []));
      f.detectChanges();
      expect((f.nativeElement as HTMLElement).textContent).toContain('Aguardando assinatura');
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

    it('sem passagens permitidas não mostra o bloco de próximos passos', () => {
      const f = abrir(detalhe('CANCELADO', 'Cancelado', []));
      expect((f.nativeElement as HTMLElement).textContent).not.toContain('Próximos passos');
    });
  });
});
