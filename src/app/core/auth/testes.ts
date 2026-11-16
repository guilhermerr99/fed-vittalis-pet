import { Sessao, Usuario } from './auth.models';

/** Dados fictícios para os testes de autenticação. */
export function usuarioDeTeste(perfil: Usuario['perfil'] = 'VETERINARIO', extra: Partial<Usuario> = {}): Usuario {
  return {
    id: 'u-1',
    nome: 'Pessoa de Teste',
    email: 'teste@vittalis.local',
    perfil,
    ativo: true,
    deveTrocarSenha: false,
    criadoEm: '2026-11-16T10:00:00Z',
    ...extra,
  };
}

export function sessaoDeTeste(perfil: Usuario['perfil'] = 'VETERINARIO', sufixo = '1', extra: Partial<Usuario> = {}): Sessao {
  return {
    tokenAcesso: `acesso-${sufixo}`,
    acessoExpiraEm: '2026-11-16T10:30:00Z',
    tokenRenovacao: `renovacao-${sufixo}`,
    renovacaoExpiraEm: '2026-11-16T18:00:00Z',
    usuario: usuarioDeTeste(perfil, extra),
  };
}
