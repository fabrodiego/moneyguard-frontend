import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { BrlPipe, DateBrPipe, errorMessage, parseAmount, periodLabel, shiftPeriod, toIso, todayIso } from '../../core/format';
import { Category, Merchant, Transaction, TransactionType } from '../../core/models';
import { categoryColor } from '../../shared/category-breakdown';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';

interface DayGroup {
  date: string;
  items: Transaction[];
}

@Component({
  selector: 'app-transactions',
  imports: [ReactiveFormsModule, RouterLink, BrlPipe, DateBrPipe, Icon, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <div class="page-header">
        <h1>Lançamentos</h1>
        <button type="button" class="btn btn-primary" (click)="openNew()" [disabled]="categories().length === 0">
          <app-icon name="plus" [size]="18" /> Novo
        </button>
      </div>

      @if (loaded() && categories().length === 0) {
        <div class="card empty">
          Crie suas categorias antes de lançar. <a routerLink="/categorias">Criar categorias</a>
        </div>
      }

      <div class="filters">
        <div class="nav">
          <button type="button" class="btn btn-ghost btn-icon" (click)="moveMonth(-1)" aria-label="Mês anterior"><app-icon name="left" /></button>
          <span class="period-label">{{ monthLabel() }}</span>
          <button type="button" class="btn btn-ghost btn-icon" (click)="moveMonth(1)" aria-label="Próximo mês"><app-icon name="right" /></button>
        </div>
        <div class="segmented" role="group" aria-label="Tipo">
          <button type="button" [attr.aria-pressed]="typeFilter() === null" (click)="setType(null)">Todos</button>
          <button type="button" [attr.aria-pressed]="typeFilter() === 'EXPENSE'" (click)="setType('EXPENSE')">Gastos</button>
          <button type="button" [attr.aria-pressed]="typeFilter() === 'INCOME'" (click)="setType('INCOME')">Rendas</button>
        </div>
        <select class="input cat-filter" aria-label="Categoria" [value]="categoryFilter() ?? ''"
                (change)="setCategory($any($event.target).value)">
          <option value="">Todas as categorias</option>
          @for (c of filterCategories(); track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
          }
        </select>
      </div>

      <div class="grid grid-3 totals">
        <div class="card"><span class="secondary">Rendas</span><b class="num income">{{ totals().income | brl }}</b></div>
        <div class="card"><span class="secondary">Gastos</span><b class="num expense">{{ totals().expense | brl }}</b></div>
        <div class="card"><span class="secondary">Saldo</span><b class="num">{{ totals().income - totals().expense | brl }}</b></div>
      </div>

      @if (listError()) {
        <div class="form-error" role="alert">{{ listError() }}</div>
      }

      <div class="card list-card" [class.stale]="loading()">
        @if (groups().length === 0) {
          <p class="empty">{{ loading() ? 'Carregando…' : 'Nenhum lançamento neste mês.' }}</p>
        }
        @for (g of groups(); track g.date) {
          <h3 class="day">{{ g.date | dateBr: 'long' }}</h3>
          <ul class="list">
            @for (t of g.items; track t.id) {
              <li>
                <button type="button" class="list-item tx" (click)="openEdit(t)">
                  <i class="dot" [style.background]="color(t.category)"></i>
                  <span class="info">
                    <span class="title">{{ t.description || t.merchant?.name || t.category.name }}</span>
                    <span class="sub muted">
                      {{ t.category.name }}@if (t.merchant && t.description) { · {{ t.merchant.name }} }
                      @if (t.source === 'DISCORD') { <span class="badge">Discord</span> }
                      @if (t.source === 'RECURRENCE') { <span class="badge">Assinatura</span> }
                    </span>
                  </span>
                  <span class="num amount" [class.income]="t.type === 'INCOME'" [class.expense]="t.type === 'EXPENSE'">
                    {{ t.type === 'EXPENSE' ? '−' : '+' }}{{ t.amount | brl }}
                  </span>
                </button>
              </li>
            }
          </ul>
        }
      </div>
    </section>

    <app-modal [title]="editing() ? 'Editar lançamento' : 'Novo lançamento'" [open]="modalOpen()" (closed)="closeModal()">
      <form class="form-grid" [formGroup]="form" (ngSubmit)="save()">
        @if (formError()) {
          <div class="form-error" role="alert">{{ formError() }}</div>
        }
        <div class="segmented type-toggle" role="group" aria-label="Tipo do lançamento">
          <button type="button" [attr.aria-pressed]="formType() === 'EXPENSE'" (click)="setFormType('EXPENSE')">Gasto</button>
          <button type="button" [attr.aria-pressed]="formType() === 'INCOME'" (click)="setFormType('INCOME')">Renda</button>
        </div>
        <div class="field">
          <label for="amount">Valor (R$)</label>
          <input id="amount" class="input num amount-input" formControlName="amount" inputmode="decimal" placeholder="0,00" autocomplete="off" />
        </div>
        <div class="field">
          <label for="category">Categoria</label>
          <select id="category" class="input" formControlName="categoryId">
            <option [ngValue]="null" disabled>Selecione</option>
            @for (c of formCategories(); track c.id) {
              <option [ngValue]="c.id">{{ c.name }}</option>
            }
          </select>
        </div>
        @if (formType() === 'EXPENSE') {
          <div class="field">
            <label for="merchant">Empresa (opcional)</label>
            <select id="merchant" class="input" formControlName="merchantId" (change)="onMerchantChange()">
              <option [ngValue]="null">Nenhuma</option>
              @for (m of expenseMerchants(); track m.id) {
                <option [ngValue]="m.id">{{ m.name }}</option>
              }
            </select>
          </div>
        }
        <div class="grid grid-2">
          <div class="field">
            <label for="date">Data</label>
            <input id="date" class="input" type="date" formControlName="occurredOn" />
          </div>
          <div class="field">
            <label for="description">Descrição</label>
            <input id="description" class="input" formControlName="description" maxlength="255" placeholder="Ex.: almoço" />
          </div>
        </div>
        <div class="row actions">
          @if (editing()) {
            <button type="button" class="btn btn-danger" (click)="remove()" [disabled]="saving()"><app-icon name="trash" [size]="18" /> Excluir</button>
          }
          <span class="spacer"></span>
          <button type="button" class="btn" (click)="closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">{{ saving() ? 'Salvando…' : 'Salvar' }}</button>
        </div>
      </form>
    </app-modal>
  `,
  styles: `
    .filters { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .nav { display: flex; align-items: center; gap: 4px; }
    .period-label { min-width: 150px; text-align: center; font-weight: 600; }
    .cat-filter { width: auto; min-width: 200px; }
    .totals .card { display: grid; gap: 2px; padding: 14px 18px; }
    .totals b { font-size: 1.2rem; }
    .list-card { padding: 8px 18px; }
    .day { font-size: 0.8rem; color: var(--text-muted); margin: 14px 0 2px; font-weight: 500; }
    .day::first-letter { text-transform: uppercase; }
    ul.list { list-style: none; margin: 0; padding: 0; }
    .tx { width: 100%; background: none; border: 0; border-bottom: 1px solid var(--border); color: inherit; font: inherit; text-align: left; cursor: pointer; }
    li:last-child .tx { border-bottom: 0; }
    .tx:hover { background: var(--surface-2); }
    .info { display: grid; flex: 1; min-width: 0; }
    .title { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sub { font-size: 0.8rem; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .amount { font-weight: 600; white-space: nowrap; }
    .stale { opacity: 0.6; }
    .type-toggle { width: 100%; }
    .type-toggle button { flex: 1; }
    .amount-input { font-size: 1.4rem; font-weight: 600; }
    .actions { flex-wrap: wrap; }
    @media (max-width: 640px) {
      .filters { flex-direction: column; align-items: stretch; }
      .nav { justify-content: space-between; }
      .segmented button { flex: 1; }
      .cat-filter { width: 100%; }
      .totals { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
      .totals .card { padding: 10px; font-size: 0.8rem; }
      .totals b { font-size: 0.95rem; }
    }
  `,
})
export class TransactionsPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly categories = signal<Category[]>([]);
  protected readonly merchants = signal<Merchant[]>([]);
  protected readonly items = signal<Transaction[]>([]);
  protected readonly loaded = signal(false);
  protected readonly loading = signal(false);
  protected readonly listError = signal<string | null>(null);

  private readonly now = new Date();
  protected readonly year = signal(this.now.getFullYear());
  protected readonly month = signal(this.now.getMonth() + 1);
  protected readonly typeFilter = signal<TransactionType | null>(null);
  protected readonly categoryFilter = signal<number | null>(null);

  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Transaction | null>(null);
  protected readonly formType = signal<TransactionType>('EXPENSE');
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    amount: ['', Validators.required],
    categoryId: this.fb.control<number | null>(null, Validators.required),
    merchantId: this.fb.control<number | null>(null),
    occurredOn: [todayIso(), Validators.required],
    description: [''],
  });

  protected readonly monthLabel = computed(() => periodLabel('MONTH', this.year(), this.month()));
  protected readonly filterCategories = computed(() => {
    const t = this.typeFilter();
    return this.categories().filter((c) => !t || c.type === t);
  });
  protected readonly formCategories = computed(() => this.categories().filter((c) => c.type === this.formType()));
  protected readonly expenseMerchants = computed(() => this.merchants().filter((m) => m.category.type === 'EXPENSE'));

  protected readonly totals = computed(() =>
    this.items().reduce(
      (acc, t) => (t.type === 'INCOME' ? { ...acc, income: acc.income + t.amount } : { ...acc, expense: acc.expense + t.amount }),
      { income: 0, expense: 0 },
    ),
  );

  protected readonly groups = computed<DayGroup[]>(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of this.items()) {
      const list = map.get(t.occurredOn) ?? [];
      list.push(t);
      map.set(t.occurredOn, list);
    }
    return [...map.entries()].map(([date, items]) => ({ date, items }));
  });

  constructor() {
    forkJoin([this.api.categories(), this.api.merchants()]).subscribe({
      next: ([cats, merchants]) => {
        this.categories.set(cats);
        this.merchants.set(merchants);
        this.loaded.set(true);
        if (this.route.snapshot.queryParamMap.get('novo') && cats.length > 0) {
          this.openNew();
          this.router.navigate([], { queryParams: {}, replaceUrl: true });
        }
      },
      error: (err) => this.listError.set(errorMessage(err)),
    });
    effect(() => this.load(this.year(), this.month(), this.typeFilter(), this.categoryFilter()));
  }

  protected color(c: Category): string {
    return categoryColor(c.id, c.color);
  }

  protected moveMonth(delta: number): void {
    const next = shiftPeriod('MONTH', this.year(), this.month(), delta);
    this.year.set(next.year);
    this.month.set(next.number);
  }

  protected setType(t: TransactionType | null): void {
    this.typeFilter.set(t);
    const cat = this.categories().find((c) => c.id === this.categoryFilter());
    if (t && cat && cat.type !== t) this.categoryFilter.set(null);
  }

  protected setCategory(value: string): void {
    this.categoryFilter.set(value ? Number(value) : null);
  }

  protected openNew(): void {
    this.editing.set(null);
    this.formError.set(null);
    this.formType.set(this.typeFilter() ?? 'EXPENSE');
    this.form.reset({ amount: '', categoryId: null, merchantId: null, occurredOn: this.defaultDate(), description: '' });
    this.modalOpen.set(true);
  }

  protected openEdit(t: Transaction): void {
    this.editing.set(t);
    this.formError.set(null);
    this.formType.set(t.type);
    this.form.reset({
      amount: t.amount.toFixed(2).replace('.', ','),
      categoryId: t.category.id,
      merchantId: t.merchant?.id ?? null,
      occurredOn: t.occurredOn,
      description: t.description ?? '',
    });
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
  }

  protected setFormType(t: TransactionType): void {
    if (t === this.formType()) return;
    this.formType.set(t);
    this.form.patchValue({ categoryId: null, merchantId: null });
  }

  /** Escolher a empresa preenche a categoria dela. */
  protected onMerchantChange(): void {
    const merchant = this.merchants().find((m) => m.id === this.form.value.merchantId);
    if (merchant) this.form.patchValue({ categoryId: merchant.category.id });
  }

  protected save(): void {
    const v = this.form.getRawValue();
    const amount = parseAmount(v.amount);
    if (amount === null || amount <= 0) {
      this.formError.set('Informe um valor válido, ex.: 8,50.');
      return;
    }
    if (!v.categoryId) {
      this.formError.set('Escolha uma categoria.');
      return;
    }
    const body = {
      categoryId: v.categoryId,
      merchantId: this.formType() === 'EXPENSE' ? v.merchantId : null,
      amount,
      description: v.description?.trim() || null,
      occurredOn: v.occurredOn || null,
    };
    this.saving.set(true);
    const editing = this.editing();
    const req = editing ? this.api.updateTransaction(editing.id, body) : this.api.createTransaction(body);
    req.subscribe({
      next: () => this.afterChange(),
      error: (err) => {
        this.formError.set(errorMessage(err));
        this.saving.set(false);
      },
    });
  }

  protected remove(): void {
    const t = this.editing();
    if (!t || !confirm('Excluir este lançamento?')) return;
    this.saving.set(true);
    this.api.deleteTransaction(t.id).subscribe({
      next: () => this.afterChange(),
      error: (err) => {
        this.formError.set(errorMessage(err));
        this.saving.set(false);
      },
    });
  }

  private afterChange(): void {
    this.saving.set(false);
    this.modalOpen.set(false);
    this.load(this.year(), this.month(), this.typeFilter(), this.categoryFilter());
  }

  /** No mes atual sugere hoje; em outro mes, o dia 1 dele. */
  private defaultDate(): string {
    const now = new Date();
    if (this.year() === now.getFullYear() && this.month() === now.getMonth() + 1) return todayIso();
    return toIso(new Date(this.year(), this.month() - 1, 1));
  }

  private load(year: number, month: number, type: TransactionType | null, categoryId: number | null): void {
    const from = toIso(new Date(year, month - 1, 1));
    const to = toIso(new Date(year, month, 0));
    this.loading.set(true);
    this.listError.set(null);
    this.api.transactions({ from, to, type, categoryId }).subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: (err) => {
        this.listError.set(errorMessage(err, 'Não foi possível carregar os lançamentos.'));
        this.loading.set(false);
      },
    });
  }
}
