import { SITUACOES } from '../contratos/contratos.service';

/** Uma informação do registro (rótulo + valor já formatado). */
export interface Linha {
  rotulo: string;
  valor: string;
}

/** Um campo que mudou: o que era e o que passou a ser. */
export interface Mudanca {
  rotulo: string;
  antes: string;
  depois: string;
  /** Verdadeiro quando o campo continua igual (aparece só para dar contexto). */
  igual: boolean;
}

export interface Detalhe {
  dados: Linha[];
  mudancas: Mudanca[];
}

const CAMPOS: Record<string, string> = {
  plano: 'Plano',
  procedimento: 'Procedimento',
  origem: 'Origem da regra',
  vigenciaInicio: 'Vale a partir de',
  vigenciaFim: 'Vigência até',
  carenciaDias: 'Carência (dias)',
  limiteAnual: 'Limite por ano',
  coparticipacaoCentavos: 'Coparticipação',
  intervaloMinimoDias: 'Intervalo mínimo (dias)',
  mensalidade: 'Mensalidade',
  mensalidadeCentavos: 'Mensalidade',
  precoParticularCentavos: 'Preço particular',
  numero: 'Contrato',
  contrato: 'Contrato',
  de: 'De',
  para: 'Para',
  animais: 'Animais',
  mensalidadeTotalCentavos: 'Mensalidade total',
  estado: 'Resultado',
  motivo: 'Motivo',
  usosNoPeriodo: 'Usos no período',
  coparticipacaoPendente: 'Coparticipação pendente',
  data: 'Dia',
  linksExpirados: 'Links expirados',
  suspensos: 'Contratos suspensos',
  cancelados: 'Contratos cancelados',
  renovados: 'Contratos renovados',
  excecoesExpiradas: 'Exceções expiradas',
  falhas: 'Falhas',
  cobrancasGeradas: 'Cobranças geradas',
  competencia: 'Mês de referência',
  forma: 'Forma de pagamento',
  primeira: 'Primeira cobrança',
  tentativa: 'Tentativa',
  nome: 'Nome',
  especie: 'Espécie',
  email: 'E-mail',
  perfil: 'Perfil',
  linhas: 'Linhas da planilha',
  aplicadas: 'Aplicadas',
  novas: 'Regras novas',
  alteradas: 'Regras alteradas',
};

const ESTADOS: Record<string, string> = {
  LIBERADO: 'Liberado',
  LIBERADO_COM_COPARTICIPACAO: 'Liberado com coparticipação',
  LIBERADO_POR_EXCECAO: 'Liberado por exceção',
  EM_CARENCIA: 'Em carência',
  LIMITE_ESGOTADO: 'Limite esgotado',
  CONTRATO_INATIVO: 'Contrato sem cobertura',
  NAO_COBERTO: 'Não coberto',
};

const MOTIVOS: Record<string, string> = {
  NENHUM: 'Nenhum',
  CONTRATO_INATIVO: 'Contrato sem cobertura',
  LIMITE_ANUAL_ESGOTADO: 'Limite anual esgotado',
  EM_CARENCIA: 'Em carência',
  CARENCIA_SUPERADA_POR_EXCECAO: 'Carência superada por exceção',
};

const FORMAS: Record<string, string> = {
  CARTAO: 'Cartão de crédito',
  PIX: 'Pix',
  MANUAL: 'Confirmado pela gestão',
  SIMULADO: 'Simulado',
};

const ORIGENS: Record<string, string> = {
  tela: 'Cadastro pela tela',
  planilha: 'Importação de planilha',
};

export const PERFIS: Record<string, string> = {
  VETERINARIO: 'Veterinário',
  GESTAO: 'Gestão',
  ADMIN_TECNICO: 'Administrador técnico',
};

const OBJETOS: Record<string, string> = {
  contrato: 'Contrato',
  animal: 'Animal',
  tutor: 'Tutor',
  atendimento: 'Atendimento',
  plano: 'Plano',
  procedimento: 'Procedimento',
  regra_plano: 'Regra de cobertura',
  excecao_carencia: 'Exceção de carência',
  cobranca: 'Cobrança',
  usuario: 'Usuário',
  parametro: 'Parâmetro',
};

export function rotuloDoObjeto(tipo?: string): string {
  return tipo ? (OBJETOS[tipo] ?? tipo) : '';
}

/** "limiteAnual" → "Limite anual" (para campos que o mapa não conhece). */
function humanizar(chave: string): string {
  const texto = chave.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function rotuloDe(chave: string): string {
  return CAMPOS[chave] ?? humanizar(chave);
}

/** Texto legível de um valor, conforme o campo a que pertence. */
export function formatar(valor: unknown, chave = ''): string {
  if (valor == null || valor === '') {
    return '—';
  }
  if (typeof valor === 'boolean') {
    return valor ? 'Sim' : 'Não';
  }
  if (Array.isArray(valor)) {
    return valor.map((v) => formatar(v, chave)).join(', ');
  }
  if (typeof valor === 'object') {
    return Object.entries(valor as Record<string, unknown>)
      .map(([k, v]) => `${rotuloDe(k)}: ${formatar(v, k)}`)
      .join(' · ');
  }
  if (typeof valor === 'number') {
    return chave.endsWith('Centavos') ? (valor / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : String(valor);
  }
  const texto = String(valor);
  if (chave === 'origem') {
    return ORIGENS[texto] ?? texto;
  }
  if (chave === 'de' || chave === 'para') {
    return SITUACOES.find((s) => s.valor === texto)?.rotulo ?? texto;
  }
  if (chave === 'estado') {
    return ESTADOS[texto] ?? texto;
  }
  if (chave === 'motivo') {
    return MOTIVOS[texto] ?? texto;
  }
  if (chave === 'forma') {
    return FORMAS[texto] ?? texto;
  }
  if (chave === 'perfil') {
    return PERFIS[texto] ?? texto;
  }
  const data = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (data) {
    return `${data[3]}/${data[2]}/${data[1]}`;
  }
  const mes = /^(\d{4})-(\d{2})$/.exec(texto);
  if (mes) {
    return `${mes[2]}/${mes[1]}`;
  }
  return texto;
}

function eObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Separa o que o registro guarda em duas partes: o que foi feito (dados soltos) e o que mudou (antes → depois).
 * Reconhece os três formatos do servidor: `antes`/`depois` (texto ou conjunto de campos), pares `campoAntes`/`campoDepois`
 * e, nos parâmetros, `parâmetro: {antes, depois}`.
 */
export function interpretar(acao: string, detalhes?: Record<string, unknown>): Detalhe {
  const dados: Linha[] = [];
  const mudancas: Mudanca[] = [];
  if (!detalhes) {
    return { dados, mudancas };
  }

  const pares = new Map<string, { antes?: unknown; depois?: unknown; centavos: boolean }>();
  const entradas = Object.entries(detalhes);

  for (const [chave, valor] of entradas) {
    // Parâmetros: cada chave é um parâmetro com {antes, depois}.
    if (acao === 'PARAMETRO_ALTERADO' && eObjeto(valor) && ('antes' in valor || 'depois' in valor)) {
      const antes = formatar(valor['antes']);
      const depois = formatar(valor['depois']);
      mudancas.push({ rotulo: humanizar(chave), antes, depois, igual: antes === depois });
      continue;
    }
    // antes / depois: um conjunto de campos (cobertura) ou um texto simples.
    if (chave === 'antes' || chave === 'depois') {
      continue;
    }
    // campoAntes / campoDepois (com ou sem "Centavos").
    const par = /^(.+?)(Antes|Depois)(Centavos)?$/.exec(chave);
    if (par) {
      const base = par[1] + (par[3] ?? '');
      const atual = pares.get(base) ?? { centavos: !!par[3] };
      atual[par[2] === 'Antes' ? 'antes' : 'depois'] = valor;
      pares.set(base, atual);
      continue;
    }
    dados.push({ rotulo: rotuloDe(chave), valor: formatar(valor, chave) });
  }

  if ('antes' in detalhes || 'depois' in detalhes) {
    const antes = detalhes['antes'];
    const depois = detalhes['depois'];
    const a = eObjeto(antes) ? antes : {};
    const d = eObjeto(depois) ? depois : {};
    if (!eObjeto(antes) && antes != null) {
      dados.push({ rotulo: 'Situação anterior', valor: String(antes).replace(/^./, (c) => c.toUpperCase()) });
    }
    if (!eObjeto(depois) && depois != null) {
      dados.push({ rotulo: 'Situação nova', valor: String(depois).replace(/^./, (c) => c.toUpperCase()) });
    }
    const campos = new Set([...Object.keys(a), ...Object.keys(d)]);
    for (const campo of campos) {
      const textoAntes = eObjeto(antes) ? formatar(a[campo], campo) : '—';
      const textoDepois = eObjeto(depois) ? formatar(d[campo], campo) : acao === 'COBERTURA_REMOVIDA' ? 'Removido' : '—';
      mudancas.push({ rotulo: rotuloDe(campo), antes: textoAntes, depois: textoDepois, igual: textoAntes === textoDepois });
    }
  }

  for (const [base, p] of pares) {
    const campo = base.replace(/Centavos$/, '');
    const chave = p.centavos ? `${campo}Centavos` : campo;
    const antes = formatar(p.antes, chave);
    const depois = formatar(p.depois, chave);
    if (antes !== depois) {
      mudancas.push({ rotulo: rotuloDe(chave), antes, depois, igual: false });
    }
  }

  // O que mudou vem primeiro; o que ficou igual fica no fim, só como contexto.
  mudancas.sort((x, y) => Number(x.igual) - Number(y.igual));
  return { dados, mudancas };
}
