import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Me, TokenResponse } from './models';

const STORAGE_KEY = 'mg.session';

interface Session {
  token: string;
  expiresAt: number;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly base = `${environment.apiUrl}/api/auth`;

  private readonly session = signal<Session | null>(this.restore());

  readonly isLoggedIn = computed(() => this.session() !== null);
  readonly userName = computed(() => this.session()?.name ?? '');

  token(): string | null {
    const s = this.session();
    if (s && s.expiresAt <= Date.now()) {
      this.clear();
      return null;
    }
    return s?.token ?? null;
  }

  login(email: string, password: string) {
    return this.http
      .post<TokenResponse>(`${this.base}/login`, { email, password })
      .pipe(tap((res) => this.store(res)));
  }

  register(name: string, email: string, password: string) {
    return this.http
      .post<TokenResponse>(`${this.base}/register`, { name, email, password })
      .pipe(tap((res) => this.store(res)));
  }

  me() {
    return this.http.get<Me>(`${this.base}/me`);
  }

  logout(): void {
    this.clear();
    this.router.navigateByUrl('/login');
  }

  private store(res: TokenResponse): void {
    const session: Session = {
      token: res.accessToken,
      expiresAt: Date.now() + res.expiresIn * 1000,
      name: nameFromToken(res.accessToken),
    };
    this.session.set(session);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Sem storage (modo privado): a sessao vale so enquanto a aba estiver aberta.
    }
  }

  private clear(): void {
    this.session.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  private restore(): Session | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Session;
      return s.expiresAt > Date.now() ? s : null;
    } catch {
      return null;
    }
  }
}

function nameFromToken(token: string): string {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(payload)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    return (JSON.parse(json).name as string) ?? '';
  } catch {
    return '';
  }
}
