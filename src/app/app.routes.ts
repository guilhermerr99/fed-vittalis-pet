import { Routes } from '@angular/router';
import { autenticadoGuard, perfilGuard, visitanteGuard } from './core/auth/guards';

/**
 * Áreas por perfil: veterinário (atendimento), gestão (painel, usuários e auditoria) e cliente (portal do
 * tutor, com acesso próprio, ainda sem login nesta versão).
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
    title: 'Veterinário · Vittalis Pet',
    canActivate: [perfilGuard('VETERINARIO')],
    loadComponent: () => import('./areas/veterinario').then((m) => m.Veterinario),
  },
  {
    path: 'gestao',
    title: 'Gestão · Vittalis Pet',
    canActivate: [perfilGuard('GESTAO')],
    loadComponent: () => import('./areas/gestao').then((m) => m.Gestao),
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
        title: 'Planos · Vittalis Pet',
        loadComponent: () => import('./pages/configuracoes/planos').then((m) => m.Planos),
      },
      {
        path: 'procedimentos',
        title: 'Procedimentos · Vittalis Pet',
        loadComponent: () => import('./pages/configuracoes/procedimentos').then((m) => m.Procedimentos),
      },
      {
        path: 'cobertura',
        title: 'Cobertura · Vittalis Pet',
        loadComponent: () => import('./pages/configuracoes/cobertura').then((m) => m.Cobertura),
      },
      {
        path: 'parametros',
        title: 'Parâmetros · Vittalis Pet',
        loadComponent: () => import('./pages/configuracoes/parametros').then((m) => m.Parametros),
      },
    ],
  },
  {
    path: 'cliente',
    title: 'Cliente · Vittalis Pet',
    loadComponent: () => import('./areas/cliente').then((m) => m.Cliente),
  },
  { path: '**', redirectTo: 'entrar' },
];
