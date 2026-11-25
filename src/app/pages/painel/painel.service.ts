import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface Indicadores {
  contratosAtivos: number;
  animaisCobertos: number;
  mensalidadeRecorrenteCentavos: number;
  receitaDoMesCentavos: number;
  aReceberNoMesCentavos: number;
  contratosEmAtraso: number;
  valorEmAtrasoCentavos: number;
  atendimentosNoMes: number;
  coparticipacaoPendenteCentavos: number;
}

export interface Fatia {
  chave: string;
  rotulo: string;
  valor: number;
}

export interface Ponto {
  mes: string;
  rotulo: string;
  valor: number;
}

/** Vendas de um dia (chave AAAA-MM-DD) ou de um mês (chave AAAA-MM). O valor é a mensalidade contratada. */
export interface VendaNoPeriodo {
  chave: string;
  rotulo: string;
  contratos: number;
  valorCentavos: number;
}

export interface VendaDePessoa {
  nome: string;
  contratos: number;
  valorCentavos: number;
}

export interface Vendas {
  contratosHoje: number;
  valorHojeCentavos: number;
  contratosNoMes: number;
  valorNoMesCentavos: number;
  porDia: VendaNoPeriodo[];
  porMes: VendaNoPeriodo[];
  porPessoaNoMes: VendaDePessoa[];
}

export interface Atencao {
  codigo: string;
  rotulo: string;
  quantidade: number;
  rota: string;
}

export interface Painel {
  indicadores: Indicadores;
  contratosPorSituacao: Fatia[];
  receitaPorMes: Ponto[];
  contratosAtivadosPorMes: Ponto[];
  vendas: Vendas;
  procedimentosMaisUsados: Fatia[];
  atencao: Atencao[];
  geradoEm: string;
}

@Injectable({ providedIn: 'root' })
export class PainelService {
  private readonly http = inject(HttpClient);

  consultar(): Observable<Painel> {
    return this.http.get<Painel>('/api/painel');
  }
}
