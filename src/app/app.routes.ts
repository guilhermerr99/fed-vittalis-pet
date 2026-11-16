import { Routes } from '@angular/router';

/** Três áreas de uso: veterinário (atendimento), gestão e cliente (portal do tutor). */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'veterinario' },
  {
    path: 'veterinario',
    title: 'Veterinário · Vittalis Pet',
    loadComponent: () => import('./areas/veterinario').then((m) => m.Veterinario),
  },
  {
    path: 'gestao',
    title: 'Gestão · Vittalis Pet',
    loadComponent: () => import('./areas/gestao').then((m) => m.Gestao),
  },
  {
    path: 'cliente',
    title: 'Cliente · Vittalis Pet',
    loadComponent: () => import('./areas/cliente').then((m) => m.Cliente),
  },
  { path: '**', redirectTo: 'veterinario' },
];
