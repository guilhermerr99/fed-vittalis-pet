import { centavosParaCampo, reaisParaCentavos } from '../../shared/dinheiro';
import {
  MatrizDaConfiguracao,
  PacoteDeAlteracoes,
  Parametros,
  PlanoDoPacote,
  ProcedimentoDoPacote,
  RegraDaMatriz,
  RegraDoPacote,
} from './configuracoes.service';

/**
 * O rascunho da tela de configuração: cópia editável do que está gravado. Os campos de texto ficam como o usuário
 * digita ("89,90"); só ao montar o pacote viram números, e o que estiver errado vira uma frase para ele corrigir.
 */
export interface PlanoEmEdicao {
  id: string;
  nome: string;
  descricao: string;
  mensalidade: string;
  /** Código da espécie ("cao", "gato"…); vazio = qualquer espécie. */
  especie: string;
  ativo: boolean;
  novo: boolean;
}

export interface ProcedimentoEmEdicao {
  id: string;
  nome: string;
  categoria: string;
  preco: string;
  ativo: boolean;
  novo: boolean;
}

/** O procedimento é coberto (ou não) em um plano, com estes valores. */
export interface Celula {
  coberto: boolean;
  carencia: string;
  limite: string;
  copart: string;
  intervalo: string;
}

export interface GeraisEmEdicao {
  especies: string;
  suspensao: string;
  cancelamento: string;
  avisos: string;
  desconto: string;
  descontoTerceiro: string;
}

export interface Rascunho {
  planos: PlanoEmEdicao[];
  procedimentos: ProcedimentoEmEdicao[];
  /** Só as células que existem hoje ou que o usuário mexeu; célula ausente = não coberto. */
  celulas: Record<string, Celula>;
  gerais: GeraisEmEdicao;
}

export interface AnaliseDoRascunho {
  /** O que vai ao servidor: só o que mudou e está bem preenchido. */
  pacote: PacoteDeAlteracoes;
  /** Frases para o usuário corrigir antes de revisar. */
  erros: string[];
  /** Quantos itens mudaram em relação ao que está gravado (planos, procedimentos, células e regras gerais). */
  quantidade: number;
  /** Quem mudou, para a tela destacar: ids de planos e de procedimentos, e chaves de células. */
  mudados: { planos: Set<string>; procedimentos: Set<string>; celulas: Set<string> };
}

/** Valores sugeridos quando o usuário passa a cobrir um procedimento. */
export const CELULA_SUGERIDA: Celula = { coberto: true, carencia: '30', limite: '1', copart: '0,00', intervalo: '' };

export const chaveDaCelula = (planoId: string, procedimentoId: string): string => `${planoId}|${procedimentoId}`;

/** "0, 3, 7" → [0, 3, 7]; null se algum item não for inteiro não negativo. */
export function lerDias(texto: string): number[] | null {
  const partes = texto
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const numeros = partes.map((p) => (/^\d+$/.test(p) ? Number(p) : NaN));
  return numeros.some((n) => Number.isNaN(n)) ? null : numeros;
}

/** "12" → 12; null se não for um inteiro não negativo. */
export function inteiro(texto: string): number | null {
  const t = texto.trim();
  return /^\d{1,6}$/.test(t) ? Number(t) : null;
}

export function celulaDaRegra(r: RegraDaMatriz | undefined): Celula {
  return r
    ? {
        coberto: true,
        carencia: String(r.carenciaDias),
        limite: String(r.limiteAnual),
        copart: centavosParaCampo(r.coparticipacaoCentavos),
        intervalo: r.intervaloMinimoDias != null ? String(r.intervaloMinimoDias) : '',
      }
    : { ...CELULA_SUGERIDA, coberto: false };
}

export function geraisDe(p: Parametros): GeraisEmEdicao {
  const virgula = (n: number) => String(n).replace('.', ',');
  return {
    especies: p.especiesAceitas.join(', '),
    suspensao: String(p.atrasoDiasSuspensao),
    cancelamento: p.atrasoDiasCancelamento != null ? String(p.atrasoDiasCancelamento) : '',
    avisos: p.atrasoDiasAvisos.join(', '),
    desconto: virgula(p.descontoSegundoAnimalPercentual),
    descontoTerceiro: virgula(p.descontoTerceiroAnimalEmDiantePercentual ?? p.descontoSegundoAnimalPercentual),
  };
}

export function rascunhoDe(m: MatrizDaConfiguracao): Rascunho {
  const celulas: Record<string, Celula> = {};
  for (const r of m.regras) {
    celulas[chaveDaCelula(r.planoId, r.procedimentoId)] = celulaDaRegra(r);
  }
  return {
    planos: m.planos.map((p) => ({
      id: p.id,
      nome: p.nome,
      descricao: p.descricao ?? '',
      mensalidade: centavosParaCampo(p.mensalidadeCentavos),
      especie: p.especie ?? '',
      ativo: p.ativo,
      novo: false,
    })),
    procedimentos: m.procedimentos.map((p) => ({
      id: p.id,
      nome: p.nome,
      categoria: p.categoria ?? 'outros',
      preco: centavosParaCampo(p.precoParticularCentavos),
      ativo: p.ativo,
      novo: false,
    })),
    celulas,
    gerais: geraisDe(m.parametros),
  };
}

/** Lê os campos das regras gerais; devolve o valor ou uma frase de erro. */
export function lerGerais(g: GeraisEmEdicao): { valor?: Parametros; erro?: string } {
  const especies = g.especies
    .split(/[,;\n]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const avisos = lerDias(g.avisos);
  const suspensao = inteiro(g.suspensao);
  const cancelamento = g.cancelamento.trim() ? inteiro(g.cancelamento) : null;
  const desconto = Number(g.desconto.replace(',', '.'));
  const descontoTerceiro = Number(g.descontoTerceiro.replace(',', '.'));

  if (!especies.length) {
    return { erro: 'Regras gerais: informe ao menos uma espécie aceita, separadas por vírgula.' };
  }
  if (avisos == null) {
    return { erro: 'Regras gerais: os dias de aviso devem ser números separados por vírgula, por exemplo 0, 3, 7.' };
  }
  if (suspensao == null || suspensao < 1) {
    return { erro: 'Regras gerais: informe em quantos dias de atraso o contrato é suspenso (mínimo 1).' };
  }
  if (g.cancelamento.trim() && (cancelamento == null || cancelamento <= suspensao)) {
    return { erro: 'Regras gerais: o cancelamento automático deve vir depois da suspensão, ou ficar em branco.' };
  }
  if (!Number.isFinite(desconto) || desconto < 0 || desconto >= 100) {
    return { erro: 'Regras gerais: o desconto do segundo animal deve ficar entre 0 e menos de 100.' };
  }
  if (!Number.isFinite(descontoTerceiro) || descontoTerceiro < 0 || descontoTerceiro >= 100) {
    return { erro: 'Regras gerais: o desconto do terceiro animal em diante deve ficar entre 0 e menos de 100.' };
  }
  return {
    valor: {
      especiesAceitas: especies,
      atrasoDiasSuspensao: suspensao,
      atrasoDiasCancelamento: cancelamento,
      atrasoDiasAvisos: avisos,
      descontoSegundoAnimalPercentual: desconto,
      descontoTerceiroAnimalEmDiantePercentual: descontoTerceiro,
    },
  };
}

function mesmosParametros(a: Parametros, b: Parametros): boolean {
  const lista = (x: (string | number)[]) => JSON.stringify([...x].sort());
  return (
    lista(a.especiesAceitas) === lista(b.especiesAceitas) &&
    a.atrasoDiasSuspensao === b.atrasoDiasSuspensao &&
    (a.atrasoDiasCancelamento ?? null) === (b.atrasoDiasCancelamento ?? null) &&
    lista(a.atrasoDiasAvisos) === lista(b.atrasoDiasAvisos) &&
    a.descontoSegundoAnimalPercentual === b.descontoSegundoAnimalPercentual &&
    (a.descontoTerceiroAnimalEmDiantePercentual ?? a.descontoSegundoAnimalPercentual) ===
      (b.descontoTerceiroAnimalEmDiantePercentual ?? b.descontoSegundoAnimalPercentual)
  );
}

function valoresDaCelula(c: Celula): { carencia: number | null; limite: number | null; copart: number | null; intervalo: number | null | 'erro' } {
  const intervalo = c.intervalo.trim() ? inteiro(c.intervalo) : null;
  return {
    carencia: inteiro(c.carencia),
    limite: inteiro(c.limite),
    copart: reaisParaCentavos(c.copart.trim() ? c.copart : '0'),
    intervalo: c.intervalo.trim() && (intervalo == null || intervalo < 1) ? 'erro' : intervalo,
  };
}

/** Compara o rascunho com o que está gravado e monta o pacote só com o que mudou. */
export function analisarRascunho(base: MatrizDaConfiguracao, r: Rascunho, vigencia: string | null): AnaliseDoRascunho {
  const erros: string[] = [];
  const planos: PlanoDoPacote[] = [];
  const procedimentos: ProcedimentoDoPacote[] = [];
  const regras: RegraDoPacote[] = [];
  const mudados = { planos: new Set<string>(), procedimentos: new Set<string>(), celulas: new Set<string>() };
  let quantidade = 0;

  for (const p of r.planos) {
    const antes = base.planos.find((b) => b.id === p.id);
    const nome = p.nome.trim();
    const centavos = reaisParaCentavos(p.mensalidade);
    const mudou =
      !antes ||
      nome !== antes.nome ||
      p.descricao.trim() !== (antes.descricao ?? '') ||
      centavos !== antes.mensalidadeCentavos ||
      p.especie !== (antes.especie ?? '') ||
      p.ativo !== antes.ativo;
    if (!mudou) {
      continue;
    }
    quantidade++;
    mudados.planos.add(p.id);
    if (!nome) {
      erros.push('Um plano está sem nome.');
    } else if (centavos == null || centavos <= 0) {
      erros.push(`Plano ${nome}: informe uma mensalidade válida, por exemplo 89,90.`);
    } else {
      planos.push({ id: p.id, nome, descricao: p.descricao.trim(), mensalidadeCentavos: centavos, especie: p.especie, ativo: p.ativo });
    }
  }

  for (const p of r.procedimentos) {
    const antes = base.procedimentos.find((b) => b.id === p.id);
    const nome = p.nome.trim();
    const centavos = reaisParaCentavos(p.preco.trim() ? p.preco : '0');
    const categoria = p.categoria.trim() || 'outros';
    const mudou =
      !antes ||
      nome !== antes.nome ||
      categoria !== (antes.categoria ?? 'outros') ||
      centavos !== antes.precoParticularCentavos ||
      p.ativo !== antes.ativo;
    if (!mudou) {
      continue;
    }
    quantidade++;
    mudados.procedimentos.add(p.id);
    if (!nome) {
      erros.push('Um procedimento está sem nome.');
    } else if (centavos == null) {
      erros.push(`Procedimento ${nome}: informe um preço particular válido, por exemplo 120,00.`);
    } else {
      procedimentos.push({ id: p.id, nome, categoria, precoParticularCentavos: centavos, ativo: p.ativo });
    }
  }

  const regrasBase = new Map(base.regras.map((x) => [chaveDaCelula(x.planoId, x.procedimentoId), x]));
  const chaves = new Set([...regrasBase.keys(), ...Object.keys(r.celulas)]);
  for (const chave of chaves) {
    const [planoId, procedimentoId] = chave.split('|');
    const antes = celulaDaRegra(regrasBase.get(chave));
    const depois = r.celulas[chave] ?? antes;
    const nomeDe = () =>
      `${r.planos.find((p) => p.id === planoId)?.nome ?? 'Plano'} · ${r.procedimentos.find((p) => p.id === procedimentoId)?.nome ?? 'procedimento'}`;
    if (!depois.coberto) {
      if (antes.coberto) {
        quantidade++;
        mudados.celulas.add(chave);
        regras.push({ planoId, procedimentoId, coberto: false, carenciaDias: 0, limiteAnual: 0, coparticipacaoCentavos: 0, intervaloMinimoDias: null });
      }
      continue;
    }
    const v = valoresDaCelula(depois);
    const a = valoresDaCelula(antes);
    const mudou = !antes.coberto || v.carencia !== a.carencia || v.limite !== a.limite || v.copart !== a.copart || v.intervalo !== a.intervalo;
    if (!mudou) {
      continue;
    }
    quantidade++;
    mudados.celulas.add(chave);
    if (v.carencia == null || v.limite == null || v.copart == null || v.intervalo === 'erro') {
      erros.push(`${nomeDe()}: confira carência (dias), limite por ano (número), coparticipação (R$) e intervalo (dias, ou em branco).`);
    } else {
      regras.push({
        planoId,
        procedimentoId,
        coberto: true,
        carenciaDias: v.carencia,
        limiteAnual: v.limite,
        coparticipacaoCentavos: v.copart,
        intervaloMinimoDias: v.intervalo,
      });
    }
  }

  let parametros: Parametros | null = null;
  const lidos = lerGerais(r.gerais);
  if (lidos.erro) {
    // Só reclama se o usuário mexeu: campo inválido que ele não tocou não deve travar o resto.
    if (JSON.stringify(r.gerais) !== JSON.stringify(geraisDe(base.parametros))) {
      quantidade++;
      erros.push(lidos.erro);
    }
  } else if (lidos.valor && !mesmosParametros(lidos.valor, base.parametros)) {
    quantidade++;
    parametros = lidos.valor;
  }

  return { pacote: { planos, procedimentos, regras, parametros, vigenciaInicio: vigencia }, erros, quantidade, mudados };
}
