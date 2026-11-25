import { Component, ElementRef, OnDestroy, effect, inject, input, signal } from '@angular/core';
import { formatarReais } from './dinheiro';

/** Mostra um número que "sobe" até o valor quando aparece, a não ser que a pessoa prefira menos movimento. */
@Component({
  selector: 'app-numero',
  template: `{{ texto() }}`,
})
export class Numero implements OnDestroy {
  readonly valor = input.required<number>();
  /** 'reais' formata centavos em R$; 'inteiro' mostra o número com separador de milhar. */
  readonly formato = input<'reais' | 'inteiro'>('inteiro');
  readonly duracao = input(900);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly atual = signal(0);
  private quadro = 0;
  private anterior = 0;

  constructor() {
    effect(() => {
      const alvo = this.valor();
      this.animar(alvo);
    });
  }

  protected texto(): string {
    const v = Math.round(this.atual());
    return this.formato() === 'reais' ? formatarReais(v) : v.toLocaleString('pt-BR');
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.quadro);
  }

  private animar(alvo: number): void {
    cancelAnimationFrame(this.quadro);
    const reduzido = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduzido || typeof requestAnimationFrame !== 'function' || !this.host.nativeElement.isConnected) {
      this.atual.set(alvo);
      this.anterior = alvo;
      return;
    }
    const de = this.anterior;
    const inicio = performance.now();
    const passo = (agora: number): void => {
      const t = Math.min(1, (agora - inicio) / this.duracao());
      const suave = 1 - Math.pow(1 - t, 3);
      this.atual.set(de + (alvo - de) * suave);
      if (t < 1) {
        this.quadro = requestAnimationFrame(passo);
      } else {
        this.anterior = alvo;
      }
    };
    this.quadro = requestAnimationFrame(passo);
  }
}
