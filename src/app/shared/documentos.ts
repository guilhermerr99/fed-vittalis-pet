/** Máscaras e validações de documentos e contatos usados nos cadastros. */

export function soDigitos(texto: string | null | undefined): string {
  return (texto ?? '').replace(/\D/g, '');
}

/** "52998224725" → "529.982.247-25", enquanto a pessoa digita. */
export function mascaraCpf(texto: string): string {
  const d = soDigitos(texto).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

/** "11912345678" → "(11) 91234-5678"; aceita fixo de 10 dígitos. */
export function mascaraTelefone(texto: string): string {
  let d = soDigitos(texto);
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) {
    d = d.slice(2);
  }
  d = d.slice(0, 11);
  if (d.length <= 2) {
    return d ? `(${d}` : '';
  }
  const miolo = d.length > 10 ? 7 : 6;
  const base = `(${d.slice(0, 2)}) ${d.slice(2, miolo)}`;
  return d.length > miolo ? `${base}-${d.slice(miolo)}` : base;
}

/** Confere os dois dígitos verificadores, como o servidor faz. */
export function cpfValido(texto: string | null | undefined): boolean {
  const d = soDigitos(texto);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) {
    return false;
  }
  const digito = (n: number): number => {
    let soma = 0;
    for (let i = 0; i < n; i++) {
      soma += Number(d[i]) * (n + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

export function telefoneValido(texto: string | null | undefined): boolean {
  let d = soDigitos(texto);
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) {
    d = d.slice(2);
  }
  if (d.length !== 10 && d.length !== 11) {
    return false;
  }
  return d[0] !== '0' && d[1] !== '0' && (d.length === 10 || d[2] === '9');
}

export function emailValido(texto: string | null | undefined): boolean {
  const t = (texto ?? '').trim();
  return t === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t);
}

/** "cao" → "Cão"; o servidor guarda a espécie como código sem acento. */
export function rotuloDaEspecie(codigo: string): string {
  const conhecidos: Record<string, string> = { cao: 'Cão', gato: 'Gato' };
  return conhecidos[codigo] ?? codigo.charAt(0).toUpperCase() + codigo.slice(1);
}

/** Idade em texto a partir da data de nascimento (AAAA-MM-DD). */
export function idadeEmTexto(nascimento: string, hoje: Date = new Date()): string {
  const [a, m, d] = nascimento.split('-').map(Number);
  let meses = (hoje.getFullYear() - a) * 12 + (hoje.getMonth() + 1 - m);
  if (hoje.getDate() < d) {
    meses -= 1;
  }
  meses = Math.max(meses, 0);
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const partes: string[] = [];
  if (anos > 0) {
    partes.push(anos === 1 ? '1 ano' : `${anos} anos`);
  }
  if (resto > 0 || anos === 0) {
    partes.push(resto === 1 ? '1 mês' : `${resto} meses`);
  }
  return partes.join(' e ');
}
