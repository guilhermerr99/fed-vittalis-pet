export type Perfil = 'VETERINARIO' | 'GESTAO' | 'ADMIN_TECNICO';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  deveTrocarSenha: boolean;
  ultimoLoginEm?: string;
  criadoEm: string;
}

export interface Sessao {
  tokenAcesso: string;
  acessoExpiraEm: string;
  tokenRenovacao: string;
  renovacaoExpiraEm: string;
  usuario: Usuario;
}

/** Resposta de erro padronizada da API (RFC 7807). */
export interface ErroDaApi {
  status: number;
  codigo?: string;
  detail?: string;
  campos?: Record<string, string>;
}

export const NOMES_DOS_PERFIS: Record<Perfil, string> = {
  VETERINARIO: 'Veterinário',
  GESTAO: 'Gestão',
  ADMIN_TECNICO: 'Suporte técnico',
};

/** Tela inicial de cada perfil, para onde o login leva. */
export const INICIO_POR_PERFIL: Record<Perfil, string> = {
  VETERINARIO: '/veterinario',
  GESTAO: '/gestao',
  ADMIN_TECNICO: '/usuarios',
};
