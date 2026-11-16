import { Pipe, PipeTransform } from '@angular/core';

/** Centavos inteiros → "R$ 1.234,50". O sistema só guarda e trafega centavos. */
export function formatarReais(centavos: number | null | undefined): string {
  if (centavos == null) {
    return '—';
  }
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** "35,00", "35.5" ou "1.234,50" → centavos, ou null se não for um valor válido. */
export function reaisParaCentavos(texto: string | number | null | undefined): number | null {
  if (texto == null) {
    return null;
  }
  let s = String(texto).replace('R$', '').replace(/\s/g, '').trim();
  if (!s) {
    return null;
  }
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/** Centavos → texto para um campo de edição ("35,00"). */
export function centavosParaCampo(centavos: number | null | undefined): string {
  return centavos == null ? '' : (centavos / 100).toFixed(2).replace('.', ',');
}

@Pipe({ name: 'reais' })
export class ReaisPipe implements PipeTransform {
  transform(centavos: number | null | undefined): string {
    return formatarReais(centavos);
  }
}
