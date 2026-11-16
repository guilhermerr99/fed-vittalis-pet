import { cpfValido, emailValido, idadeEmTexto, mascaraCpf, mascaraTelefone, rotuloDaEspecie, telefoneValido } from './documentos';

describe('documentos', () => {
  it('máscara de CPF acompanha a digitação', () => {
    expect(mascaraCpf('5')).toBe('5');
    expect(mascaraCpf('52998')).toBe('529.98');
    expect(mascaraCpf('529982247')).toBe('529.982.247');
    expect(mascaraCpf('52998224725')).toBe('529.982.247-25');
    expect(mascaraCpf('529.982.247-25999')).toBe('529.982.247-25');
  });

  it('máscara de telefone aceita celular, fixo e +55', () => {
    expect(mascaraTelefone('11')).toBe('(11');
    expect(mascaraTelefone('11912345678')).toBe('(11) 91234-5678');
    expect(mascaraTelefone('1131234567')).toBe('(11) 3123-4567');
    expect(mascaraTelefone('+55 11 91234-5678')).toBe('(11) 91234-5678');
    expect(mascaraTelefone('')).toBe('');
  });

  it('CPF confere os dígitos verificadores', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('529.982.247-24')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cpfValido('123')).toBe(false);
  });

  it('telefone e e-mail', () => {
    expect(telefoneValido('(11) 91234-5678')).toBe(true);
    expect(telefoneValido('(11) 81234-5678')).toBe(false);
    expect(telefoneValido('91234-5678')).toBe(false);
    expect(emailValido('')).toBe(true);
    expect(emailValido('a@b.com')).toBe(true);
    expect(emailValido('sem-arroba')).toBe(false);
  });

  it('rótulo da espécie e idade', () => {
    expect(rotuloDaEspecie('cao')).toBe('Cão');
    expect(rotuloDaEspecie('coelho')).toBe('Coelho');
    const hoje = new Date(2026, 10, 16);
    expect(idadeEmTexto('2023-05-10', hoje)).toBe('3 anos e 6 meses');
    expect(idadeEmTexto('2026-10-20', hoje)).toBe('0 meses');
    expect(idadeEmTexto('2025-11-16', hoje)).toBe('1 ano');
  });
});
