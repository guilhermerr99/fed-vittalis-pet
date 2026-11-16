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

export interface RegraParaSalvar {
  carenciaDias: number;
  limiteAnual: number;
  coparticipacaoCentavos: number;
  intervaloMinimoDias?: number | null;
  vigenciaInicio?: string | null;
}

export interface Parametros {
  especiesAceitas: string[];
  atrasoDiasSuspensao: number;
  atrasoDiasCancelamento?: number | null;
  atrasoDiasAvisos: number[];
  descontoSegundoAnimalPercentual: number;
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

const CSV = { headers: { 'Content-Type': 'text/csv' } };

@Injectable({ providedIn: 'root' })
export class ConfiguracoesService {
  private readonly http = inject(HttpClient);

  // planos
  planos(): Observable<Plano[]> {
    return this.http.get<Plano[]>('/api/planos');
  }
  criarPlano(p: { nome: string; descricao: string; mensalidadeCentavos: number }): Observable<Plano> {
    return this.http.post<Plano>('/api/planos', p);
  }
  alterarPlano(id: string, p: { nome: string; descricao: string; mensalidadeCentavos: number }): Observable<Plano> {
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
  historico(planoId: string, procedimentoId: string): Observable<Regra[]> {
    return this.http.get<Regra[]>(`/api/planos/${planoId}/cobertura/${procedimentoId}/historico`);
  }
  definirRegra(planoId: string, procedimentoId: string, r: RegraParaSalvar): Observable<{ regra?: Regra; alterou: boolean }> {
    return this.http.put<{ regra?: Regra; alterou: boolean }>(`/api/planos/${planoId}/cobertura/${procedimentoId}`, r);
  }
  removerRegra(planoId: string, procedimentoId: string): Observable<void> {
    return this.http.delete<void>(`/api/planos/${planoId}/cobertura/${procedimentoId}`);
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

  // parâmetros
  parametros(): Observable<Parametros> {
    return this.http.get<Parametros>('/api/parametros');
  }
  salvarParametros(p: Parametros): Observable<Parametros> {
    return this.http.put<Parametros>('/api/parametros', p);
  }
}
