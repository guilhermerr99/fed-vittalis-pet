import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Barra de passos do topo das telas em etapas (Atendimento, Nova contratação): uma barra fina por passo, com o rótulo
 * embaixo. Passos já cumpridos ficam escuros, o atual cinza e os próximos claros. O estilo (.passos) é global.
 */
@Component({
  selector: 'app-passos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
  template: `
    <ol class="passos" [attr.aria-label]="rotulo()">
      @for (item of itens(); track item; let i = $index) {
        <li [class.feito]="atual() > i + 1" [class.atual]="atual() === i + 1" [attr.aria-current]="atual() === i + 1 ? 'step' : null">
          <span class="barra"></span>
          <span class="rotulo">{{ i + 1 }}. {{ item }}</span>
        </li>
      }
    </ol>
  `,
})
export class Passos {
  /** Rótulos dos passos, na ordem. */
  readonly itens = input.required<string[]>();
  /** Passo atual, começando em 1. */
  readonly atual = input.required<number>();
  readonly rotulo = input('Etapas');
}
