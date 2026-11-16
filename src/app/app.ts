import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NOMES_DOS_PERFIS, Perfil } from './core/auth/auth.models';
import { AuthService } from './core/auth/auth.service';

interface ItemDeMenu {
  rotulo: string;
  rota: string;
  perfis: Perfil[];
}

const MENU: ItemDeMenu[] = [
  { rotulo: 'Atendimento', rota: '/veterinario', perfis: ['VETERINARIO'] },
  { rotulo: 'Painel', rota: '/gestao', perfis: ['GESTAO'] },
  { rotulo: 'Usuários', rota: '/usuarios', perfis: ['GESTAO', 'ADMIN_TECNICO'] },
  { rotulo: 'Auditoria', rota: '/auditoria', perfis: ['GESTAO'] },
];

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly nomes = NOMES_DOS_PERFIS;

  /** Só mostra os itens que o perfil logado pode abrir. */
  protected readonly menu = computed(() => {
    const perfil = this.auth.perfil();
    return perfil ? MENU.filter((i) => i.perfis.includes(perfil)) : [];
  });

  protected sair(): void {
    this.auth.sair();
  }
}
