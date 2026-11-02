import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { BrlPipe, DateBrPipe, errorMessage, parseAmount, todayIso } from '../../core/format';
import { Contribution, Goal, GoalSummary } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';

@Component({
  selector: 'app-goals',
  imports: [ReactiveFormsModule, BrlPipe, DateBrPipe, Icon, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1>Metas</h1>
          <p class="muted sub">Guarde dinheiro com aportes manuais e acompanhe quanto falta.</p>
        </div>
        <button type="button" class="btn btn-primary" (click)="openNewGoal()"><app-icon name="plus" [size]="18" /> Nova meta</button>
      </div>

      @if (error()) {
        <div class="form-error" role="alert">{{ error() }}</div>
      }

      @if (summary(); as s) {
        <div class="grid grid-3">
          <div class="card stat"><span class="secondary">Saldo total (rendas − gastos)</span><b class="num">{{ s.balance | brl }}</b></div>
          <div class="card stat"><span class="secondary">Já aportado em metas</span><b class="num">{{ s.allocated | brl }}</b></div>
          <div class="card stat highlight"><span class="secondary">Disponível para aportar</span>
            <b class="num" [class.negative]="s.available < 0">{{ s.available | brl }}</b></div>
        </div>
      }

      <div class="row">
        <label class="check"><input type="checkbox" [checked]="showArchived()" (change)="toggleArchived()" /> Mostrar arquivadas</label>
      </div>

      @if (goals().length === 0) {
        <div class="card empty">Nenhuma meta. Ex.: "Entrada Carro", R$ 10.000,00 até dez/2027.</div>
      }

      <div class="goals">
        @for (g of goals(); track g.id) {
          <article class="card goal" [class.archived]="g.archived">
            <header class="row">
              <span class="badge" title="Prioridade">#{{ g.priority }}</span>
              <h2>{{ g.name }}</h2>
              @if (g.archived) { <span class="badge">Arquivada</span> }
              @if (g.percent >= 100) { <span class="badge done">Concluída</span> }
              <span class="spacer"></span>
              <button type="button" class="btn btn-ghost btn-icon" (click)="openEditGoal(g)" [attr.aria-label]="'Editar ' + g.name"><app-icon name="edit" [size]="18" /></button>
            </header>

            <div class="amounts">
              <span class="num saved">{{ g.saved | brl }}</span>
              <span class="muted num">de {{ g.target | brl }}</span>
              <span class="spacer"></span>
              <span class="num pct">{{ g.percent.toFixed(1).replace('.', ',') }}%</span>
            </div>
            <div class="progress" role="progressbar" [attr.aria-valuenow]="g.percent" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="g.name">
              <span [style.width.%]="g.percent > 100 ? 100 : g.percent"></span>
            </div>

            <dl class="facts">
              <div><dt>Falta</dt><dd class="num">{{ g.remaining | brl }}</dd></div>
              <div><dt>Prazo</dt><dd>{{ g.deadline ? (g.deadline | dateBr) : 'Sem prazo' }}</dd></div>
              @if (g.monthlyNeeded !== null) {
                <div><dt>Guardar por mês</dt><dd class="num accent">{{ g.monthlyNeeded | brl }} <span class="muted months">({{ g.monthsLeft }} {{ g.monthsLeft === 1 ? 'mês' : 'meses' }})</span></dd></div>
              }
            </dl>

            <div class="row wrap">
              <button type="button" class="btn btn-primary btn-sm" (click)="openContribution(g)" [disabled]="g.archived">Aportar</button>
              <button type="button" class="btn btn-sm" (click)="toggleHistory(g)" [attr.aria-expanded]="expanded() === g.id">
                {{ expanded() === g.id ? 'Ocultar histórico' : 'Histórico' }}
              </button>
            </div>

            @if (expanded() === g.id) {
              <ul class="history">
                @for (c of contributions(); track c.id) {
                  <li class="list-item">
                    <span class="spacer">
                      <span class="num" [class.income]="c.amount > 0" [class.expense]="c.amount < 0">{{ c.amount > 0 ? '+' : '' }}{{ c.amount | brl }}</span>
                      <span class="muted"> · {{ c.contributedOn | dateBr }}</span>
                      @if (c.note) { <span class="muted"> · {{ c.note }}</span> }
                    </span>
                    <button type="button" class="btn btn-ghost btn-icon btn-danger" (click)="removeContribution(g, c)" aria-label="Excluir aporte"><app-icon name="trash" [size]="16" /></button>
                  </li>
                } @empty {
                  <li class="muted empty">Nenhum aporte ainda.</li>
                }
              </ul>
            }
          </article>
        }
      </div>
    </section>

    <app-modal [title]="editingGoal() ? 'Editar meta' : 'Nova meta'" [open]="goalModal()" (closed)="goalModal.set(false)">
      <form class="form-grid" [formGroup]="goalForm" (ngSubmit)="saveGoal()">
        @if (formError()) {
          <div class="form-error" role="alert">{{ formError() }}</div>
        }
        <div class="field">
          <label for="gname">Nome</label>
          <input id="gname" class="input" formControlName="name" maxlength="80" placeholder="Ex.: Entrada Carro" />
        </div>
        <div class="grid grid-2">
          <div class="field">
            <label for="target">Valor da meta (R$)</label>
            <input id="target" class="input num" formControlName="target" inputmode="decimal" placeholder="10.000,00" />
          </div>
          <div class="field">
            <label for="deadline">Prazo (opcional)</label>
            <input id="deadline" class="input" type="date" formControlName="deadline" />
          </div>
        </div>
        <div class="field">
          <label for="priority">Prioridade (1 = mais importante)</label>
          <input id="priority" class="input" type="number" min="1" max="100" formControlName="priority" />
        </div>
        @if (editingGoal()) {
          <label class="check"><input type="checkbox" formControlName="archived" /> Arquivar meta</label>
        }
        <div class="row wrap">
          @if (editingGoal()) {
            <button type="button" class="btn btn-danger" (click)="removeGoal()" [disabled]="saving()"><app-icon name="trash" [size]="18" /> Excluir</button>
          }
          <span class="spacer"></span>
          <button type="button" class="btn" (click)="goalModal.set(false)">Cancelar</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">{{ saving() ? 'Salvando…' : 'Salvar' }}</button>
        </div>
      </form>
    </app-modal>

    <app-modal [title]="'Aporte · ' + (contributionGoal()?.name ?? '')" [open]="contributionModal()" (closed)="contributionModal.set(false)">
      <form class="form-grid" [formGroup]="contributionForm" (ngSubmit)="saveContribution()">
        @if (formError()) {
          <div class="form-error" role="alert">{{ formError() }}</div>
        }
        <div class="segmented type-toggle" role="group" aria-label="Tipo">
          <button type="button" [attr.aria-pressed]="!withdrawal()" (click)="withdrawal.set(false)">Aporte</button>
          <button type="button" [attr.aria-pressed]="withdrawal()" (click)="withdrawal.set(true)">Retirada</button>
        </div>
        @if (summary(); as s) {
          <p class="muted hint">Disponível agora: <b class="num">{{ s.available | brl }}</b></p>
        }
        <div class="grid grid-2">
          <div class="field">
            <label for="camount">Valor (R$)</label>
            <input id="camount" class="input num" formControlName="amount" inputmode="decimal" placeholder="0,00" />
          </div>
          <div class="field">
            <label for="cdate">Data</label>
            <input id="cdate" class="input" type="date" formControlName="contributedOn" />
          </div>
        </div>
        <div class="field">
          <label for="cnote">Observação (opcional)</label>
          <input id="cnote" class="input" formControlName="note" maxlength="255" />
        </div>
        <div class="row">
          <span class="spacer"></span>
          <button type="button" class="btn" (click)="contributionModal.set(false)">Cancelar</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">{{ saving() ? 'Salvando…' : 'Salvar' }}</button>
        </div>
      </form>
    </app-modal>
  `,
  styles: `
    .sub { margin: 4px 0 0; }
    .stat { display: grid; gap: 4px; }
    .stat b { font-size: 1.35rem; }
    .highlight { border-color: rgb(34 211 238 / 0.35); box-shadow: var(--glow); }
    .negative { color: var(--danger); }
    .check { display: inline-flex; align-items: center; gap: 8px; color: var(--text-secondary); cursor: pointer; }
    .check input { width: 18px; height: 18px; accent-color: var(--accent-strong); }
    .goals { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
    .goal { display: grid; gap: 12px; align-content: start; }
    .goal.archived { opacity: 0.65; }
    .goal h2 { font-size: 1.05rem; }
    .badge.done { background: rgb(52 211 153 / 0.15); color: var(--success); }
    .amounts { display: flex; align-items: baseline; gap: 4px 6px; flex-wrap: wrap; }
    .amounts > span { white-space: nowrap; }
    .months { display: block; font-size: 0.78rem; font-weight: 400; }
    .saved { font-size: 1.4rem; font-weight: 700; }
    .pct { color: var(--accent); font-weight: 600; }
    .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; margin: 0; }
    .facts dt { font-size: 0.75rem; color: var(--text-muted); }
    .facts dd { margin: 0; font-weight: 500; }
    .accent { color: var(--accent); }
    .history { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--border); font-size: 0.9rem; }
    .type-toggle { width: 100%; }
    .type-toggle button { flex: 1; }
    .hint { margin: 0; }
    @media (max-width: 640px) { .goals { grid-template-columns: 1fr; } }
  `,
})
export class GoalsPage {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly summary = signal<GoalSummary | null>(null);
  protected readonly goals = signal<Goal[]>([]);
  protected readonly showArchived = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly expanded = signal<number | null>(null);
  protected readonly contributions = signal<Contribution[]>([]);

  protected readonly goalModal = signal(false);
  protected readonly editingGoal = signal<Goal | null>(null);
  protected readonly contributionModal = signal(false);
  protected readonly contributionGoal = signal<Goal | null>(null);
  protected readonly withdrawal = signal(false);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly goalForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    target: ['', Validators.required],
    deadline: [''],
    priority: [1, [Validators.required, Validators.min(1), Validators.max(100)]],
    archived: [false],
  });

  protected readonly contributionForm = this.fb.nonNullable.group({
    amount: ['', Validators.required],
    contributedOn: [todayIso()],
    note: [''],
  });

  constructor() {
    this.load();
  }

  protected toggleArchived(): void {
    this.showArchived.set(!this.showArchived());
    this.load();
  }

  protected openNewGoal(): void {
    this.editingGoal.set(null);
    this.formError.set(null);
    const nextPriority = this.goals().filter((g) => !g.archived).length + 1;
    this.goalForm.reset({ name: '', target: '', deadline: '', priority: Math.min(nextPriority, 100), archived: false });
    this.goalModal.set(true);
  }

  protected openEditGoal(g: Goal): void {
    this.editingGoal.set(g);
    this.formError.set(null);
    this.goalForm.reset({
      name: g.name,
      target: g.target.toFixed(2).replace('.', ','),
      deadline: g.deadline ?? '',
      priority: g.priority,
      archived: g.archived,
    });
    this.goalModal.set(true);
  }

  protected saveGoal(): void {
    const v = this.goalForm.getRawValue();
    const target = parseAmount(v.target);
    if (!v.name.trim() || target === null || target <= 0) {
      this.formError.set('Informe nome e um valor válido, ex.: 10.000,00.');
      return;
    }
    const body = { name: v.name, target, deadline: v.deadline || null, priority: Number(v.priority) || 1, archived: v.archived };
    const editing = this.editingGoal();
    this.saving.set(true);
    const req = editing ? this.api.updateGoal(editing.id, body) : this.api.createGoal(body);
    req.subscribe({
      next: () => this.done(() => this.goalModal.set(false)),
      error: (err) => this.fail(err),
    });
  }

  protected removeGoal(): void {
    const g = this.editingGoal();
    if (!g || !confirm(`Excluir a meta "${g.name}" e todos os aportes?`)) return;
    this.saving.set(true);
    this.api.deleteGoal(g.id).subscribe({
      next: () => this.done(() => this.goalModal.set(false)),
      error: (err) => this.fail(err),
    });
  }

  protected openContribution(g: Goal): void {
    this.contributionGoal.set(g);
    this.withdrawal.set(false);
    this.formError.set(null);
    this.contributionForm.reset({ amount: '', contributedOn: todayIso(), note: '' });
    this.contributionModal.set(true);
  }

  protected saveContribution(): void {
    const g = this.contributionGoal();
    const v = this.contributionForm.getRawValue();
    const amount = parseAmount(v.amount);
    if (!g || amount === null || amount <= 0) {
      this.formError.set('Informe um valor válido.');
      return;
    }
    this.saving.set(true);
    this.api
      .addContribution(g.id, {
        amount: this.withdrawal() ? -amount : amount,
        note: v.note.trim() || null,
        contributedOn: v.contributedOn || null,
      })
      .subscribe({
        next: () =>
          this.done(() => {
            this.contributionModal.set(false);
            if (this.expanded() === g.id) this.loadContributions(g.id);
          }),
        error: (err) => this.fail(err),
      });
  }

  protected toggleHistory(g: Goal): void {
    if (this.expanded() === g.id) {
      this.expanded.set(null);
      return;
    }
    this.expanded.set(g.id);
    this.contributions.set([]);
    this.loadContributions(g.id);
  }

  protected removeContribution(g: Goal, c: Contribution): void {
    if (!confirm('Excluir este aporte?')) return;
    this.api.deleteContribution(g.id, c.id).subscribe({
      next: () => {
        this.loadContributions(g.id);
        this.load();
      },
      error: (err) => this.error.set(errorMessage(err)),
    });
  }

  private loadContributions(goalId: number): void {
    this.api.contributions(goalId).subscribe({
      next: (items) => this.contributions.set(items),
      error: (err) => this.error.set(errorMessage(err)),
    });
  }

  private done(after: () => void): void {
    this.saving.set(false);
    after();
    this.load();
  }

  private fail(err: unknown): void {
    this.formError.set(errorMessage(err));
    this.saving.set(false);
  }

  private load(): void {
    this.error.set(null);
    this.api.goalSummary().subscribe({ next: (s) => this.summary.set(s), error: (err) => this.error.set(errorMessage(err)) });
    this.api.goals(this.showArchived()).subscribe({ next: (g) => this.goals.set(g), error: (err) => this.error.set(errorMessage(err)) });
  }
}
