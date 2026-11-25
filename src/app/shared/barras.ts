import { Component, computed, input } from '@angular/core';
import { formatarReais } from './dinheiro';

export interface BarraDoGrafico {
  rotulo: string;
  valor: number;
}

/**
 * Gráfico de colunas simples e acessível: cada coluna tem rótulo e valor em texto, e cresce quando aparece.
 * Sem biblioteca: são caixas com altura proporcional ao maior valor.
 */
@Component({
  selector: 'app-barras',
  template: `
    <div class="colunas" role="img" [attr.aria-label]="descricao()">
      @for (b of barras(); track b.rotulo; let i = $index) {
        <div class="coluna" [class.vazia]="b.valor === 0" [style.--atraso]="i * 60 + 'ms'" [attr.title]="b.rotulo + ': ' + completo(b.valor)">
          @if (valores()) {
            <span class="valor num">{{ texto(b.valor) }}</span>
          }
          <span class="haste" [style.height.%]="altura(b.valor)"></span>
          <span class="mes">{{ aparece(i) ? b.rotulo : '' }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    .colunas {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      height: 190px;
    }
    .coluna {
      flex: 1;
      min-width: 0;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: stretch;
      gap: 6px;
      text-align: center;
    }
    .valor {
      font-size: 12px;
      font-weight: 700;
      color: var(--ink-2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .haste {
      display: block;
      min-height: 4px;
      border-radius: 8px 8px 4px 4px;
      background: linear-gradient(180deg, var(--grafico-topo, var(--brand)), var(--grafico-base, var(--brand)));
      transform-origin: bottom;
      animation: crescer 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      animation-delay: var(--atraso, 0ms);
    }
    .vazia .haste {
      background: var(--line);
    }
    .mes {
      font-size: 12px;
      color: var(--ink-3);
      text-transform: capitalize;
    }
    @keyframes crescer {
      from {
        transform: scaleY(0);
        opacity: 0.4;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .haste {
        animation: none;
      }
    }
  `,
})
export class Barras {
  readonly barras = input.required<BarraDoGrafico[]>();
  readonly formato = input<'reais' | 'inteiro'>('inteiro');
  /** Falso em gráficos com muitas colunas: o valor só aparece ao apontar a coluna (título) e na descrição. */
  readonly valores = input(true);
  /** Mostra o rótulo de uma coluna a cada N, contando do fim (a última sempre aparece). */
  readonly rotuloACada = input(1);

  private readonly maximo = computed(() => Math.max(1, ...this.barras().map((b) => b.valor)));

  protected altura(valor: number): number {
    return valor === 0 ? 2 : Math.max(6, (valor / this.maximo()) * 72);
  }

  protected aparece(indice: number): boolean {
    return (this.barras().length - 1 - indice) % Math.max(1, this.rotuloACada()) === 0;
  }

  protected completo(valor: number): string {
    return this.formato() === 'reais' ? formatarReais(valor) : valor.toLocaleString('pt-BR');
  }

  protected texto(valor: number): string {
    if (this.formato() === 'reais') {
      // Em colunas estreitas, "R$ 1.234,00" não cabe: mostra reais inteiros.
      return valor === 0 ? '—' : formatarReais(Math.round(valor / 100) * 100).replace(',00', '');
    }
    return valor === 0 ? '—' : valor.toLocaleString('pt-BR');
  }

  protected descricao(): string {
    return this.barras()
      .map((b) => `${b.rotulo}: ${this.formato() === 'reais' ? formatarReais(b.valor) : b.valor}`)
      .join('; ');
  }
}
