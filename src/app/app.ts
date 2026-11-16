import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NOMES_DOS_PERFIS, Perfil } from './core/auth/auth.models';
import { AuthService } from './core/auth/auth.service';
import { Icone } from './shared/icone';

interface ItemDeMenu {
  rotulo: string;
  rota: string;
  icone: string;
  perfis: Perfil[];
  /** Subitem de Configurações: aparece recuado. */
  sub?: boolean;
}

const MENU: ItemDeMenu[] = [
  { rotulo: 'Atendimento', rota: '/veterinario', icone: 'coracao', perfis: ['VETERINARIO'] },
  { rotulo: 'Painel', rota: '/gestao', icone: 'grafico', perfis: ['GESTAO'] },
  { rotulo: 'Planos', rota: '/configuracoes/planos', icone: 'etiqueta', perfis: ['GESTAO'] },
  { rotulo: 'Procedimentos', rota: '/configuracoes/procedimentos', icone: 'prancheta', perfis: ['GESTAO'] },
  { rotulo: 'Cobertura', rota: '/configuracoes/cobertura', icone: 'tabela', perfis: ['GESTAO'] },
  { rotulo: 'Parâmetros', rota: '/configuracoes/parametros', icone: 'ajustes', perfis: ['GESTAO'] },
  { rotulo: 'Usuários', rota: '/usuarios', icone: 'usuarios', perfis: ['GESTAO', 'ADMIN_TECNICO'] },
  { rotulo: 'Auditoria', rota: '/auditoria', icone: 'escudo', perfis: ['GESTAO'] },
];

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icone],
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

  /** Os itens de configuração ficam agrupados sob um título no menu. */
  protected readonly principais = computed(() => this.menu().filter((i) => !i.rota.startsWith('/configuracoes')));
  protected readonly configuracoes = computed(() => this.menu().filter((i) => i.rota.startsWith('/configuracoes')));

  protected iniciais(nome: string): string {
    return nome
      .split(/\s+/)
      .map((p) => p.replace(/[^\p{L}]/gu, ''))
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('');
  }

  protected sair(): void {
    this.auth.sair();
  }
}
