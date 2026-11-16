import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Perfil, Usuario } from '../../core/auth/auth.models';

export interface NovoUsuario {
  nome: string;
  email: string;
  perfil: Perfil;
  senhaInicial: string;
}

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);

  listar(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>('/api/usuarios');
  }

  criar(novo: NovoUsuario): Observable<Usuario> {
    return this.http.post<Usuario>('/api/usuarios', novo);
  }

  alterarSituacao(id: string, ativo: boolean): Observable<Usuario> {
    return this.http.patch<Usuario>(`/api/usuarios/${id}/situacao`, { ativo });
  }
}
