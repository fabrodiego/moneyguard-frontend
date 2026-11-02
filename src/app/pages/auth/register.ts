import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/format';
import { Logo } from '../../shared/logo';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth-layout.scss',
  template: `
    <div class="box">
      <div class="head">
        <app-logo [size]="56" [withName]="false" />
        <h1>Criar conta</h1>
        <p>Comece a acompanhar seus gastos em minutos.</p>
      </div>
      <form class="card form-grid" [formGroup]="form" (ngSubmit)="submit()">
        @if (error()) {
          <div class="form-error" role="alert">{{ error() }}</div>
        }
        <div class="field">
          <label for="name">Nome</label>
          <input id="name" class="input" formControlName="name" autocomplete="name" />
        </div>
        <div class="field">
          <label for="email">E-mail</label>
          <input id="email" class="input" type="email" formControlName="email" autocomplete="email" />
        </div>
        <div class="field">
          <label for="password">Senha</label>
          <input id="password" class="input" type="password" formControlName="password" autocomplete="new-password" />
          <span class="muted" style="font-size: 0.8rem">Mínimo de 8 caracteres.</span>
        </div>
        <button class="btn btn-primary btn-block" type="submit" [disabled]="loading()">
          {{ loading() ? 'Criando…' : 'Criar conta' }}
        </button>
      </form>
      <p class="foot">Já tem conta? <a routerLink="/login">Entrar</a></p>
    </div>
  `,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.error.set('Preencha nome, e-mail válido e senha com 8+ caracteres.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const { name, email, password } = this.form.getRawValue();
    this.auth.register(name, email, password).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (err) => {
        this.error.set(errorMessage(err, 'Não foi possível criar a conta.'));
        this.loading.set(false);
      },
    });
  }
}
