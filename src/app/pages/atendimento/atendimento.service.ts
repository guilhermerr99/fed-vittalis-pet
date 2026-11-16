import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Pagina } from '../tutores/tutores.service';

export type EstadoDoProcedimento =
  | 'LIBERADO'
  | 'LIBERADO_COM_COPARTICIPACAO'
  | 'LIBERADO_POR_EXCECAO'
  | 'EM_CARENCIA'
  | 'LIMITE_ESGOTADO'
  | 'CONTRATO_INATIVO'
  | 'NAO_COBERTO';

export type SituacaoDaExcecao = 'SOLICITADA' | 'APROVADA' | 'RECUSADA' | 'USADA' | 'EXPIRADA';

export const SITUACOES_DA_EXCECAO: { valor: SituacaoDaExcecao; rotulo: string }[] = [
  { valor: 'SOLICITADA', rotulo: 'Aguardando a gestão' },
  { valor: 'APROVADA', rotulo: 'Aprovada' },
  { valor: 'USADA', rotulo: 'Usada' },
  { valor: 'RECUSADA', rotulo: 'Recusada' },
  { valor: 'EXPIRADA', rotulo: 'Expirada' },
];

/** Cor do estado: verde liberado, amarelo carência, vermelho sem cobertura; o resto fica neutro. */
export function classeDoEstado(estado: string): string {
  switch (estado) {
    case 'LIBERADO':
    case 'LIBERADO_COM_COPARTICIPACAO':
    case 'LIBERADO_POR_EXCECAO':
      return 'ok';
    case 'EM_CARENCIA':
      return 'warn';
    case 'LIMITE_ESGOTADO':
    case 'CONTRATO_INATIVO':
      return 'bad';
    default:
      return '';
  }
}

export function classeDaExcecao(situacao: string): string {
  switch (situacao) {
    case 'APROVADA':
      return 'ok';
    case 'SOLICITADA':
      return 'info';
    case 'RECUSADA':
      return 'bad';
    default:
      return '';
  }
}

export interface AnimalDaFicha {
  id: string;
  tutorId: string;
  nome: string;
  especie: string;
  raca?: string | null;
  sexo?: string | null;
  nascimento: string;
  microchip?: string | null;
}

export interface ContratoDaFicha {
  id: string;
  numero: string;
  situacao: string;
  situacaoRotulo: string;
  planoNome: string;
  ativadoEm?: string | null;
  vigenciaFim?: string | null;
  inicioCarencia?: string | null;
  autoriza: boolean;
}

export interface ProcedimentoDaFicha {
  procedimentoId: string;
  nome: string;
  categoria: string;
  precoParticularCentavos: number;
  estado: EstadoDoProcedimento;
  estadoRotulo: string;
  liberado: boolean;
  coberto: boolean;
  carenciaDias?: number | null;
  limiteAnual?: number | null;
  usosNoPeriodo: number;
  coparticipacaoCentavos: number;
  liberacaoEm?: string | null;
  excecao?: { id: string; situacao: SituacaoDaExcecao; situacaoRotulo: string; data: string } | null;
}

export interface Atendimento {
  id: string;
  animalId: string;
  animalNome?: string | null;
  procedimentoId: string;
  procedimentoNome: string;
  data: string;
  situacao: 'AUTORIZADO' | 'CONCLUIDO' | 'CANCELADO';
  situacaoRotulo: string;
  decisao: string;
  coparticipacaoCentavos: number;
  coparticipacaoPaga?: boolean | null;
  coparticipacaoPendente: boolean;
  usosNoPeriodo: number;
  limiteAnual: number;
  porExcecao: boolean;
  observacao?: string | null;
  motivoDoCancelamento?: string | null;
  criadoPor?: string | null;
  criadoEm: string;
  concluidoEm?: string | null;
}

export interface Ficha {
  animal: AnimalDaFicha;
  tutor: { id: string; nome: string; telefone: string };
  contrato: ContratoDaFicha | null;
  procedimentos: ProcedimentoDaFicha[];
  abertos: Atendimento[];
  recentes: Atendimento[];
}

export interface Excecao {
  id: string;
  animalId: string;
  animalNome?: string | null;
  procedimentoId: string;
  procedimentoNome: string;
  data: string;
  justificativa: string;
  situacao: SituacaoDaExcecao;
  situacaoRotulo: string;
  solicitadaPor?: string | null;
  solicitadaEm: string;
  decididaPor?: string | null;
  decididaEm?: string | null;
  motivoDaDecisao?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AtendimentoService {
  private readonly http = inject(HttpClient);

  ficha(animalId: string): Observable<Ficha> {
    return this.http.get<Ficha>(`/api/atendimentos/animal/${animalId}`);
  }

  autorizar(animalId: string, procedimentoId: string): Observable<Atendimento> {
    return this.http.post<Atendimento>('/api/atendimentos', { animalId, procedimentoId });
  }

  concluir(id: string, coparticipacaoPaga: boolean | null): Observable<Atendimento> {
    return this.http.post<Atendimento>(`/api/atendimentos/${id}/concluir`, { coparticipacaoPaga });
  }

  cancelar(id: string, motivo: string): Observable<Atendimento> {
    return this.http.post<Atendimento>(`/api/atendimentos/${id}/cancelar`, { motivo });
  }

  quitarCoparticipacao(id: string): Observable<Atendimento> {
    return this.http.post<Atendimento>(`/api/atendimentos/${id}/coparticipacao/quitar`, {});
  }

  excecoes(filtro: { situacao: string; pagina: number }): Observable<Pagina<Excecao>> {
    let params = new HttpParams().set('pagina', filtro.pagina).set('tamanho', 15);
    if (filtro.situacao) {
      params = params.set('situacao', filtro.situacao);
    }
    return this.http.get<Pagina<Excecao>>('/api/excecoes', { params });
  }

  solicitarExcecao(animalId: string, procedimentoId: string, justificativa: string, data: string): Observable<Excecao> {
    return this.http.post<Excecao>('/api/excecoes', { animalId, procedimentoId, justificativa, data: data || null });
  }

  aprovarExcecao(id: string, motivo: string): Observable<Excecao> {
    return this.http.post<Excecao>(`/api/excecoes/${id}/aprovar`, { motivo });
  }

  recusarExcecao(id: string, motivo: string): Observable<Excecao> {
    return this.http.post<Excecao>(`/api/excecoes/${id}/recusar`, { motivo });
  }
}
