import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Entrar · MoneyGuard',
    loadComponent: () => import('./pages/auth/login').then((m) => m.LoginPage),
  },
  {
    path: 'cadastro',
    canActivate: [guestGuard],
    title: 'Criar conta · MoneyGuard',
    loadComponent: () => import('./pages/auth/register').then((m) => m.RegisterPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      {
        path: '',
        title: 'Visão geral · MoneyGuard',
        loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.DashboardPage),
      },
      {
        path: 'lancamentos',
        title: 'Lançamentos · MoneyGuard',
        loadComponent: () => import('./pages/transactions/transactions').then((m) => m.TransactionsPage),
      },
      {
        path: 'importar',
        title: 'Importar extrato · MoneyGuard',
        loadComponent: () => import('./pages/import/import').then((m) => m.ImportPage),
      },
      {
        path: 'assinaturas',
        title: 'Assinaturas · MoneyGuard',
        loadComponent: () => import('./pages/recurrences/recurrences').then((m) => m.RecurrencesPage),
      },
      {
        path: 'categorias',
        title: 'Categorias · MoneyGuard',
        loadComponent: () => import('./pages/categories/categories').then((m) => m.CategoriesPage),
      },
      {
        path: 'empresas',
        title: 'Empresas · MoneyGuard',
        loadComponent: () => import('./pages/merchants/merchants').then((m) => m.MerchantsPage),
      },
      {
        path: 'discord',
        title: 'Discord · MoneyGuard',
        loadComponent: () => import('./pages/discord/discord').then((m) => m.DiscordPage),
      },
      {
        path: 'metas',
        title: 'Metas · MoneyGuard',
        loadComponent: () => import('./pages/goals/goals').then((m) => m.GoalsPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
