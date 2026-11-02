import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/format';
import { Logo } from '../../shared/logo';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth-layout.scss',
  template: `
    <div class="box">
      <div class="head">
        <app-logo [size]="56" [withName]="false" />
        <h1>Money<span style="color: var(--accent)">Guard</span></h1>
        <p>Seus gastos sob controle.</p>
      </div>
      <form class="card form-grid" [formGroup]="form" (ngSubmit)="submit()">
        @if (error()) {
          <div class="form-error" role="alert">{{ error() }}</div>
        }
        <div class="field">
          <label for="email">E-mail</label>
          <input id="email" class="input" type="email" formControlName="email" autocomplete="email" />
        </div>
        <div class="field">
          <label for="password">Senha</label>
          <input id="password" class="input" type="password" formControlName="password" autocomplete="current-password" />
        </div>
        <button class="btn btn-primary btn-block" type="submit" [disabled]="loading()">
          {{ loading() ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
      <p class="foot">Ainda não tem conta? <a routerLink="/cadastro">Criar conta</a></p>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.error.set('Informe e-mail e senha.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (err) => {
        this.error.set(errorMessage(err, 'Não foi possível entrar.'));
        this.loading.set(false);
      },
    });
  }
}
