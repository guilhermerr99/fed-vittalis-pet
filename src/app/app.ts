import { Component, computed, inject, signal } from '@angular/core';
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
  { rotulo: 'Atendimento', rota: '/veterinario', icone: 'coracao', perfis: ['VETERINARIO', 'GESTAO'] },
  { rotulo: 'Nova contratação', rota: '/nova-contratacao', icone: 'mais', perfis: ['VETERINARIO', 'GESTAO'] },
  { rotulo: 'Contratos', rota: '/contratos', icone: 'contrato', perfis: ['VETERINARIO', 'GESTAO'] },
  { rotulo: 'Tutores e animais', rota: '/tutores', icone: 'pata', perfis: ['VETERINARIO', 'GESTAO'] },
  { rotulo: 'Exceções', rota: '/excecoes', icone: 'relogio', perfis: ['VETERINARIO', 'GESTAO'] },
  { rotulo: 'Painel', rota: '/gestao', icone: 'grafico', perfis: ['GESTAO'] },
  { rotulo: 'Planos e coberturas', rota: '/configuracoes/planos', icone: 'tabela', perfis: ['GESTAO'] },
  { rotulo: 'Modelo do contrato', rota: '/configuracoes/contrato', icone: 'contrato', perfis: ['GESTAO'] },
  { rotulo: 'Usuários', rota: '/usuarios', icone: 'usuarios', perfis: ['GESTAO', 'ADMIN_TECNICO'] },
  { rotulo: 'Auditoria', rota: '/auditoria', icone: 'escudo', perfis: ['GESTAO'] },
];

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icone],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
  host: {
    '(document:click)': 'fecharMenuFora($event)',
    '(document:keydown.escape)': 'menuAberto.set(false)',
  },
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly nomes = NOMES_DOS_PERFIS;

  /** Menu da conta (três pontinhos): alterar senha e sair. */
  protected readonly menuAberto = signal(false);
  /** Onde o menu abre quando sai do rodapé do menu lateral: à direita do cartão, alinhado à base dele. */
  protected readonly posicaoMenu = signal<{ left: number; bottom: number } | null>(null);

  protected alternarMenu(evento: Event): void {
    if (this.menuAberto()) {
      this.menuAberto.set(false);
      return;
    }
    const cartao = (evento.currentTarget as HTMLElement).closest('.rodape');
    if (cartao) {
      const r = cartao.getBoundingClientRect();
      this.posicaoMenu.set({ left: r.right + 8, bottom: window.innerHeight - r.bottom });
    } else {
      this.posicaoMenu.set(null);
    }
    this.menuAberto.set(true);
  }

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
    this.menuAberto.set(false);
    this.auth.sair();
  }

  /** Clique fora do menu da conta fecha o menu. */
  protected fecharMenuFora(evento: Event): void {
    if (this.menuAberto() && !(evento.target as HTMLElement).closest('.conta-menu')) {
      this.menuAberto.set(false);
    }
  }
}
