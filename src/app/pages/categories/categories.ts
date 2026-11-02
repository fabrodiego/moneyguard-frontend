import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { CATEGORY_COLORS, errorMessage } from '../../core/format';
import { Category, TransactionType } from '../../core/models';
import { categoryColor } from '../../shared/category-breakdown';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';

@Component({
  selector: 'app-categories',
  imports: [ReactiveFormsModule, Icon, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1>Categorias</h1>
          <p class="muted sub">Organize seus gastos e rendas do seu jeito.</p>
        </div>
        <button type="button" class="btn btn-primary" (click)="openNew('EXPENSE')"><app-icon name="plus" [size]="18" /> Nova</button>
      </div>

      @if (error()) {
        <div class="form-error" role="alert">{{ error() }}</div>
      }

      <div class="grid grid-2">
        @for (group of groups(); track group.type) {
          <div class="card">
            <div class="row">
              <h2 class="card-title" style="margin: 0">{{ group.title }}</h2>
              <span class="spacer"></span>
              <button type="button" class="btn btn-ghost btn-sm" (click)="openNew(group.type)"><app-icon name="plus" [size]="16" /> Adicionar</button>
            </div>
            @if (group.items.length === 0) {
              <p class="empty">{{ group.empty }}</p>
            } @else {
              <ul class="list">
                @for (c of group.items; track c.id) {
                  <li class="list-item">
                    <i class="dot" [style.background]="color(c)"></i>
                    <span class="spacer">{{ c.name }}</span>
                    <button type="button" class="btn btn-ghost btn-icon" (click)="openEdit(c)" [attr.aria-label]="'Editar ' + c.name"><app-icon name="edit" [size]="18" /></button>
                    <button type="button" class="btn btn-ghost btn-icon btn-danger" (click)="remove(c)" [attr.aria-label]="'Excluir ' + c.name"><app-icon name="trash" [size]="18" /></button>
                  </li>
                }
              </ul>
            }
          </div>
        }
      </div>
    </section>

    <app-modal [title]="editing() ? 'Editar categoria' : 'Nova categoria'" [open]="modalOpen()" (closed)="modalOpen.set(false)">
      <form class="form-grid" [formGroup]="form" (ngSubmit)="save()">
        @if (formError()) {
          <div class="form-error" role="alert">{{ formError() }}</div>
        }
        @if (!editing()) {
          <div class="segmented type-toggle" role="group" aria-label="Tipo">
            <button type="button" [attr.aria-pressed]="formType() === 'EXPENSE'" (click)="formType.set('EXPENSE')">Gasto (−)</button>
            <button type="button" [attr.aria-pressed]="formType() === 'INCOME'" (click)="formType.set('INCOME')">Renda (+)</button>
          </div>
        }
        <div class="field">
          <label for="name">Nome</label>
          <input id="name" class="input" formControlName="name" maxlength="60" placeholder="Ex.: Alimentação" />
        </div>
        <div class="field">
          <span class="label">Cor</span>
          <div class="swatches" role="radiogroup" aria-label="Cor">
            @for (c of colors; track c) {
              <button type="button" class="swatch" role="radio" [style.background]="c" [attr.aria-checked]="form.value.color === c"
                      [attr.aria-label]="'Cor ' + c" (click)="form.patchValue({ color: c })"></button>
            }
          </div>
        </div>
        <div class="row">
          <span class="spacer"></span>
          <button type="button" class="btn" (click)="modalOpen.set(false)">Cancelar</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">{{ saving() ? 'Salvando…' : 'Salvar' }}</button>
        </div>
      </form>
    </app-modal>
  `,
  styles: `
    .sub { margin: 4px 0 0; }
    ul.list { list-style: none; margin: 8px 0 0; padding: 0; }
    .type-toggle { width: 100%; }
    .type-toggle button { flex: 1; }
    .label { font-size: 0.85rem; color: var(--text-secondary); font-weight: 500; }
    .swatches { display: flex; flex-wrap: wrap; gap: 10px; }
    .swatch { width: 34px; height: 34px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; box-shadow: 0 0 0 2px var(--surface-1) inset; }
    .swatch[aria-checked="true"] { border-color: var(--text-primary); }
  `,
})
export class CategoriesPage {
  private readonly api = inject(ApiService);
  protected readonly colors = CATEGORY_COLORS;

  protected readonly items = signal<Category[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Category | null>(null);
  protected readonly formType = signal<TransactionType>('EXPENSE');
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    color: [CATEGORY_COLORS[0]],
  });

  protected readonly groups = computed(() => [
    { type: 'EXPENSE' as const, title: 'Gastos', empty: 'Ex.: Alimentação, Lazer, Transporte, Contas da casa.', items: this.items().filter((c) => c.type === 'EXPENSE') },
    { type: 'INCOME' as const, title: 'Rendas', empty: 'Ex.: Salário, Freelance, Rendimentos.', items: this.items().filter((c) => c.type === 'INCOME') },
  ]);

  constructor() {
    this.load();
  }

  protected color(c: Category): string {
    return categoryColor(c.id, c.color);
  }

  protected openNew(type: TransactionType): void {
    this.editing.set(null);
    this.formType.set(type);
    this.formError.set(null);
    const used = this.items().length;
    this.form.reset({ name: '', color: CATEGORY_COLORS[used % CATEGORY_COLORS.length] });
    this.modalOpen.set(true);
  }

  protected openEdit(c: Category): void {
    this.editing.set(c);
    this.formError.set(null);
    this.form.reset({ name: c.name, color: c.color ?? categoryColor(c.id, null) });
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.formError.set('Informe o nome.');
      return;
    }
    const { name, color } = this.form.getRawValue();
    const editing = this.editing();
    this.saving.set(true);
    const req = editing
      ? this.api.updateCategory(editing.id, { name, color })
      : this.api.createCategory({ name, color, type: this.formType() });
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.load();
      },
      error: (err) => {
        this.formError.set(errorMessage(err));
        this.saving.set(false);
      },
    });
  }

  protected remove(c: Category): void {
    if (!confirm(`Excluir a categoria "${c.name}"?`)) return;
    this.api.deleteCategory(c.id).subscribe({
      next: () => this.load(),
      error: (err) => this.error.set(errorMessage(err)),
    });
  }

  private load(): void {
    this.error.set(null);
    this.api.categories().subscribe({
      next: (items) => this.items.set(items),
      error: (err) => this.error.set(errorMessage(err)),
    });
  }
}
