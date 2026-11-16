import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface Animal {
  id: string;
  tutorId: string;
  nome: string;
  especie: string;
  raca?: string;
  sexo?: 'M' | 'F';
  nascimento: string;
  microchip?: string;
  ativo: boolean;
}

export interface ResumoDoTutor {
  id: string;
  nome: string;
  cpfMascarado: string;
  telefone: string;
  ativo: boolean;
  animais: Animal[];
}

export interface Tutor {
  id: string;
  nome: string;
  cpf: string;
  cpfFormatado: string;
  telefone: string;
  email?: string;
  lgpdConsentidoEm: string;
  ativo: boolean;
  animais: Animal[];
}

export interface Pagina<T> {
  itens: T[];
  pagina: number;
  tamanho: number;
  total: number;
}

export interface NovoTutor {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  avisoDePrivacidadeCiente: boolean;
}

export interface DadosDoAnimal {
  nome: string;
  especie: string;
  raca: string;
  sexo: string;
  nascimento: string;
  microchip: string;
}

@Injectable({ providedIn: 'root' })
export class TutoresService {
  private readonly http = inject(HttpClient);

  buscar(busca: string, pagina: number): Observable<Pagina<ResumoDoTutor>> {
    let params = new HttpParams().set('pagina', pagina).set('tamanho', 15);
    if (busca.trim()) {
      params = params.set('busca', busca.trim());
    }
    return this.http.get<Pagina<ResumoDoTutor>>('/api/tutores', { params });
  }

  consultar(id: string): Observable<Tutor> {
    return this.http.get<Tutor>(`/api/tutores/${id}`);
  }

  criar(t: NovoTutor): Observable<Tutor> {
    return this.http.post<Tutor>('/api/tutores', t);
  }

  alterar(id: string, t: { nome: string; telefone: string; email: string }): Observable<Tutor> {
    return this.http.put<Tutor>(`/api/tutores/${id}`, t);
  }

  cadastrarAnimal(tutorId: string, a: DadosDoAnimal): Observable<Animal> {
    return this.http.post<Animal>(`/api/tutores/${tutorId}/animais`, a);
  }

  alterarAnimal(animalId: string, a: DadosDoAnimal): Observable<Animal> {
    return this.http.put<Animal>(`/api/tutores/animais/${animalId}`, a);
  }

  situacaoDoAnimal(animalId: string, ativo: boolean): Observable<Animal> {
    return this.http.patch<Animal>(`/api/tutores/animais/${animalId}/situacao`, { ativo });
  }
}
