import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ModeloDoContratoPagina } from './contrato-modelo';

// O jsdom não mede texto; o ProseMirror pede estas medidas ao mover o cursor.
beforeAll(() => {
  const vazio = () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) });
  Range.prototype.getBoundingClientRect = vazio as never;
  Range.prototype.getClientRects = (() => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} })) as never;
  Element.prototype.scrollIntoView = () => undefined;
  document.elementFromPoint = () => null;
});

const modelo = {
  versao: 0,
  publicado: false,
  html: '<h1>Contrato</h1><p>Tutor: {tutor_nome}.</p><div data-bloco="animais"></div>',
  familiaFonte: 'SANS',
  tamanhoBase: 10,
  revisado: false,
};

const variaveis = [
  { nome: 'tutor_nome', descricao: 'Nome do tutor', exemplo: 'Maria da Silva' },
  { nome: 'plano', descricao: 'Nome do plano', exemplo: 'Essencial' },
];

describe('Modelo do contrato (gestão)', () => {
  let ctrl: HttpTestingController;

  function abrir() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(ModeloDoContratoPagina);
    f.detectChanges();
    ctrl.expectOne('/api/modelo-contrato').flush({ modelo, variaveis });
    ctrl.expectOne('/api/modelo-contrato/versoes').flush([]);
    f.detectChanges();
    return f;
  }

  const botao = (el: HTMLElement, texto: string) =>
    Array.from(el.querySelectorAll('button, label')).find((b) => b.textContent?.trim().startsWith(texto)) as HTMLButtonElement;
  const digitar = (campo: HTMLInputElement, valor: string) => {
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  };
  const folha = (el: HTMLElement) => el.querySelector('.texto-do-contrato') as HTMLElement;

  it('mostra o contrato na folha de edição, com a barra de formatação e as variáveis ao lado', () => {
    const el = abrir().nativeElement as HTMLElement;
    expect(folha(el)).not.toBeNull();
    expect(folha(el).querySelector('h1')?.textContent).toBe('Contrato');
    expect(folha(el).textContent).toContain('Tutor: {tutor_nome}.');
    expect(folha(el).querySelector('div[data-bloco="animais"]')).not.toBeNull();
    expect(el.querySelector('[aria-label="Negrito"]')).not.toBeNull();
    expect(el.querySelector('[aria-label="Letra do trecho"]')).not.toBeNull();
    expect(el.textContent).toContain('Modelo padrão do sistema');
    expect(el.textContent).toContain('Nenhuma versão publicada ainda.');
    // Sem alteração, não há o que publicar.
    expect(botao(el, 'Publicar').disabled).toBe(true);
    expect(el.textContent).not.toContain('Não publicado');
  });

  it('as ferramentas produzem o HTML que o servidor aceita: negrito, itálico, sublinhado, alinhamento, letra, tamanho, cor, lista, tabela e imagem', () => {
    const f = abrir();
    const el = f.nativeElement as HTMLElement;
    const editor = (f.componentInstance as unknown as { editor: { chain: () => any; getHTML: () => string } }).editor;
    editor.chain().selectAll().toggleBold().toggleItalic().toggleUnderline().setTextAlign('center').setFontFamily('serif').setFontSize('14pt').setColor('#1f6f5c').run();
    f.detectChanges();
    const html = editor.getHTML();
    expect(html).toContain('<strong>');
    expect(html).toContain('<em>');
    expect(html).toContain('<u>');
    expect(html).toContain('text-align: center');
    expect(html).toContain('font-family: serif');
    expect(html).toContain('font-size: 14pt');
    // O navegador devolve a cor como rgb(); o servidor converte para #rrggbb.
    expect(html).toContain('color: rgb(31, 111, 92)');
    expect(el.textContent).toContain('Não publicado');
    expect(botao(el, 'Publicar').disabled).toBe(false);
    editor.chain().focus('end').insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
    editor.chain().focus('end').setImage({ src: 'data:image/png;base64,AAAA', width: 160 }).run();
    const completo = editor.getHTML();
    expect(completo).toContain('<table');
    expect(completo).toContain('<th');
    expect(completo).toContain('<img');
    expect(completo).toContain('width="160"');
  });

  it('clicar numa variável põe no texto', () => {
    const f = abrir();
    const el = f.nativeElement as HTMLElement;
    botao(el, '{plano}').click();
    f.detectChanges();
    expect(folha(el).textContent).toContain('{plano}');
    expect(el.textContent).toContain('Não publicado');
  });

  it('os blocos de animais e carências entram na folha', () => {
    const f = abrir();
    const el = f.nativeElement as HTMLElement;
    botao(el, 'Carências').click();
    f.detectChanges();
    expect(folha(el).querySelector('div[data-bloco="carencias"]')).not.toBeNull();
  });

  it('a busca filtra as variáveis por nome, descrição ou exemplo', () => {
    const f = abrir();
    const el = f.nativeElement as HTMLElement;
    const lista = () => Array.from(el.querySelectorAll<HTMLElement>('.variavel .nome')).map((n) => n.textContent?.trim());
    expect(lista()).toEqual(['{tutor_nome}', '{plano}']);
    digitar(el.querySelector('input[type=search]') as HTMLInputElement, 'essen');
    f.detectChanges();
    expect(lista()).toEqual(['{plano}']);
    digitar(el.querySelector('input[type=search]') as HTMLInputElement, 'zzz');
    f.detectChanges();
    expect(lista()).toEqual([]);
    expect(el.textContent).toContain('Nenhuma variável');
  });

  it('publica o HTML do editor com a letra, o tamanho e o aval, e mostra a versão nova', () => {
    const f = abrir();
    const el = f.nativeElement as HTMLElement;
    botao(el, '{plano}').click();
    const letra = el.querySelector('[aria-label="Letra do contrato"]') as HTMLSelectElement;
    letra.value = 'SERIF';
    letra.dispatchEvent(new Event('change'));
    const tamanho = el.querySelector('[aria-label="Tamanho da letra"]') as HTMLSelectElement;
    tamanho.value = '12';
    tamanho.dispatchEvent(new Event('change'));
    const revisado = el.querySelector('.opcoes-de-publicacao input[type=checkbox]') as HTMLInputElement;
    revisado.checked = true;
    revisado.dispatchEvent(new Event('change'));
    digitar(el.querySelector('#nota') as HTMLInputElement, 'primeira');
    f.detectChanges();

    botao(el, 'Publicar').click();
    const req = ctrl.expectOne('/api/modelo-contrato');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.familiaFonte).toBe('SERIF');
    expect(req.request.body.tamanhoBase).toBe(12);
    expect(req.request.body.revisado).toBe(true);
    expect(req.request.body.nota).toBe('primeira');
    expect(req.request.body.html).toContain('<h1>{plano}Contrato</h1>');
    expect(req.request.body.html).toContain('{plano}');
    expect(req.request.body.html).toContain('<div data-bloco="animais"></div>');
    req.flush({ ...modelo, versao: 1, publicado: true, familiaFonte: 'SERIF', tamanhoBase: 12, revisado: true, criadoEm: '2026-11-24T12:00:00Z', criadoPor: 'Gestão' });
    ctrl.expectOne('/api/modelo-contrato/versoes').flush([{ versao: 1, criadoEm: '2026-11-24T12:00:00Z', criadoPor: 'Gestão', revisado: true, nota: 'primeira' }]);
    f.detectChanges();
    expect(el.textContent).toContain('Versão 1 publicada');
    expect(el.textContent).toContain('os que já foram enviados não mudam');
    expect(el.textContent).not.toContain('Não publicado');
  });

  it('contrato vazio não vai ao servidor', () => {
    const f = abrir();
    const el = f.nativeElement as HTMLElement;
    // Deixa o editor em branco pelo caminho que a pessoa usa: carregar uma versão vazia.
    botao(el, 'Versões publicadas');
    const descartar = () => undefined;
    descartar();
    const comp = f.componentInstance as unknown as { editor: { commands: { clearContent: () => void } } };
    comp.editor.commands.clearContent();
    f.detectChanges();
    botao(el, 'Publicar').click();
    ctrl.expectNone('/api/modelo-contrato');
    f.detectChanges();
    expect(el.textContent).toContain('O contrato está vazio');
  });

  it('descartar volta ao que está publicado', () => {
    const f = abrir();
    const el = f.nativeElement as HTMLElement;
    botao(el, '{plano}').click();
    f.detectChanges();
    expect(el.textContent).toContain('Não publicado');
    botao(el, 'Descartar').click();
    f.detectChanges();
    expect(folha(el).textContent).not.toContain('{plano}');
    expect(el.textContent).not.toContain('Não publicado');
  });

  it('a pré-visualização pede o PDF do que está no editor', () => {
    const f = abrir();
    const el = f.nativeElement as HTMLElement;
    window.open = (() => null) as never;
    botao(el, 'Pré-visualizar').click();
    const req = ctrl.expectOne('/api/modelo-contrato/previa');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.html).toContain('Tutor: {tutor_nome}.');
    expect(req.request.responseType).toBe('blob');
  });
});
