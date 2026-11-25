import { Editor, Node, mergeAttributes } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import StarterKit from '@tiptap/starter-kit';

/** Tabela de animais ou lista de carências: o sistema preenche com os dados de cada contrato. */
export const BlocoDoSistema = Node.create({
  name: 'blocoDoSistema',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      tipo: {
        default: 'animais',
        parseHTML: (el) => el.getAttribute('data-bloco'),
        renderHTML: (atributos) => ({ 'data-bloco': atributos['tipo'] }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-bloco]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes)];
  },
});

export const QuebraDePagina = Node.create({
  name: 'quebraDePagina',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  parseHTML() {
    return [{ tag: 'div[data-quebra]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-quebra': 'pagina' })];
  },
});

/** Cria o editor na folha. Só o que o PDF sabe desenhar: negrito, itálico, sublinhado, títulos, listas, tabelas, imagens, cores e as três letras. */
export function criarEditor(elemento: HTMLElement, aoMudar: () => void): Editor {
  return new Editor({
    element: elemento,
    extensions: [
      StarterKit.configure({ code: false, codeBlock: false, link: false, trailingNode: false, heading: { levels: [1, 2, 3] } }),
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({ inline: true, allowBase64: true }),
      TableKit.configure({ table: { resizable: false } }),
      BlocoDoSistema,
      QuebraDePagina,
    ],
    content: '',
    editorProps: { attributes: { class: 'texto-do-contrato', 'aria-label': 'Texto do contrato', spellcheck: 'true' } },
    onTransaction: aoMudar,
  });
}
