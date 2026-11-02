import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/format';
import { Category, Merchant } from '../../core/models';
import { categoryColor } from '../../shared/category-breakdown';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';

@Component({
  selector: 'app-merchants',
  imports: [ReactiveFormsModule, RouterLink, Icon, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1>Empresas</h1>
          <p class="muted sub">
            <app-icon name="discord" [size]="16" /> O bot do Discord usa estes nomes para saber a categoria do gasto.
            Ex.: "gastei 8 reais na cantina central" → Alimentação.
          </p>
        </div>
        <button type="button" class="btn btn-primary" (click)="openNew()" [disabled]="expenseCategories().length === 0">
          <app-icon name="plus" [size]="18" /> Nova
        </button>
      </div>

      @if (error()) {
        <div class="form-error" role="alert">{{ error() }}</div>
      }
      @if (loaded() && expenseCategories().length === 0) {
        <div class="card empty">Crie uma categoria de gasto primeiro. <a routerLink="/categorias">Criar categoria</a></div>
      }

      <div class="card">
        @if (items().length === 0) {
          <p class="empty">Nenhuma empresa cadastrada.</p>
        } @else {
          <ul class="list">
            @for (m of items(); track m.id) {
              <li class="list-item">
                <span class="info">
                  <span class="name">{{ m.name }}</span>
                  <span class="muted cat"><i class="dot" [style.background]="color(m.category)"></i>{{ m.category.name }}</span>
                </span>
                <button type="button" class="btn btn-ghost btn-icon" (click)="openEdit(m)" [attr.aria-label]="'Editar ' + m.name"><app-icon name="edit" [size]="18" /></button>
                <button type="button" class="btn btn-ghost btn-icon btn-danger" (click)="remove(m)" [attr.aria-label]="'Excluir ' + m.name"><app-icon name="trash" [size]="18" /></button>
              </li>
            }
          </ul>
        }
      </div>
    </section>

    <app-modal [title]="editing() ? 'Editar empresa' : 'Nova empresa'" [open]="modalOpen()" (closed)="modalOpen.set(false)">
      <form class="form-grid" [formGroup]="form" (ngSubmit)="save()">
        @if (formError()) {
          <div class="form-error" role="alert">{{ formError() }}</div>
        }
        <div class="field">
          <label for="name">Nome</label>
          <input id="name" class="input" formControlName="name" maxlength="80" placeholder="Ex.: Cantina Central" />
        </div>
        <div class="field">
          <label for="category">Categoria</label>
          <select id="category" class="input" formControlName="categoryId">
            <option [ngValue]="null" disabled>Selecione</option>
            @for (c of expenseCategories(); track c.id) {
              <option [ngValue]="c.id">{{ c.name }}</option>
            }
          </select>
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
    .sub { margin: 4px 0 0; display: flex; gap: 6px; align-items: flex-start; max-width: 560px; }
    ul.list { list-style: none; margin: 0; padding: 0; }
    .info { display: grid; flex: 1; min-width: 0; }
    .name { font-weight: 500; }
    .cat { display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; }
  `,
})
export class MerchantsPage {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly items = signal<Merchant[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly loaded = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Merchant | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly expenseCategories = computed(() => this.categories().filter((c) => c.type === 'EXPENSE'));

  protected readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(80)]),
    categoryId: this.fb.control<number | null>(null, Validators.required),
  });

  constructor() {
    this.load();
  }

  protected color(c: Category): string {
    return categoryColor(c.id, c.color);
  }

  protected openNew(): void {
    this.editing.set(null);
    this.formError.set(null);
    this.form.reset({ name: '', categoryId: null });
    this.modalOpen.set(true);
  }

  protected openEdit(m: Merchant): void {
    this.editing.set(m);
    this.formError.set(null);
    this.form.reset({ name: m.name, categoryId: m.category.id });
    this.modalOpen.set(true);
  }

  protected save(): void {
    const { name, categoryId } = this.form.getRawValue();
    if (!name.trim() || !categoryId) {
      this.formError.set('Informe nome e categoria.');
      return;
    }
    const editing = this.editing();
    this.saving.set(true);
    const body = { name, categoryId };
    const req = editing ? this.api.updateMerchant(editing.id, body) : this.api.createMerchant(body);
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

  protected remove(m: Merchant): void {
    if (!confirm(`Excluir a empresa "${m.name}"?`)) return;
    this.api.deleteMerchant(m.id).subscribe({
      next: () => this.load(),
      error: (err) => this.error.set(errorMessage(err)),
    });
  }

  private load(): void {
    this.error.set(null);
    forkJoin([this.api.merchants(), this.api.categories()]).subscribe({
      next: ([merchants, categories]) => {
        this.items.set(merchants);
        this.categories.set(categories);
        this.loaded.set(true);
      },
      error: (err) => this.error.set(errorMessage(err)),
    });
  }
}
