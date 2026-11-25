import { Routes } from '@angular/router';
import { autenticadoGuard, perfilGuard, visitanteGuard } from './core/auth/guards';

/**
 * Áreas por perfil: veterinário (atendimento) e gestão (painel, usuários, auditoria e configurações). O portal do
 * tutor ainda não existe nesta versão.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'entrar' },
  {
    path: 'entrar',
    title: 'Entrar · Vittalis Pet',
    canActivate: [visitanteGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'senha',
    title: 'Alterar senha · Vittalis Pet',
    canActivate: [autenticadoGuard],
    loadComponent: () => import('./pages/senha/senha').then((m) => m.Senha),
  },
  {
    path: 'veterinario',
    title: 'Atendimento · Vittalis Pet',
    canActivate: [perfilGuard('VETERINARIO', 'GESTAO')],
    loadComponent: () => import('./pages/atendimento/atendimento').then((m) => m.TelaDeAtendimento),
  },
  {
    path: 'excecoes',
    title: 'Exceções · Vittalis Pet',
    canActivate: [perfilGuard('VETERINARIO', 'GESTAO')],
    loadComponent: () => import('./pages/excecoes/excecoes').then((m) => m.Excecoes),
  },
  {
    path: 'gestao',
    title: 'Painel · Vittalis Pet',
    canActivate: [perfilGuard('GESTAO')],
    loadComponent: () => import('./pages/painel/painel').then((m) => m.PainelDaGestao),
  },
  {
    path: 'usuarios',
    title: 'Usuários · Vittalis Pet',
    canActivate: [perfilGuard('GESTAO', 'ADMIN_TECNICO')],
    loadComponent: () => import('./pages/usuarios/usuarios').then((m) => m.Usuarios),
  },
  {
    path: 'auditoria',
    title: 'Auditoria · Vittalis Pet',
    canActivate: [perfilGuard('GESTAO')],
    loadComponent: () => import('./pages/auditoria/auditoria').then((m) => m.Auditoria),
  },
  {
    path: 'tutores',
    canActivate: [perfilGuard('VETERINARIO', 'GESTAO')],
    children: [
      {
        path: '',
        title: 'Tutores · Vittalis Pet',
        loadComponent: () => import('./pages/tutores/tutores').then((m) => m.Tutores),
      },
      {
        path: 'novo',
        title: 'Novo tutor · Vittalis Pet',
        loadComponent: () => import('./pages/tutores/tutor-novo').then((m) => m.TutorNovo),
      },
      {
        path: ':id',
        title: 'Tutor · Vittalis Pet',
        loadComponent: () => import('./pages/tutores/tutor').then((m) => m.Tutor),
      },
    ],
  },
  {
    path: 'nova-contratacao',
    title: 'Nova contratação · Vittalis Pet',
    canActivate: [perfilGuard('VETERINARIO', 'GESTAO')],
    loadComponent: () => import('./pages/contratos/contrato-novo').then((m) => m.ContratoNovo),
  },
  {
    path: 'contratos',
    canActivate: [perfilGuard('VETERINARIO', 'GESTAO')],
    children: [
      {
        path: '',
        title: 'Contratos · Vittalis Pet',
        loadComponent: () => import('./pages/contratos/contratos').then((m) => m.Contratos),
      },
      {
        path: ':id',
        title: 'Contrato · Vittalis Pet',
        loadComponent: () => import('./pages/contratos/contrato').then((m) => m.Contrato),
      },
    ],
  },
  {
    path: 'configuracoes',
    canActivate: [perfilGuard('GESTAO')],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'planos' },
      {
        path: 'planos',
        title: 'Planos e coberturas · Vittalis Pet',
        loadComponent: () => import('./pages/configuracoes/planos-e-coberturas').then((m) => m.PlanosECoberturas),
      },
      // As telas antigas viraram abas de "Planos e coberturas"; links e favoritos antigos continuam levando para lá.
      { path: 'procedimentos', pathMatch: 'full', redirectTo: 'planos' },
      { path: 'parametros', pathMatch: 'full', redirectTo: 'planos' },
      {
        path: 'cobertura',
        title: 'Importar cobertura · Vittalis Pet',
        loadComponent: () => import('./pages/configuracoes/cobertura').then((m) => m.Cobertura),
      },
      {
        path: 'contrato',
        title: 'Modelo do contrato · Vittalis Pet',
        loadComponent: () => import('./pages/configuracoes/contrato-modelo').then((m) => m.ModeloDoContratoPagina),
      },
    ],
  },
  { path: '**', redirectTo: 'entrar' },
];
