import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/format';
import { DiscordLinkCode, DiscordLinkStatus } from '../../core/models';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-discord',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1>Bot do Discord</h1>
          <p class="muted sub">Lance gastos mandando mensagem privada para o <b>D7</b>.</p>
        </div>
      </div>

      @if (error()) {
        <div class="form-error" role="alert">{{ error() }}</div>
      }

      @if (status(); as s) {
        @if (s.linked) {
          <div class="card linked">
            <div class="row">
              <span class="status-dot" aria-hidden="true"></span>
              <h2>Conta vinculada</h2>
            </div>
            <p class="secondary">Seu Discord (ID {{ s.discordUserId }}) está ligado a esta conta desde {{ linkedAt() }}.</p>
            <div class="row">
              <button type="button" class="btn btn-danger" (click)="unlink()" [disabled]="busy()">Desvincular</button>
            </div>
          </div>
        } @else {
          <div class="card">
            <h2 class="card-title">Vincular em 2 passos</h2>
            <ol class="steps">
              <li>
                <span>Gere um código (vale 10 minutos).</span>
                @if (code(); as c) {
                  <div class="code-box">
                    <code class="code num" aria-label="Código de vínculo">{{ c.code }}</code>
                    <button type="button" class="btn btn-sm" (click)="copy(c.code)">{{ copied() ? 'Copiado!' : 'Copiar comando' }}</button>
                  </div>
                  <span class="muted small">Expira às {{ expiresAt() }}.</span>
                } @else {
                  <div><button type="button" class="btn btn-primary" (click)="generate()" [disabled]="busy()">Gerar código</button></div>
                }
              </li>
              <li>
                <span>No Discord, mande para o D7 (em mensagem privada):</span>
                <code class="cmd">/vincular {{ code()?.code ?? 'CÓDIGO' }}</code>
              </li>
            </ol>
            <div class="row">
              <button type="button" class="btn btn-ghost btn-sm" (click)="load()">Já vinculei, atualizar</button>
            </div>
          </div>
        }
      }

      <div class="card">
        <h2 class="card-title">Como usar</h2>
        <ul class="examples">
          <li><code>acabei de gastar 8 reais na cantina central</code><span class="muted">→ R$ 8,00 · Cantina Central · Alimentação · hoje</span></li>
          <li><code>paguei R$ 120,50 de luz ontem</code><span class="muted">→ o bot pergunta a categoria</span></li>
          <li><code>recebi 6.500 de salário</code><span class="muted">→ renda na categoria Salário</span></li>
          <li><code>/resumo</code><span class="muted">→ rendas, gastos e metas do mês</span></li>
        </ul>
        <p class="muted small">
          <app-icon name="store" [size]="14" /> Cadastre suas empresas em <b>Empresas</b> para o bot acertar a categoria sozinho.
          Antes de gravar, o bot sempre mostra o que entendeu com os botões Confirmar / Trocar categoria / Cancelar.
        </p>
      </div>
    </section>
  `,
  styles: `
    .sub { margin: 4px 0 0; }
    .linked { border-color: rgb(34 211 238 / 0.35); box-shadow: var(--glow); display: grid; gap: 10px; }
    .linked p { margin: 0; }
    .status-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--success); box-shadow: 0 0 10px var(--success); }
    .steps { margin: 0 0 12px; padding-left: 20px; display: grid; gap: 16px; }
    .steps li { display: grid; gap: 8px; }
    .code-box { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .code {
      font-size: 1.8rem; font-weight: 700; letter-spacing: 0.25em; color: var(--accent);
      background: var(--bg); border: 1px dashed var(--accent-strong); border-radius: var(--radius-sm); padding: 6px 14px;
    }
    .cmd, .examples code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--bg); border: 1px solid var(--border);
      border-radius: 6px; padding: 4px 8px; width: fit-content; max-width: 100%; overflow-wrap: anywhere;
    }
    .examples { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 10px; }
    .examples li { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; }
    .small { font-size: 0.82rem; }
  `,
})
export class DiscordPage implements OnDestroy {
  private readonly api = inject(ApiService);

  protected readonly status = signal<DiscordLinkStatus | null>(null);
  protected readonly code = signal<DiscordLinkCode | null>(null);
  protected readonly busy = signal(false);
  protected readonly copied = signal(false);
  protected readonly error = signal<string | null>(null);
  private poll: ReturnType<typeof setInterval> | null = null;

  protected readonly expiresAt = computed(() => {
    const c = this.code();
    return c ? new Date(c.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  });
  protected readonly linkedAt = computed(() => {
    const at = this.status()?.linkedAt;
    return at ? new Date(at).toLocaleDateString('pt-BR') : '';
  });

  constructor() {
    this.load();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  load(): void {
    this.api.discordStatus().subscribe({
      next: (s) => {
        this.status.set(s);
        if (s.linked) {
          this.code.set(null);
          this.stopPolling();
        }
      },
      error: (err) => this.error.set(errorMessage(err)),
    });
  }

  protected generate(): void {
    this.busy.set(true);
    this.error.set(null);
    this.api.discordLinkCode().subscribe({
      next: (c) => {
        this.code.set(c);
        this.busy.set(false);
        this.startPolling();
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.busy.set(false);
      },
    });
  }

  protected unlink(): void {
    if (!confirm('Desvincular o Discord? O bot deixa de lançar na sua conta.')) return;
    this.busy.set(true);
    this.api.discordUnlink().subscribe({
      next: () => {
        this.busy.set(false);
        this.load();
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.busy.set(false);
      },
    });
  }

  protected copy(code: string): void {
    navigator.clipboard?.writeText(`/vincular ${code}`).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  /** Enquanto o codigo vale, confere a cada 5s se o vinculo ja foi feito no Discord. */
  private startPolling(): void {
    this.stopPolling();
    this.poll = setInterval(() => {
      const c = this.code();
      if (!c || new Date(c.expiresAt).getTime() < Date.now()) {
        this.code.set(null);
        this.stopPolling();
        return;
      }
      this.load();
    }, 5000);
  }

  private stopPolling(): void {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
  }
}
