import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { BrlPipe, DateBrPipe, errorMessage, monthShort, parseAmount } from '../../core/format';
import { Category, Frequency, Merchant, Recurrence, RecurrenceSummary, TransactionType } from '../../core/models';
import { categoryColor } from '../../shared/category-breakdown';
import { Combobox, ComboOption } from '../../shared/combobox';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';

@Component({
  selector: 'app-recurrences',
  imports: [ReactiveFormsModule, RouterLink, BrlPipe, DateBrPipe, Combobox, Icon, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1>Assinaturas</h1>
          <p class="muted sub">Gastos e rendas que se repetem. O MoneyGuard lança sozinho no dia da cobrança.</p>
        </div>
        <button type="button" class="btn btn-primary" (click)="openNew()" [disabled]="categories().length === 0">
          <app-icon name="plus" [size]="18" /> Nova
        </button>
      </div>

      @if (error()) {
        <div class="form-error" role="alert">{{ error() }}</div>
      }
      @if (loaded() && categories().length === 0) {
        <div class="card empty">Crie suas categorias primeiro. <a routerLink="/categorias">Criar categorias</a></div>
      }

      @if (summary(); as s) {
        <div class="grid grid-3">
          <div class="card stat"><span class="secondary">Gastos fixos por mês</span><b class="num expense">{{ s.monthlyExpenses | brl }}</b></div>
          <div class="card stat"><span class="secondary">Rendas fixas por mês</span><b class="num income">{{ s.monthlyIncomes | brl }}</b></div>
          <div class="card stat highlight"><span class="secondary">Sobra fixa por mês</span>
            <b class="num" [class.negative]="s.monthlyBalance < 0">{{ s.monthlyBalance | brl }}</b></div>
        </div>

        <div class="card">
          <h2 class="card-title">Próximos 30 dias</h2>
          @if (s.next30Days.length === 0) {
            <p class="empty">Nenhuma cobrança nos próximos 30 dias.</p>
          } @else {
            <ul class="list">
              @for (u of s.next30Days; track u.recurrenceId + u.dueOn) {
                <li class="list-item">
                  <span class="date num">{{ u.dueOn | dateBr }}</span>
                  <span class="spacer">{{ u.name }}</span>
                  <span class="num amount" [class.income]="u.type === 'INCOME'" [class.expense]="u.type === 'EXPENSE'">
                    {{ u.type === 'EXPENSE' ? '−' : '+' }}{{ u.amount | brl }}
                  </span>
                </li>
              }
            </ul>
          }
        </div>
      }

      <div class="card">
        <h2 class="card-title">Todas</h2>
        @if (items().length === 0) {
          <p class="empty">Nenhuma assinatura. Ex.: streaming R$ 55,90 todo dia 2, salário todo dia 5.</p>
        } @else {
          <ul class="list">
            @for (r of items(); track r.id) {
              <li class="list-item rec" [class.inactive]="!r.active || !r.nextDueOn">
                <i class="dot" [style.background]="color(r.category)"></i>
                <button type="button" class="info" (click)="openEdit(r)">
                  <span class="title">{{ r.name }}</span>
                  <span class="sub muted">
                    {{ r.category.name }} · {{ when(r) }}
                    @if (!r.active) { <span class="badge">Pausada</span> }
                    @else if (!r.nextDueOn) { <span class="badge">Encerrada</span> }
                    @else { · próxima {{ r.nextDueOn | dateBr }} }
                  </span>
                </button>
                <span class="right">
                  <span class="num amount" [class.income]="r.type === 'INCOME'" [class.expense]="r.type === 'EXPENSE'">
                    {{ r.type === 'EXPENSE' ? '−' : '+' }}{{ r.amount | brl }}
                  </span>
                  @if (r.frequency === 'YEARLY') { <span class="muted per-month num">{{ r.monthlyAmount | brl }}/mês</span> }
                </span>
                <button type="button" class="btn btn-ghost btn-icon" (click)="toggle(r)"
                        [attr.aria-label]="(r.active ? 'Pausar ' : 'Reativar ') + r.name" [title]="r.active ? 'Pausar' : 'Reativar'">
                  <app-icon [name]="r.active ? 'pause' : 'play'" [size]="18" />
                </button>
              </li>
            }
          </ul>
        }
      </div>
    </section>

    <app-modal [title]="editing() ? 'Editar assinatura' : 'Nova assinatura'" [open]="modalOpen()" (closed)="modalOpen.set(false)">
      <form class="form-grid" [formGroup]="form" (ngSubmit)="save()">
        @if (formError()) {
          <div class="form-error" role="alert">{{ formError() }}</div>
        }
        <div class="segmented toggle" role="group" aria-label="Tipo">
          <button type="button" [attr.aria-pressed]="formType() === 'EXPENSE'" (click)="setType('EXPENSE')">Gasto</button>
          <button type="button" [attr.aria-pressed]="formType() === 'INCOME'" (click)="setType('INCOME')">Renda</button>
        </div>
        <div class="grid grid-2">
          <div class="field">
            <label for="rname">Nome</label>
            <input id="rname" class="input" formControlName="name" maxlength="80" placeholder="Ex.: Streaming" />
          </div>
          <div class="field">
            <label for="ramount">Valor (R$)</label>
            <input id="ramount" class="input num" formControlName="amount" inputmode="decimal" placeholder="0,00" />
          </div>
        </div>
        <div class="field">
          <label for="rcat">Categoria</label>
          <app-combobox inputId="rcat" formControlName="categoryId" [options]="categoryOptions()"
                        placeholder="Digite o nome da categoria" createLabel="Criar categoria"
                        (create)="createCategory($event)" />
        </div>
        @if (formType() === 'EXPENSE') {
          <div class="field">
            <label for="rmerchant">Empresa (opcional)</label>
            <app-combobox inputId="rmerchant" formControlName="merchantId" [options]="merchantOptions()" [allowNone]="true"
                          placeholder="Digite o nome da empresa" createLabel="Criar empresa"
                          (valueChange)="onMerchantChange()" (create)="createMerchant($event)" />
          </div>
        }
        <div class="segmented toggle" role="group" aria-label="Frequência">
          <button type="button" [attr.aria-pressed]="formFrequency() === 'MONTHLY'" (click)="formFrequency.set('MONTHLY')">Mensal</button>
          <button type="button" [attr.aria-pressed]="formFrequency() === 'YEARLY'" (click)="formFrequency.set('YEARLY')">Anual</button>
        </div>
        <div class="grid grid-2">
          <div class="field">
            <label for="rday">Dia da cobrança</label>
            <input id="rday" class="input" type="number" min="1" max="31" formControlName="dayOfMonth" />
          </div>
          @if (formFrequency() === 'YEARLY') {
            <div class="field">
              <label for="rmonth">Mês</label>
              <select id="rmonth" class="input" formControlName="monthOfYear">
                @for (m of months; track m.value) {
                  <option [ngValue]="m.value">{{ m.label }}</option>
                }
              </select>
            </div>
          }
        </div>
        <div class="grid grid-2">
          <div class="field">
            <label for="rstart">Começa em</label>
            <input id="rstart" class="input" type="date" formControlName="startDate" />
          </div>
          <div class="field">
            <label for="rend">Termina em (opcional)</label>
            <input id="rend" class="input" type="date" formControlName="endDate" />
          </div>
        </div>
        <p class="muted hint">
          Dia 31 em mês curto vira o último dia do mês. Se a cobrança for hoje, já entra nos lançamentos ao salvar.
          Nada é lançado retroativo.
        </p>
        <div class="row wrap">
          @if (editing()) {
            <button type="button" class="btn btn-danger" (click)="remove()" [disabled]="saving()"><app-icon name="trash" [size]="18" /> Excluir</button>
          }
          <span class="spacer"></span>
          <button type="button" class="btn" (click)="modalOpen.set(false)">Cancelar</button>
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
    ul.list { list-style: none; margin: 0; padding: 0; }
    .date { color: var(--text-secondary); font-size: 0.85rem; min-width: 88px; }
    .amount { font-weight: 600; white-space: nowrap; }
    .rec.inactive { opacity: 0.55; }
    .info { flex: 1; min-width: 0; display: grid; text-align: left; background: none; border: 0; color: inherit; font: inherit; cursor: pointer; padding: 0; }
    .title { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sub { font-size: 0.8rem; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .right { display: grid; justify-items: end; }
    .per-month { font-size: 0.75rem; }
    .toggle { width: 100%; }
    .toggle button { flex: 1; }
    .hint { margin: 0; font-size: 0.8rem; }
  `,
})
export class RecurrencesPage {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: monthShort(i + 1).charAt(0).toUpperCase() + monthShort(i + 1).slice(1),
  }));

  protected readonly items = signal<Recurrence[]>([]);
  protected readonly summary = signal<RecurrenceSummary | null>(null);
  protected readonly categories = signal<Category[]>([]);
  protected readonly allMerchants = signal<Merchant[]>([]);
  protected readonly loaded = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Recurrence | null>(null);
  protected readonly formType = signal<TransactionType>('EXPENSE');
  protected readonly formFrequency = signal<Frequency>('MONTHLY');
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly formCategories = computed(() => this.categories().filter((c) => c.type === this.formType()));
  protected readonly categoryOptions = computed<ComboOption[]>(() => this.formCategories().map((c) => ({ id: c.id, label: c.name })));
  protected readonly merchantOptions = computed<ComboOption[]>(() =>
    this.merchants().map((m) => ({ id: m.id, label: m.name, hint: m.category.name })),
  );
  protected readonly merchants = computed(() => this.allMerchants().filter((m) => m.category.type === 'EXPENSE'));

  protected readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(80)]),
    amount: this.fb.nonNullable.control('', Validators.required),
    categoryId: this.fb.control<number | null>(null, Validators.required),
    merchantId: this.fb.control<number | null>(null),
    dayOfMonth: this.fb.nonNullable.control(1, [Validators.required, Validators.min(1), Validators.max(31)]),
    monthOfYear: this.fb.control<number | null>(1),
    startDate: this.fb.nonNullable.control(''),
    endDate: this.fb.nonNullable.control(''),
  });

  constructor() {
    this.load();
  }

  protected color(c: Category): string {
    return categoryColor(c.id, c.color);
  }

  protected when(r: Recurrence): string {
    return r.frequency === 'MONTHLY'
      ? `todo dia ${r.dayOfMonth}`
      : `todo ano em ${String(r.dayOfMonth).padStart(2, '0')}/${monthShort(r.monthOfYear ?? 1)}`;
  }

  /** Escolher a empresa preenche a categoria dela. */
  protected onMerchantChange(): void {
    const merchant = this.merchants().find((m) => m.id === this.form.value.merchantId);
    if (merchant) this.form.patchValue({ categoryId: merchant.category.id });
  }

  protected createCategory(name: string): void {
    if (!name) return this.formError.set('Digite o nome da nova categoria no campo.');
    this.formError.set(null);
    this.api.createCategory({ name, type: this.formType(), color: null }).subscribe({
      next: (c) => {
        this.categories.update((list) => [...list, c]);
        this.form.patchValue({ categoryId: c.id });
      },
      error: (err) => this.formError.set(errorMessage(err)),
    });
  }

  protected createMerchant(name: string): void {
    const categoryId = this.form.value.categoryId;
    if (!name) return this.formError.set('Digite o nome da nova empresa no campo.');
    if (!categoryId) return this.formError.set('Escolha a categoria antes de criar a empresa.');
    this.formError.set(null);
    this.api.createMerchant({ name, categoryId }).subscribe({
      next: (m) => {
        this.allMerchants.update((list) => [...list, m]);
        this.form.patchValue({ merchantId: m.id });
      },
      error: (err) => this.formError.set(errorMessage(err)),
    });
  }

  protected setType(t: TransactionType): void {
    if (t === this.formType()) return;
    this.formType.set(t);
    this.form.patchValue({ categoryId: null, merchantId: null });
  }

  protected openNew(): void {
    this.editing.set(null);
    this.formError.set(null);
    this.formType.set('EXPENSE');
    this.formFrequency.set('MONTHLY');
    const today = new Date();
    this.form.reset({
      name: '', amount: '', categoryId: null, merchantId: null,
      dayOfMonth: today.getDate(), monthOfYear: today.getMonth() + 1, startDate: '', endDate: '',
    });
    this.modalOpen.set(true);
  }

  protected openEdit(r: Recurrence): void {
    this.editing.set(r);
    this.formError.set(null);
    this.formType.set(r.type);
    this.formFrequency.set(r.frequency);
    this.form.reset({
      name: r.name,
      amount: r.amount.toFixed(2).replace('.', ','),
      categoryId: r.category.id,
      merchantId: r.merchant?.id ?? null,
      dayOfMonth: r.dayOfMonth,
      monthOfYear: r.monthOfYear ?? 1,
      startDate: r.startDate,
      endDate: r.endDate ?? '',
    });
    this.modalOpen.set(true);
  }

  protected save(): void {
    const v = this.form.getRawValue();
    const amount = parseAmount(v.amount);
    if (!v.name.trim() || amount === null || amount <= 0 || !v.categoryId) {
      this.formError.set('Informe nome, valor válido e categoria.');
      return;
    }
    const day = Number(v.dayOfMonth);
    if (!(day >= 1 && day <= 31)) {
      this.formError.set('O dia da cobrança vai de 1 a 31.');
      return;
    }
    const editing = this.editing();
    const body = {
      name: v.name,
      categoryId: v.categoryId,
      merchantId: this.formType() === 'EXPENSE' ? v.merchantId : null,
      amount,
      frequency: this.formFrequency(),
      dayOfMonth: day,
      monthOfYear: this.formFrequency() === 'YEARLY' ? v.monthOfYear : null,
      startDate: v.startDate || null,
      endDate: v.endDate || null,
      active: editing ? editing.active : true,
    };
    this.saving.set(true);
    const req = editing ? this.api.updateRecurrence(editing.id, body) : this.api.createRecurrence(body);
    req.subscribe({
      next: () => this.done(),
      error: (err) => this.fail(err),
    });
  }

  protected toggle(r: Recurrence): void {
    this.api
      .updateRecurrence(r.id, {
        name: r.name,
        categoryId: r.category.id,
        merchantId: r.merchant?.id ?? null,
        amount: r.amount,
        frequency: r.frequency,
        dayOfMonth: r.dayOfMonth,
        monthOfYear: r.monthOfYear,
        startDate: r.startDate,
        endDate: r.endDate,
        active: !r.active,
      })
      .subscribe({ next: () => this.load(), error: (err) => this.error.set(errorMessage(err)) });
  }

  protected remove(): void {
    const r = this.editing();
    if (!r || !confirm(`Excluir "${r.name}"? Os lançamentos já feitos continuam.`)) return;
    this.saving.set(true);
    this.api.deleteRecurrence(r.id).subscribe({ next: () => this.done(), error: (err) => this.fail(err) });
  }

  private done(): void {
    this.saving.set(false);
    this.modalOpen.set(false);
    this.load();
  }

  private fail(err: unknown): void {
    this.formError.set(errorMessage(err));
    this.saving.set(false);
  }

  private load(): void {
    this.error.set(null);
    forkJoin([this.api.recurrences(), this.api.recurrenceSummary(), this.api.categories(), this.api.merchants()]).subscribe({
      next: ([items, summary, categories, merchants]) => {
        this.items.set(items);
        this.summary.set(summary);
        this.categories.set(categories);
        this.allMerchants.set(merchants);
        this.loaded.set(true);
      },
      error: (err) => this.error.set(errorMessage(err)),
    });
  }
}
