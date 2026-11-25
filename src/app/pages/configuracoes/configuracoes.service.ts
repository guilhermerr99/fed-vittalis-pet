import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface Plano {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  mensalidadeCentavos: number;
  ativo: boolean;
  /** Código da espécie do plano ("cao", "gato"…); sem valor, vale para qualquer espécie aceita. */
  especie?: string | null;
}

export interface Procedimento {
  id: string;
  codigo: string;
  nome: string;
  categoria?: string;
  precoParticularCentavos: number;
  ativo: boolean;
}

export interface Regra {
  id: string;
  carenciaDias: number;
  limiteAnual: number;
  coparticipacaoCentavos: number;
  intervaloMinimoDias?: number;
  vigenciaInicio: string;
  vigenciaFim?: string;
}

export interface ItemDeCobertura {
  procedimento: Procedimento;
  regra?: Regra;
}

export interface Parametros {
  especiesAceitas: string[];
  atrasoDiasSuspensao: number;
  atrasoDiasCancelamento?: number | null;
  atrasoDiasAvisos: number[];
  descontoSegundoAnimalPercentual: number;
  /** Desconto do terceiro animal em diante; o servidor assume o do segundo quando não vem. */
  descontoTerceiroAnimalEmDiantePercentual?: number;
}

export interface ResultadoDasRotinas {
  linksExpirados: number;
  suspensos: number;
  cancelados: number;
  renovados: number;
  excecoesExpiradas: number;
  cobrancasGeradas: number;
  falhas: number;
}

export interface RegraResumo {
  carenciaDias: number;
  limiteAnual: number;
  coparticipacaoCentavos: number;
  intervaloMinimoDias?: number;
}

export interface ItemDaPrevia {
  linha: number;
  plano: string;
  procedimento: string;
  acao: 'NOVA' | 'ALTERADA' | 'IGUAL';
  antes?: RegraResumo;
  depois: RegraResumo;
}

export interface Previa {
  itens: ItemDaPrevia[];
  erros: { numero: number; mensagem: string }[];
  novas: number;
  alteradas: number;
  iguais: number;
}

/** Uma regra vigente na matriz: o procedimento é coberto no plano com estes valores. */
export interface RegraDaMatriz {
  planoId: string;
  procedimentoId: string;
  carenciaDias: number;
  limiteAnual: number;
  coparticipacaoCentavos: number;
  intervaloMinimoDias?: number | null;
  vigenciaInicio: string;
}

/** Tudo que a tela de configuração mostra, numa leitura só. */
export interface MatrizDaConfiguracao {
  planos: Plano[];
  procedimentos: Procedimento[];
  regras: RegraDaMatriz[];
  /** Contratos ativos, em atraso ou suspensos de cada plano (id do plano → quantidade). */
  contratosEmAndamento: Record<string, number>;
  parametros: Parametros;
}

export interface PlanoDoPacote {
  id: string;
  nome: string;
  descricao: string;
  mensalidadeCentavos: number;
  especie: string;
  ativo: boolean;
}

export interface ProcedimentoDoPacote {
  id: string;
  nome: string;
  categoria: string;
  precoParticularCentavos: number;
  ativo: boolean;
}

export interface RegraDoPacote {
  planoId: string;
  procedimentoId: string;
  coberto: boolean;
  carenciaDias: number;
  limiteAnual: number;
  coparticipacaoCentavos: number;
  intervaloMinimoDias: number | null;
}

/** O rascunho que a gestão montou: só o que mudou. */
export interface PacoteDeAlteracoes {
  planos: PlanoDoPacote[];
  procedimentos: ProcedimentoDoPacote[];
  regras: RegraDoPacote[];
  parametros: Parametros | null;
  vigenciaInicio: string | null;
}

export interface MudancaDescrita {
  /** "plano", "procedimento", "cobertura" ou "regras-gerais". */
  area: string;
  titulo: string;
  detalhe: string;
}

export interface RevisaoDaConfiguracao {
  mudancas: MudancaDescrita[];
  avisos: string[];
  bloqueios: string[];
  podeAplicar: boolean;
}

const CSV = { headers: { 'Content-Type': 'text/csv' } };

/** As três letras que o PDF traz; no editor cada trecho ainda pode usar outra. */
export type FamiliaDeFonte = 'SANS' | 'SERIF' | 'MONO';

export const FAMILIAS_DE_FONTE: { valor: FamiliaDeFonte; rotulo: string }[] = [
  { valor: 'SANS', rotulo: 'Sem serifa' },
  { valor: 'SERIF', rotulo: 'Com serifa' },
  { valor: 'MONO', rotulo: 'Monoespaçada' },
];

export interface ModeloDoContrato {
  /** 0 é o modelo padrão do sistema, ainda não publicado pela gestão. */
  versao: number;
  publicado: boolean;
  /** O contrato em HTML, como o editor produz. */
  html: string;
  familiaFonte: FamiliaDeFonte;
  tamanhoBase: number;
  revisado: boolean;
  criadoEm?: string | null;
  criadoPor?: string | null;
  nota?: string | null;
}

export interface VariavelDoContrato {
  nome: string;
  descricao: string;
  exemplo: string;
}

export interface ModeloEmUso {
  modelo: ModeloDoContrato;
  variaveis: VariavelDoContrato[];
}

export interface VersaoDoModelo {
  versao: number;
  criadoEm: string;
  criadoPor?: string | null;
  revisado: boolean;
  nota?: string | null;
}

export interface EntradaDoModelo {
  html: string;
  familiaFonte: FamiliaDeFonte;
  tamanhoBase: number;
  revisado: boolean;
  nota: string | null;
}

@Injectable({ providedIn: 'root' })
export class ConfiguracoesService {
  private readonly http = inject(HttpClient);

  // planos
  planos(): Observable<Plano[]> {
    return this.http.get<Plano[]>('/api/planos');
  }
  criarPlano(p: { nome: string; descricao: string; mensalidadeCentavos: number; especie: string }): Observable<Plano> {
    return this.http.post<Plano>('/api/planos', p);
  }
  alterarPlano(id: string, p: { nome: string; descricao: string; mensalidadeCentavos: number; especie: string }): Observable<Plano> {
    return this.http.put<Plano>(`/api/planos/${id}`, p);
  }
  situacaoDoPlano(id: string, ativo: boolean): Observable<Plano> {
    return this.http.patch<Plano>(`/api/planos/${id}/situacao`, { ativo });
  }

  // procedimentos
  procedimentos(): Observable<Procedimento[]> {
    return this.http.get<Procedimento[]>('/api/procedimentos');
  }
  criarProcedimento(p: { nome: string; categoria: string; precoParticularCentavos: number }): Observable<Procedimento> {
    return this.http.post<Procedimento>('/api/procedimentos', p);
  }
  alterarProcedimento(
    id: string,
    p: { nome: string; categoria: string; precoParticularCentavos: number },
  ): Observable<Procedimento> {
    return this.http.put<Procedimento>(`/api/procedimentos/${id}`, p);
  }
  situacaoDoProcedimento(id: string, ativo: boolean): Observable<Procedimento> {
    return this.http.patch<Procedimento>(`/api/procedimentos/${id}/situacao`, { ativo });
  }

  // cobertura
  cobertura(planoId: string): Observable<ItemDeCobertura[]> {
    return this.http.get<ItemDeCobertura[]>(`/api/planos/${planoId}/cobertura`);
  }

  // importação
  previaDaImportacao(csv: string): Observable<Previa> {
    return this.http.post<Previa>('/api/cobertura/importacao/previa', csv, CSV);
  }
  aplicarImportacao(csv: string, vigenciaInicio?: string | null): Observable<Previa> {
    let params = new HttpParams();
    if (vigenciaInicio) {
      params = params.set('vigenciaInicio', vigenciaInicio);
    }
    return this.http.post<Previa>('/api/cobertura/importacao/aplicar', csv, { ...CSV, params });
  }

  // tela única de configuração
  matriz(): Observable<MatrizDaConfiguracao> {
    return this.http.get<MatrizDaConfiguracao>('/api/configuracao/matriz');
  }
  revisarConfiguracao(pacote: PacoteDeAlteracoes): Observable<RevisaoDaConfiguracao> {
    return this.http.post<RevisaoDaConfiguracao>('/api/configuracao/revisao', pacote);
  }
  aplicarConfiguracao(pacote: PacoteDeAlteracoes): Observable<RevisaoDaConfiguracao> {
    return this.http.post<RevisaoDaConfiguracao>('/api/configuracao/aplicar', pacote);
  }

  // parâmetros
  parametros(): Observable<Parametros> {
    return this.http.get<Parametros>('/api/parametros');
  }
  salvarParametros(p: Parametros): Observable<Parametros> {
    return this.http.put<Parametros>('/api/parametros', p);
  }

  // rotinas automáticas
  executarRotinas(): Observable<ResultadoDasRotinas> {
    return this.http.post<ResultadoDasRotinas>('/api/rotinas/executar', {});
  }

  modeloDoContrato(): Observable<ModeloEmUso> {
    return this.http.get<ModeloEmUso>('/api/modelo-contrato');
  }

  versoesDoModelo(): Observable<VersaoDoModelo[]> {
    return this.http.get<VersaoDoModelo[]>('/api/modelo-contrato/versoes');
  }

  versaoDoModelo(versao: number): Observable<ModeloDoContrato> {
    return this.http.get<ModeloDoContrato>(`/api/modelo-contrato/versoes/${versao}`);
  }

  publicarModelo(modelo: EntradaDoModelo): Observable<ModeloDoContrato> {
    return this.http.put<ModeloDoContrato>('/api/modelo-contrato', modelo);
  }

  /** PDF do que está no editor, com dados de exemplo. Não publica. */
  previaDoModelo(modelo: EntradaDoModelo): Observable<Blob> {
    return this.http.post('/api/modelo-contrato/previa', modelo, { responseType: 'blob' });
  }
}
