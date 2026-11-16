import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Pagina } from '../tutores/tutores.service';

export type SituacaoDoContrato =
  | 'RASCUNHO'
  | 'AGUARDANDO_ASSINATURA'
  | 'AGUARDANDO_PAGAMENTO'
  | 'ATIVO'
  | 'EM_ATRASO'
  | 'SUSPENSO'
  | 'CANCELADO'
  | 'EXPIRADO';

export const SITUACOES: { valor: SituacaoDoContrato; rotulo: string }[] = [
  { valor: 'RASCUNHO', rotulo: 'Rascunho' },
  { valor: 'AGUARDANDO_ASSINATURA', rotulo: 'Aguardando assinatura' },
  { valor: 'AGUARDANDO_PAGAMENTO', rotulo: 'Aguardando pagamento' },
  { valor: 'ATIVO', rotulo: 'Ativo' },
  { valor: 'EM_ATRASO', rotulo: 'Em atraso' },
  { valor: 'SUSPENSO', rotulo: 'Suspenso' },
  { valor: 'CANCELADO', rotulo: 'Cancelado' },
  { valor: 'EXPIRADO', rotulo: 'Expirado' },
];

/** Cor da situação no chip: só o estado carrega cor (verde ativo, azul em andamento, amarelo atraso, vermelho suspenso). */
export function classeDaSituacao(situacao: string): string {
  switch (situacao) {
    case 'ATIVO':
      return 'ok';
    case 'AGUARDANDO_ASSINATURA':
    case 'AGUARDANDO_PAGAMENTO':
      return 'info';
    case 'EM_ATRASO':
      return 'warn';
    case 'SUSPENSO':
      return 'bad';
    default:
      return '';
  }
}

export interface TutorDoContrato {
  id: string;
  nome: string;
  telefone: string;
  cpfMascarado: string;
}

export interface AnimalDoContrato {
  id: string;
  nome: string | null;
  especie: string | null;
  raca?: string | null;
  mensalidadeCentavos: number;
  inicioCarencia?: string | null;
}

export interface Contrato {
  id: string;
  numero: string;
  situacao: SituacaoDoContrato;
  situacaoRotulo: string;
  tutor: TutorDoContrato | null;
  planoId: string;
  planoNome: string;
  planoMensalidadeCentavos: number;
  descontoPercentual: number;
  animais: AnimalDoContrato[];
  mensalidadeTotalCentavos: number;
  dataContratacao: string;
  expiraEm?: string | null;
  ativadoEm?: string | null;
  vigenciaFim?: string | null;
  criadoEm: string;
}

export interface Mudanca {
  de: string | null;
  para: string;
  motivo?: string | null;
  por?: string | null;
  quando: string;
}

export interface Transicao {
  situacao: SituacaoDoContrato;
  rotulo: string;
  exigeMotivo: boolean;
}

export interface DetalheDoContrato {
  contrato: Contrato;
  historico: Mudanca[];
  transicoes: Transicao[];
}

export interface Simulacao {
  mensalidadesCentavos: number[];
  totalCentavos: number;
  descontoPercentual: number;
}

@Injectable({ providedIn: 'root' })
export class ContratosService {
  private readonly http = inject(HttpClient);

  listar(filtro: { situacao: string; busca: string; pagina: number; tutorId?: string; tamanho?: number }): Observable<Pagina<Contrato>> {
    let params = new HttpParams().set('pagina', filtro.pagina).set('tamanho', filtro.tamanho ?? 15);
    if (filtro.situacao) {
      params = params.set('situacao', filtro.situacao);
    }
    if (filtro.tutorId) {
      params = params.set('tutorId', filtro.tutorId);
    }
    if (filtro.busca.trim()) {
      params = params.set('busca', filtro.busca.trim());
    }
    return this.http.get<Pagina<Contrato>>('/api/contratos', { params });
  }

  consultar(id: string): Observable<DetalheDoContrato> {
    return this.http.get<DetalheDoContrato>(`/api/contratos/${id}`);
  }

  criar(tutorId: string, planoId: string, animais: string[]): Observable<DetalheDoContrato> {
    return this.http.post<DetalheDoContrato>('/api/contratos', { tutorId, planoId, animais });
  }

  mudarSituacao(id: string, destino: SituacaoDoContrato, motivo: string): Observable<DetalheDoContrato> {
    return this.http.post<DetalheDoContrato>(`/api/contratos/${id}/situacao`, { destino, motivo });
  }

  simular(planoId: string, animais: number): Observable<Simulacao> {
    return this.http.post<Simulacao>('/api/contratos/simulacao', { planoId, animais });
  }
}
