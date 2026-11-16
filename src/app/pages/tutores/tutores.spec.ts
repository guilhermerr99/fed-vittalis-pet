import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Tutor } from './tutor';
import { TutorNovo } from './tutor-novo';
import { Tutores } from './tutores';

const animal = { id: 'a1', tutorId: 't1', nome: 'Thor', especie: 'cao', raca: 'SRD', sexo: 'M', nascimento: '2023-05-10', ativo: true };

describe('Tutores e animais', () => {
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 't1' }), queryParamMap: convertToParamMap({}) } } },
      ],
    });
    ctrl = TestBed.inject(HttpTestingController);
  });

  it('lista mostra tutor, CPF mascarado e os animais', () => {
    const f = TestBed.createComponent(Tutores);
    f.detectChanges();
    ctrl.expectOne((r) => r.url === '/api/tutores').flush({
      itens: [{ id: 't1', nome: 'Maria da Silva', cpfMascarado: '***.982.247-**', telefone: '11912345678', ativo: true, animais: [animal] }],
      pagina: 0,
      tamanho: 15,
      total: 1,
    });
    f.detectChanges();
    const t = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(t).toContain('Maria da Silva');
    expect(t).toContain('***.982.247-**');
    expect(t).toContain('(11) 91234-5678');
    expect(t).toContain('Thor · Cão');
    expect(t).toContain('1 tutores');
  });

  it('novo tutor: não envia com CPF inválido nem sem a ciência do aviso', () => {
    const f = TestBed.createComponent(TutorNovo);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const digitar = (id: string, v: string) => {
      const i = el.querySelector('#' + id) as HTMLInputElement;
      i.value = v;
      i.dispatchEvent(new Event('input'));
    };
    digitar('nome', 'Maria da Silva');
    digitar('cpf', '11111111111');
    digitar('telefone', '11912345678');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    f.detectChanges();
    ctrl.expectNone('/api/tutores');
    expect(el.textContent).toContain('CPF inválido');
    expect(el.textContent).toContain('ciência');
  });

  it('novo tutor: aplica as máscaras e envia os dados', () => {
    const f = TestBed.createComponent(TutorNovo);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const digitar = (id: string, v: string) => {
      const i = el.querySelector('#' + id) as HTMLInputElement;
      i.value = v;
      i.dispatchEvent(new Event('input'));
    };
    digitar('nome', 'Maria da Silva');
    digitar('cpf', '52998224725');
    digitar('telefone', '11912345678');
    expect((el.querySelector('#cpf') as HTMLInputElement).value).toBe('529.982.247-25');
    expect((el.querySelector('#telefone') as HTMLInputElement).value).toBe('(11) 91234-5678');
    const aviso = el.querySelector('#aviso') as HTMLInputElement;
    aviso.click();
    f.detectChanges();
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    const req = ctrl.expectOne('/api/tutores');
    expect(req.request.body).toEqual({
      nome: 'Maria da Silva',
      cpf: '529.982.247-25',
      telefone: '(11) 91234-5678',
      email: '',
      avisoDePrivacidadeCiente: true,
    });
    req.flush({ id: 't1' });
    expect(navegar).toHaveBeenCalledWith(['/tutores', 't1'], { queryParams: { novo: 1 } });
  });

  it('detalhe: mostra os dados e abre o cadastro de animal quando não há nenhum', () => {
    const f = TestBed.createComponent(Tutor);
    f.detectChanges();
    ctrl.expectOne('/api/parametros').flush({ especiesAceitas: ['cao', 'gato'], atrasoDiasSuspensao: 15, atrasoDiasAvisos: [], descontoSegundoAnimalPercentual: 0 });
    ctrl.expectOne('/api/tutores/t1').flush({
      id: 't1',
      nome: 'Maria da Silva',
      cpf: '52998224725',
      cpfFormatado: '529.982.247-25',
      telefone: '11912345678',
      lgpdConsentidoEm: '2026-11-16T12:00:00Z',
      ativo: true,
      animais: [],
    });
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.textContent).toContain('529.982.247-25');
    expect(el.textContent).toContain('Novo animal');
    expect(Array.from(el.querySelectorAll('#ae option')).map((o) => o.textContent?.trim())).toEqual(['Selecione', 'Cão', 'Gato']);
  });
});
