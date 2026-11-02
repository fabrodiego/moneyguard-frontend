import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { Icon } from '../shared/icon';
import { Logo } from '../shared/logo';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="sidebar">
      <app-logo class="brand" />
      <nav aria-label="Principal">
        @for (item of nav; track item.path) {
          <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.path === '/' }">
            <app-icon [name]="item.icon" />
            <span>{{ item.label }}</span>
          </a>
        }
      </nav>
      <a routerLink="/discord" routerLinkActive="active" class="discord-link">
        <app-icon name="discord" />
        <span>Bot do Discord</span>
      </a>
      <div class="user">
        <span class="secondary" [title]="auth.userName()">{{ auth.userName() }}</span>
        <button type="button" class="btn btn-ghost btn-icon" (click)="auth.logout()" aria-label="Sair" title="Sair">
          <app-icon name="logout" />
        </button>
      </div>
    </aside>

    <header class="topbar">
      <app-logo [size]="28" />
      <span class="spacer"></span>
      <a class="btn btn-ghost btn-icon" routerLink="/discord" aria-label="Bot do Discord"><app-icon name="discord" /></a>
      <button type="button" class="btn btn-ghost btn-icon" (click)="auth.logout()" aria-label="Sair">
        <app-icon name="logout" />
      </button>
    </header>

    <main>
      <router-outlet />
    </main>

    <nav class="tabbar" aria-label="Principal">
      @for (item of nav; track item.path) {
        <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.path === '/' }">
          <app-icon [name]="item.icon" [size]="22" />
          <span>{{ item.short }}</span>
        </a>
      }
    </nav>
  `,
  styles: `
    :host { display: grid; grid-template-columns: 240px 1fr; min-height: 100dvh; }
    .sidebar {
      position: sticky; top: 0; height: 100dvh; display: flex; flex-direction: column; gap: 24px;
      padding: 20px 14px; border-right: 1px solid var(--border); background: var(--surface-1);
    }
    .brand { padding: 0 8px; }
    .sidebar nav { display: grid; gap: 4px; }
    .sidebar nav a {
      display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: var(--radius-sm);
      color: var(--text-secondary); font-weight: 500; text-decoration: none;
    }
    .sidebar nav a:hover { background: var(--surface-2); color: var(--text-primary); }
    .sidebar nav a.active { background: rgb(34 211 238 / 0.1); color: var(--accent); box-shadow: inset 2px 0 0 var(--accent); }
    .discord-link {
      margin-top: auto; display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: var(--radius-sm);
      color: var(--text-secondary); font-weight: 500; text-decoration: none;
    }
    .discord-link:hover { background: var(--surface-2); color: var(--text-primary); text-decoration: none; }
    .discord-link.active { background: rgb(34 211 238 / 0.1); color: var(--accent); }
    .user { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 4px 0 12px; }
    .user span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    main { padding: 28px clamp(16px, 4vw, 40px) 40px; min-width: 0; max-width: 1200px; width: 100%; }
    .topbar, .tabbar { display: none; }

    @media (max-width: 860px) {
      :host { grid-template-columns: 1fr; }
      .sidebar { display: none; }
      .topbar {
        display: flex; align-items: center; gap: 4px;
        position: sticky; top: 0; z-index: 10; padding: calc(10px + env(safe-area-inset-top, 0px)) 16px 10px;
        background: rgb(7 9 13 / 0.9); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border);
      }
      main { padding: 16px 16px calc(84px + var(--safe-bottom)); }
      .tabbar {
        display: grid; grid-template-columns: repeat(6, 1fr);
        position: fixed; bottom: 0; left: 0; right: 0; z-index: 10;
        padding: 6px 4px calc(6px + var(--safe-bottom));
        background: rgb(13 18 24 / 0.96); backdrop-filter: blur(10px); border-top: 1px solid var(--border);
      }
      .tabbar a {
        display: grid; justify-items: center; gap: 2px; padding: 6px 0; border-radius: var(--radius-sm);
        color: var(--text-muted); font-size: 0.66rem; font-weight: 500; text-decoration: none; white-space: nowrap;
      }
      .tabbar a.active { color: var(--accent); }
    }
  `,
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly nav: (NavItem & { short: string })[] = [
    { path: '/', label: 'Visão geral', short: 'Início', icon: 'dashboard' },
    { path: '/lancamentos', label: 'Lançamentos', short: 'Lançar', icon: 'list' },
    { path: '/assinaturas', label: 'Assinaturas', short: 'Assinat.', icon: 'repeat' },
    { path: '/categorias', label: 'Categorias', short: 'Categ.', icon: 'tag' },
    { path: '/empresas', label: 'Empresas', short: 'Empresas', icon: 'store' },
    { path: '/metas', label: 'Metas', short: 'Metas', icon: 'target' },
  ];
}
