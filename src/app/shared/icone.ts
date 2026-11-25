import { Component, input } from '@angular/core';

/** Caminhos dos ícones (traço de 1,75 px, estilo do protótipo). */
const CAMINHOS: Record<string, string> = {
  coracao:
    'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  grafico: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  escudo: 'M12 3l8 3v6c0 4.5-3.2 8.2-8 9.5C7.2 20.2 4 16.5 4 12V6l8-3z M9 12l2 2 4-4',
  usuarios:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8',
  engrenagem:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  prancheta: 'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z M8 6H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2 M8 12h8 M8 16h5',
  etiqueta: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z M7.5 7.5h.01',
  tabela: 'M3 5h18v14H3z M3 10h18 M9 5v14',
  ajustes: 'M4 6h10 M18 6h2 M4 12h4 M12 12h8 M4 18h12 M20 18h0 M16 4v4 M10 10v4 M18 16v4',
  sair: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  chave: 'M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
  mais: 'M12 5v14 M5 12h14',
  caneta: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
  relogio: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
  seta: 'M5 12h14 M13 6l6 6-6 6',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
  pata: 'M12 12.5c-2.6 0-5 2.2-5 4.6 0 1.6 1.2 2.4 2.6 2.4.9 0 1.5-.4 2.4-.4s1.5.4 2.4.4c1.4 0 2.6-.8 2.6-2.4 0-2.4-2.4-4.6-5-4.6z M5 10.5a1.6 2.1 0 1 0 3.2 0 1.6 2.1 0 1 0-3.2 0 M9 6.5a1.6 2.1 0 1 0 3.2 0 1.6 2.1 0 1 0-3.2 0 M13 6.5a1.6 2.1 0 1 0 3.2 0 1.6 2.1 0 1 0-3.2 0 M16.8 10.5a1.6 2.1 0 1 0 3.2 0 1.6 2.1 0 1 0-3.2 0',
  contrato: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M9 13h6 M9 17h4',
  olho: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  olhoFechado: 'M3 3l18 18 M10.6 5.1A9.7 9.7 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 4 M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4.4-1',
  visto: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18 M6 6l12 12',
  maisOpcoes: 'M12 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M12 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16v-4 M12 8h.01',
  setaEsq: 'M19 12H5 M11 6l-6 6 6 6',
  cartao: 'M3 6h18v12H3z M3 10h18 M7 15h3',
  celular: 'M8 2h8a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z M11 18h2',
  lixeira: 'M3 6h18 M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
};

@Component({
  selector: 'app-icone',
  template: `<svg
    [attr.width]="tamanho()"
    [attr.height]="tamanho()"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path [attr.d]="caminho()" />
  </svg>`,
  styles: ':host{display:inline-flex;flex:none}',
})
export class Icone {
  readonly nome = input.required<string>();
  readonly tamanho = input(20);

  protected caminho(): string {
    return CAMINHOS[this.nome()] ?? '';
  }
}
