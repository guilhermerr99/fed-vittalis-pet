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
  /** Nome de quem cadastrou o contrato; vazio se o registro não guarda. */
  criadoPor?: string | null;
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
  /** Desconto do terceiro animal em diante (igual ao do segundo quando não há faixa própria). */
  descontoTerceiroEmDiantePercentual?: number;
}

export type SituacaoDaCobranca = 'PENDENTE' | 'PAGA' | 'RECUSADA' | 'CANCELADA';

export interface Cobranca {
  id: string;
  contratoId: string;
  competencia: string;
  valorCentavos: number;
  vencimento: string;
  situacao: SituacaoDaCobranca;
  situacaoRotulo: string;
  primeira: boolean;
  gateway: string;
  idNoGateway?: string | null;
  tentativas: number;
  forma?: string | null;
  formaRotulo?: string | null;
  motivoDaRecusa?: string | null;
  criadaEm: string;
  pagaEm?: string | null;
  recusadaEm?: string | null;
}

export interface Gateway {
  nome: string;
  simulacao: boolean;
}

export type SituacaoDaAssinatura = 'ENVIADA' | 'ASSINADA' | 'RECUSADA' | 'CANCELADA';

/** A mensagem que o sistema mandou (ou mandaria) ao tutor pelo WhatsApp da clínica. */
export interface MensagemAoTutor {
  texto: string;
  situacao: 'SIMULADA' | 'ENVIADA' | 'FALHOU';
  situacaoRotulo: string;
  canal: string;
  telefone: string;
  criadaEm: string;
}

export interface Assinatura {
  contratoId: string;
  provedor: string;
  /** Verdadeiro só com o provedor simulado: a equipe pode fazer de conta que o tutor assinou. */
  simulacao: boolean;
  situacao: SituacaoDaAssinatura;
  situacaoRotulo: string;
  link: string;
  enviadaEm: string;
  assinadaEm?: string | null;
  contratoSituacao: SituacaoDoContrato;
  mensagem: MensagemAoTutor | null;
}

export interface ProvedorDeAssinatura {
  nome: string;
  simulacao: boolean;
}

export function classeDaCobranca(situacao: string): string {
  switch (situacao) {
    case 'PAGA':
      return 'ok';
    case 'PENDENTE':
      return 'info';
    case 'RECUSADA':
      return 'bad';
    default:
      return '';
  }
}

@Injectable({ providedIn: 'root' })
export class ContratosService {
  private readonly http = inject(HttpClient);

  cobrancas(contratoId: string): Observable<Cobranca[]> {
    return this.http.get<Cobranca[]>('/api/cobrancas', { params: { contratoId } });
  }

  gateway(): Observable<Gateway> {
    return this.http.get<Gateway>('/api/cobrancas/gateway');
  }

  simularCobranca(id: string, resultado: 'APROVADA' | 'RECUSADA', motivo: string): Observable<Cobranca> {
    return this.http.post<Cobranca>(`/api/cobrancas/${id}/simular`, { resultado, motivo });
  }

  novaTentativa(id: string): Observable<Cobranca> {
    return this.http.post<Cobranca>(`/api/cobrancas/${id}/nova-tentativa`, {});
  }

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

  /** O PDF do contrato e do termo da LGPD, como vai para o tutor assinar. */
  documento(contratoId: string): Observable<Blob> {
    return this.http.get(`/api/contratos/${contratoId}/documento`, { responseType: 'blob' });
  }

  provedorDeAssinatura(): Observable<ProvedorDeAssinatura> {
    return this.http.get<ProvedorDeAssinatura>('/api/assinaturas/provedor');
  }

  /** Gera o PDF, cria o documento no provedor e manda o link ao tutor pelo WhatsApp. Repetir não duplica. */
  enviarParaAssinatura(contratoId: string): Observable<Assinatura> {
    return this.http.post<Assinatura>(`/api/contratos/${contratoId}/assinatura`, {});
  }

  assinatura(contratoId: string): Observable<Assinatura> {
    return this.http.get<Assinatura>(`/api/contratos/${contratoId}/assinatura`);
  }

  /** Pergunta ao provedor se o tutor já assinou; se assinou, o contrato segue para o pagamento. */
  conferirAssinatura(contratoId: string): Observable<Assinatura> {
    return this.http.post<Assinatura>(`/api/contratos/${contratoId}/assinatura/conferir`, {});
  }

  /** Só com o provedor simulado: faz de conta que o tutor assinou. */
  simularAssinatura(contratoId: string): Observable<Assinatura> {
    return this.http.post<Assinatura>(`/api/contratos/${contratoId}/assinatura/simular`, {});
  }

  simular(planoId: string, animais: number): Observable<Simulacao> {
    return this.http.post<Simulacao>('/api/contratos/simulacao', { planoId, animais });
  }
}
