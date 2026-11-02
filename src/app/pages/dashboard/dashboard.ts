import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ApiService } from '../../core/api.service';
import {
  BrlPipe,
  currentPeriodNumber,
  errorMessage,
  monthShort,
  periodLabel,
  shiftPeriod,
} from '../../core/format';
import { GoalSummary, Insight, InsightPeriod } from '../../core/models';
import { BarChart } from '../../shared/bar-chart';
import { CategoryBreakdown } from '../../shared/category-breakdown';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-dashboard',
  imports: [BarChart, CategoryBreakdown, Icon, BrlPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <p class="muted hello">Olá, {{ firstName() }}</p>
          <h1>Visão geral</h1>
        </div>
        <a class="btn btn-primary" routerLink="/lancamentos" [queryParams]="{ novo: 1 }">
          <app-icon name="plus" [size]="18" /> Novo lançamento
        </a>
      </div>

      <div class="filters">
        <div class="segmented" role="group" aria-label="Dimensão do período">
          @for (p of periods; track p.value) {
            <button type="button" [attr.aria-pressed]="period() === p.value" (click)="setPeriod(p.value)">{{ p.label }}</button>
          }
        </div>
        <div class="nav">
          <button type="button" class="btn btn-ghost btn-icon" (click)="move(-1)" aria-label="Período anterior">
            <app-icon name="left" />
          </button>
          <span class="period-label" aria-live="polite">{{ label() }}</span>
          <button type="button" class="btn btn-ghost btn-icon" (click)="move(1)" aria-label="Próximo período">
            <app-icon name="right" />
          </button>
        </div>
      </div>

      @if (error()) {
        <div class="form-error" role="alert">{{ error() }}</div>
      }

      @if (data(); as d) {
        <div class="grid grid-3" [class.stale]="loading()">
          <div class="card stat">
            <span class="stat-label">Rendas</span>
            <span class="stat-value num">{{ d.totals.income | brl }}</span>
            <span class="delta">{{ delta(d.totals.income, d.previous.income) }}</span>
          </div>
          <div class="card stat">
            <span class="stat-label">Gastos</span>
            <span class="stat-value num">{{ d.totals.expense | brl }}</span>
            <span class="delta">{{ delta(d.totals.expense, d.previous.expense) }}</span>
          </div>
          <div class="card stat highlight">
            <span class="stat-label">Saldo</span>
            <span class="stat-value num" [class.negative]="d.totals.balance < 0">{{ d.totals.balance | brl }}</span>
            <span class="delta">Anterior: {{ d.previous.balance | brl }}</span>
          </div>
        </div>

        <div class="card" [class.stale]="loading()">
          <h2 class="card-title">Rendas x gastos</h2>
          <app-bar-chart [points]="d.series" [labelFormat]="axisLabel()" />
        </div>

        <div class="grid grid-2" [class.stale]="loading()">
          <div class="card">
            <h2 class="card-title">Gastos por categoria</h2>
            <app-category-breakdown [items]="d.expensesByCategory" emptyText="Nenhum gasto no período." />
          </div>
          <div class="card">
            <h2 class="card-title">Rendas por categoria</h2>
            <app-category-breakdown [items]="d.incomesByCategory" emptyText="Nenhuma renda no período." />
          </div>
        </div>
      } @else if (loading()) {
        <div class="card empty">Carregando…</div>
      }

      @if (goals(); as g) {
        <div class="card">
          <div class="row">
            <h2 class="card-title" style="margin: 0">Metas</h2>
            <span class="spacer"></span>
            <a routerLink="/metas" class="btn btn-ghost btn-sm">Ver metas</a>
          </div>
          <p class="secondary available">
            Disponível para aportar: <b class="num" [class.negative]="g.available < 0">{{ g.available | brl }}</b>
          </p>
          @if (g.goals.length === 0) {
            <p class="empty">Nenhuma meta ainda. <a routerLink="/metas">Criar a primeira</a></p>
          } @else {
            <div class="goals">
              @for (goal of g.goals.slice(0, 3); track goal.id) {
                <div class="goal">
                  <div class="line">
                    <span>{{ goal.name }}</span>
                    <span class="num secondary">{{ goal.saved | brl }} / {{ goal.target | brl }}</span>
                  </div>
                  <div class="progress" role="progressbar" [attr.aria-valuenow]="goal.percent" aria-valuemin="0" aria-valuemax="100"
                       [attr.aria-label]="goal.name">
                    <span [style.width.%]="goal.percent > 100 ? 100 : goal.percent"></span>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .hello { margin: 0 0 2px; }
    .filters { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .nav { display: flex; align-items: center; gap: 4px; }
    .period-label { min-width: 170px; text-align: center; font-weight: 600; }
    .stat { display: grid; gap: 4px; }
    .stat-label { color: var(--text-secondary); font-size: 0.85rem; }
    .stat-value { font-size: 1.6rem; font-weight: 700; letter-spacing: -0.01em; }
    .stat-value.negative, .negative { color: var(--danger); }
    .delta { color: var(--text-muted); font-size: 0.8rem; }
    .highlight { border-color: rgb(34 211 238 / 0.35); box-shadow: var(--glow); }
    .stale { opacity: 0.6; transition: opacity 0.2s; }
    .available { margin: 4px 0 14px; }
    .goals { display: grid; gap: 14px; }
    .goal .line { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; font-size: 0.9rem; }
    @media (max-width: 640px) {
      .filters { flex-direction: column; align-items: stretch; }
      .segmented { justify-content: space-between; }
      .segmented button { flex: 1; }
      .nav { justify-content: space-between; }
    }
  `,
})
export class DashboardPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  protected readonly periods: { value: InsightPeriod; label: string }[] = [
    { value: 'MONTH', label: 'Mês' },
    { value: 'QUARTER', label: 'Trimestre' },
    { value: 'SEMESTER', label: 'Semestre' },
    { value: 'YEAR', label: 'Ano' },
  ];

  protected readonly period = signal<InsightPeriod>('MONTH');
  protected readonly year = signal(new Date().getFullYear());
  protected readonly number = signal(currentPeriodNumber('MONTH'));
  protected readonly data = signal<Insight | null>(null);
  protected readonly goals = signal<GoalSummary | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly firstName = computed(() => this.auth.userName().split(' ')[0]);
  protected readonly label = computed(() => periodLabel(this.period(), this.year(), this.number()));
  protected readonly axisLabel = computed(() =>
    this.period() === 'MONTH'
      ? (l: string) => String(Number(l))
      : (l: string) => monthShort(Number(l.split('-')[1])),
  );

  constructor() {
    effect(() => this.load(this.period(), this.year(), this.number()));
    this.api.goalSummary().subscribe({ next: (g) => this.goals.set(g), error: () => this.goals.set(null) });
  }

  protected setPeriod(p: InsightPeriod): void {
    if (p === this.period()) return;
    const now = new Date();
    this.year.set(now.getFullYear());
    this.number.set(currentPeriodNumber(p, now));
    this.period.set(p);
  }

  protected move(delta: number): void {
    const next = shiftPeriod(this.period(), this.year(), this.number(), delta);
    this.year.set(next.year);
    this.number.set(next.number);
  }

  protected delta(current: number, previous: number): string {
    if (previous === 0) return current === 0 ? 'Sem movimento' : 'Sem base no período anterior';
    const pct = ((current - previous) / previous) * 100;
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(1).replace('.', ',')}% vs anterior`;
  }

  private load(period: InsightPeriod, year: number, number: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.insights(period, year, number).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err, 'Não foi possível carregar os insights.'));
        this.loading.set(false);
      },
    });
  }
}
