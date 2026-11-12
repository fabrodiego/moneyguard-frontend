import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { BrlPipe, DateBrPipe, errorMessage } from '../../core/format';
import { Category, ImportItem, ImportPreview, Merchant, TransactionType } from '../../core/models';
import { Combobox, ComboOption } from '../../shared/combobox';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';

type Phase = 'upload' | 'review' | 'done';
type Action = 'approved' | 'skipped' | 'already';

const NEW = 'new';

/** Mesmo criterio da API para comparar textos do banco (sem acento, minusculo, espacos simples). */
function norm(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

@Component({
  selector: 'app-import',
  imports: [RouterLink, BrlPipe, DateBrPipe, Combobox, Icon, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1>Importar extrato</h1>
          <p class="muted sub">Banco Inter: extrato da conta (CSV) ou fatura do cartão (PDF).</p>
        </div>
        @if (phase() === 'review') {
          <button type="button" class="btn btn-ghost" (click)="restart()">Trocar arquivo</button>
        }
      </div>

      @if (error()) {
        <div class="form-error" role="alert">{{ error() }}</div>
      }

      @switch (phase()) {
        @case ('upload') {
          <label class="card drop" [class.over]="dragOver()" [class.busy]="uploading()"
                 (dragover)="$event.preventDefault(); dragOver.set(true)" (dragleave)="dragOver.set(false)"
                 (drop)="onDrop($event)">
            <input type="file" class="sr-only" accept=".csv,.pdf,text/csv,application/pdf"
                   [disabled]="uploading()" (change)="onPick($event)" />
            <app-icon name="upload" [size]="32" />
            <b>{{ uploading() ? 'Lendo arquivo…' : 'Escolher arquivo' }}</b>
            <span class="muted">ou arraste aqui · CSV ou PDF até 5 MB</span>
          </label>
          <div class="card tips">
            <p>Você revisa <b>um lançamento por vez</b>: confere empresa e categoria e aprova. Só o que você aprova é salvo.</p>
            <ul>
              <li>Pagamento de fatura e estornos ficam de fora sozinhos.</li>
              <li>Pix para amigos ou dinheiro que não é seu: é só <b>Pular</b>.</li>
              <li>A empresa que você escolher fica lembrada para o mesmo texto do banco nas próximas importações.</li>
              <li>O arquivo não é guardado.</li>
            </ul>
          </div>
        }

        @case ('review') {
          @if (current(); as item) {
            <div class="progress-head">
              <span><b>{{ kindLabel() }}</b> · {{ index() + 1 }} de {{ queue().length }}</span>
              <span class="muted">{{ approvedCount() }} aprovados · {{ skippedCount() }} pulados</span>
            </div>
            <div class="progress" role="progressbar" [attr.aria-valuenow]="index()" aria-valuemin="0" [attr.aria-valuemax]="queue().length">
              <span [style.width.%]="(index() / queue().length) * 100"></span>
            </div>

            @if (preview()?.warning) {
              <div class="warn" role="status">{{ preview()?.warning }}</div>
            }

            <div class="card item">
              <div class="item-top">
                <span class="secondary">{{ item.occurredOn | dateBr: 'long' }}</span>
                @if (item.history) { <span class="badge">{{ item.history }}</span> }
                @if (item.installment) { <span class="badge">Parcela {{ item.installment }}</span> }
              </div>
              <div class="num big" [class.income]="item.type === 'INCOME'" [class.expense]="item.type === 'EXPENSE'">
                {{ item.type === 'EXPENSE' ? '−' : '+' }}{{ item.amount | brl }}
                <span class="type">{{ item.type === 'EXPENSE' ? 'gasto' : 'renda' }}</span>
              </div>
              <div class="bank"><span class="muted">No banco:</span> {{ item.description }}</div>

              @if (item.ownTransfer) {
                <div class="hint"><span>Parece transferência para você mesmo. Normalmente é para <b>pular</b>.</span></div>
              }
              @if (item.suggestion && merchantId() === item.suggestion.id) {
                <div class="hint ok"><app-icon name="check" [size]="16" /><span>Empresa reconhecida: {{ item.suggestion.name }}</span></div>
              }
              @if (itemError()) {
                <div class="form-error" role="alert">{{ itemError() }}</div>
              }

              <div class="form-grid">
                <div class="field">
                  <label for="merchant">Empresa</label>
                  <app-combobox inputId="merchant" [options]="merchantOptions()" [value]="merchantId()" [allowNone]="true"
                                placeholder="Digite o nome da empresa" createLabel="Criar empresa"
                                (valueChange)="onMerchant($event)" (create)="openNewMerchant($event)" />
                </div>
                <div class="field">
                  <label for="category">Categoria</label>
                  <app-combobox inputId="category" [options]="categoryOptions()" [value]="categoryId()"
                                placeholder="Digite o nome da categoria" createLabel="Criar categoria"
                                (valueChange)="categoryId.set($event)" (create)="openNewCategory($event)" />
                </div>
                <div class="grid grid-2">
                  <div class="field">
                    <label for="date">Data</label>
                    <input id="date" class="input" type="date" [value]="occurredOn()" (input)="occurredOn.set($any($event.target).value)" />
                  </div>
                  <div class="field">
                    <label for="description">Descrição</label>
                    <input id="description" class="input" maxlength="255" [value]="description()"
                           (input)="description.set($any($event.target).value)" />
                  </div>
                </div>
              </div>

              <div class="row actions">
                <button type="button" class="btn btn-ghost" (click)="back()" [disabled]="!canGoBack() || saving()">
                  <app-icon name="undo" [size]="16" /> Voltar
                </button>
                <span class="spacer"></span>
                <button type="button" class="btn" (click)="skip()" [disabled]="saving()"><app-icon name="skip" [size]="16" /> Pular</button>
                <button type="button" class="btn btn-primary" (click)="approve()" [disabled]="saving() || !categoryId()">
                  <app-icon name="check" [size]="18" /> {{ saving() ? 'Salvando…' : 'Aprovar' }}
                </button>
              </div>
            </div>

            <div class="extras">
              @if (alreadyCount() > 0) {
                <p class="muted">{{ alreadyCount() }} {{ alreadyCount() === 1 ? 'linha já foi importada' : 'linhas já foram importadas' }} antes e não aparecem aqui.</p>
              }
              @if (preview()?.ignored?.length) {
                <details>
                  <summary class="muted">{{ preview()!.ignored.length }} ignoradas automaticamente</summary>
                  <ul class="ignored">
                    @for (i of preview()!.ignored; track $index) {
                      <li><span>{{ i.date | dateBr }} · {{ i.description }}</span><span class="num">{{ i.amount | brl }}</span><span class="badge">{{ i.reason }}</span></li>
                    }
                  </ul>
                </details>
              }
            </div>
          }
        }

        @case ('done') {
          <div class="card done">
            <app-icon name="check" [size]="32" />
            <h2>Importação concluída</h2>
            <p class="secondary">
              {{ approvedCount() }} {{ approvedCount() === 1 ? 'lançamento salvo' : 'lançamentos salvos' }} ·
              {{ skippedCount() }} {{ skippedCount() === 1 ? 'pulado' : 'pulados' }}
              @if (alreadyCount() > 0) { · {{ alreadyCount() }} já importados antes }
            </p>
            @if (queue().length === 0) {
              <p class="muted">Não havia nada novo para revisar neste arquivo.</p>
            }
            <div class="row wrap center">
              <button type="button" class="btn" (click)="restart()">Importar outro arquivo</button>
              <a class="btn btn-primary" routerLink="/lancamentos">Ver lançamentos</a>
            </div>
          </div>
        }
      }
    </section>

    <app-modal title="Nova empresa" [open]="modal() === 'merchant'" (closed)="modal.set(null)">
      <form class="form-grid" (submit)="$event.preventDefault(); saveMerchant()">
        @if (modalError()) {
          <div class="form-error" role="alert">{{ modalError() }}</div>
        }
        <div class="field">
          <label for="m-name">Nome</label>
          <input id="m-name" class="input" maxlength="80" [value]="mName()" (input)="mName.set($any($event.target).value)" />
          <span class="muted small">O texto "{{ current()?.description }}" vai ficar ligado a ela.</span>
        </div>
        <div class="field">
          <label for="m-cat">Categoria da empresa</label>
          <app-combobox inputId="m-cat" [options]="categoryOptions()" [value]="mCategory() === NEW || !mCategory() ? null : +mCategory()"
                        [placeholder]="mCategory() === NEW ? 'Nova categoria (abaixo)' : 'Digite o nome da categoria'"
                        createLabel="Nova categoria" (valueChange)="mCategory.set($event === null ? '' : String($event))"
                        (create)="mCategory.set(NEW); mNewCategory.set($event)" />
        </div>
        @if (mCategory() === NEW) {
          <div class="field">
            <label for="m-newcat">Nome da nova categoria ({{ typeLabel() }})</label>
            <input id="m-newcat" class="input" maxlength="60" [value]="mNewCategory()" (input)="mNewCategory.set($any($event.target).value)" />
          </div>
        }
        <div class="row">
          <span class="spacer"></span>
          <button type="button" class="btn" (click)="modal.set(null)">Cancelar</button>
          <button type="submit" class="btn btn-primary" [disabled]="modalSaving()">{{ modalSaving() ? 'Salvando…' : 'Criar' }}</button>
        </div>
      </form>
    </app-modal>

    <app-modal title="Nova categoria" [open]="modal() === 'category'" (closed)="modal.set(null)">
      <form class="form-grid" (submit)="$event.preventDefault(); saveCategory()">
        @if (modalError()) {
          <div class="form-error" role="alert">{{ modalError() }}</div>
        }
        <div class="field">
          <label for="c-name">Nome ({{ typeLabel() }})</label>
          <input id="c-name" class="input" maxlength="60" [value]="cName()" (input)="cName.set($any($event.target).value)" />
        </div>
        <div class="row">
          <span class="spacer"></span>
          <button type="button" class="btn" (click)="modal.set(null)">Cancelar</button>
          <button type="submit" class="btn btn-primary" [disabled]="modalSaving()">{{ modalSaving() ? 'Salvando…' : 'Criar' }}</button>
        </div>
      </form>
    </app-modal>
  `,
  styles: `
    .sub { margin: 4px 0 0; }
    .drop {
      display: grid; justify-items: center; gap: 6px; padding: 40px 16px; text-align: center; cursor: pointer;
      border-style: dashed; color: var(--text-secondary);
    }
    .drop b { color: var(--text-primary); font-size: 1.05rem; }
    .drop.over, .drop:hover { border-color: var(--accent-strong); background: var(--surface-2); }
    .drop.busy { opacity: 0.6; cursor: progress; }
    .drop:focus-within { outline: 2px solid var(--focus); outline-offset: 2px; }
    .tips p { margin: 0 0 8px; }
    .tips ul { margin: 0; padding-left: 20px; color: var(--text-secondary); display: grid; gap: 4px; }
    .progress-head { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: 0.9rem; }
    .warn { background: rgb(201 133 0 / 0.12); border: 1px solid #c98500; color: #f0b429; padding: 10px 12px; border-radius: var(--radius-sm); font-size: 0.9rem; }
    .item { display: grid; gap: 14px; }
    .item-top { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .big { font-size: 1.9rem; font-weight: 700; line-height: 1.1; }
    .type { font-size: 0.85rem; font-weight: 500; color: var(--text-muted); margin-left: 6px; }
    .bank { font-size: 0.95rem; word-break: break-word; }
    .hint { display: flex; gap: 6px; align-items: center; font-size: 0.9rem; color: var(--text-secondary);
            background: var(--surface-2); border-radius: var(--radius-sm); padding: 8px 12px; }
    .hint.ok { color: var(--success); }
    .actions { flex-wrap: wrap; }
    .extras { display: grid; gap: 8px; font-size: 0.9rem; }
    .extras p { margin: 0; }
    summary { cursor: pointer; }
    .ignored { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 6px; }
    .ignored li { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .ignored li span:first-child { flex: 1; min-width: 0; }
    .done { display: grid; justify-items: center; gap: 8px; text-align: center; padding: 32px 16px; color: var(--success); }
    .done h2, .done p { color: var(--text-primary); margin: 0; }
    .done p.secondary { color: var(--text-secondary); }
    .center { justify-content: center; margin-top: 8px; }
    .small { font-size: 0.8rem; }
    @media (max-width: 640px) {
      .actions .btn:not(.btn-ghost) { flex: 1; }
      .actions .spacer { display: none; }
      .actions .btn-ghost { order: 3; width: 100%; }
    }
  `,
})
export class ImportPage {
  private readonly api = inject(ApiService);
  protected readonly NEW = NEW;
  protected readonly String = String;

  protected readonly phase = signal<Phase>('upload');
  protected readonly uploading = signal(false);
  protected readonly dragOver = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly preview = signal<ImportPreview | null>(null);
  /** Fila de revisao: so o que ainda nao foi importado. */
  protected readonly queue = signal<ImportItem[]>([]);
  protected readonly index = signal(0);
  private readonly decisions = signal<Action[]>([]);
  protected readonly alreadyCount = signal(0);

  protected readonly categories = signal<Category[]>([]);
  protected readonly merchants = signal<Merchant[]>([]);

  protected readonly merchantId = signal<number | null>(null);
  protected readonly categoryId = signal<number | null>(null);
  protected readonly description = signal('');
  protected readonly occurredOn = signal('');
  protected readonly saving = signal(false);
  protected readonly itemError = signal<string | null>(null);

  protected readonly modal = signal<'merchant' | 'category' | null>(null);
  protected readonly modalSaving = signal(false);
  protected readonly modalError = signal<string | null>(null);
  protected readonly mName = signal('');
  protected readonly mCategory = signal('');
  protected readonly mNewCategory = signal('');
  protected readonly cName = signal('');

  protected readonly current = computed(() => this.queue()[this.index()] ?? null);
  protected readonly currentType = computed<TransactionType>(() => this.current()?.type ?? 'EXPENSE');
  protected readonly typeLabel = computed(() => (this.currentType() === 'EXPENSE' ? 'gasto' : 'renda'));
  protected readonly kindLabel = computed(() => (this.preview()?.kind === 'CARD_BILL' ? 'Fatura' : 'Extrato'));
  protected readonly categoriesForType = computed(() => this.categories().filter((c) => c.type === this.currentType()));
  protected readonly merchantsForType = computed(() =>
    this.merchants().filter((m) => m.category.type === this.currentType()),
  );
  protected readonly merchantOptions = computed<ComboOption[]>(() =>
    this.merchantsForType().map((m) => ({ id: m.id, label: m.name, hint: m.category.name })),
  );
  protected readonly categoryOptions = computed<ComboOption[]>(() =>
    this.categoriesForType().map((c) => ({ id: c.id, label: c.name })),
  );
  protected readonly approvedCount = computed(() => this.decisions().filter((d) => d === 'approved').length);
  protected readonly skippedCount = computed(() => this.decisions().filter((d) => d === 'skipped').length);
  protected readonly canGoBack = computed(() => this.decisions().at(-1) === 'skipped');

  constructor() {
    forkJoin([this.api.categories(), this.api.merchants()]).subscribe({
      next: ([cats, merchants]) => {
        this.categories.set(cats);
        this.merchants.set(merchants);
      },
      error: (err) => this.error.set(errorMessage(err)),
    });
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.upload(file);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.upload(file);
  }

  protected restart(): void {
    if (this.phase() === 'review' && this.index() < this.queue().length && !confirm('Parar esta revisão? O que já foi aprovado continua salvo.')) {
      return;
    }
    this.phase.set('upload');
    this.preview.set(null);
    this.queue.set([]);
    this.error.set(null);
  }

  protected onMerchant(id: number | null): void {
    this.merchantId.set(id);
    const merchant = this.merchants().find((m) => m.id === id);
    if (merchant) this.categoryId.set(merchant.category.id);
  }

  protected skip(): void {
    this.decisions.update((d) => [...d, 'skipped']);
    this.next();
  }

  /** So da para voltar sobre um "pular" (o aprovado ja foi salvo). */
  protected back(): void {
    if (!this.canGoBack()) return;
    this.decisions.update((d) => d.slice(0, -1));
    this.index.update((i) => i - 1);
    this.fillDraft();
  }

  protected approve(): void {
    const item = this.current();
    const categoryId = this.categoryId();
    if (!item || !categoryId) {
      this.itemError.set('Escolha uma categoria.');
      return;
    }
    if (!this.occurredOn()) {
      this.itemError.set('Informe a data.');
      return;
    }
    const merchantId = this.merchantId();
    this.saving.set(true);
    this.itemError.set(null);
    this.api
      .importApprove({
        importKey: item.importKey,
        type: item.type,
        categoryId,
        merchantId,
        amount: item.amount,
        description: this.description().trim() || null,
        occurredOn: this.occurredOn(),
        alias: merchantId ? item.description : null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          if (merchantId) this.learn(item, merchantId);
          this.decisions.update((d) => [...d, 'approved']);
          this.next();
        },
        error: (err) => {
          this.saving.set(false);
          if (err instanceof HttpErrorResponse && err.status === 409) {
            this.alreadyCount.update((n) => n + 1);
            this.decisions.update((d) => [...d, 'already']);
            this.next();
            return;
          }
          this.itemError.set(errorMessage(err));
        },
      });
  }

  /** name = texto digitado na busca; vazio usa o texto do banco. */
  protected openNewMerchant(name = ''): void {
    const item = this.current();
    this.modalError.set(null);
    this.mName.set((name || item?.description || '').slice(0, 80));
    this.mCategory.set(this.categoryId() ? String(this.categoryId()) : this.categoriesForType().length ? '' : NEW);
    this.mNewCategory.set('');
    this.modal.set('merchant');
  }

  protected openNewCategory(name = ''): void {
    this.modalError.set(null);
    this.cName.set(name.slice(0, 60));
    this.modal.set('category');
  }

  protected saveMerchant(): void {
    const name = this.mName().trim();
    const newCategory = this.mCategory() === NEW;
    if (!name) return this.modalError.set('Informe o nome da empresa.');
    if (!newCategory && !this.mCategory()) return this.modalError.set('Escolha a categoria da empresa.');
    if (newCategory && !this.mNewCategory().trim()) return this.modalError.set('Informe o nome da nova categoria.');

    this.modalSaving.set(true);
    const category$ = newCategory
      ? this.api.createCategory({ name: this.mNewCategory().trim(), type: this.currentType(), color: null })
      : of(this.categories().find((c) => c.id === Number(this.mCategory()))!);
    category$
      .pipe(
        switchMap((category) => {
          if (newCategory) this.categories.update((list) => [...list, category]);
          return this.api.createMerchant({ name, categoryId: category.id });
        }),
      )
      .subscribe({
        next: (merchant) => {
          this.merchants.update((list) => [...list, merchant].sort((a, b) => a.name.localeCompare(b.name)));
          this.merchantId.set(merchant.id);
          this.categoryId.set(merchant.category.id);
          this.modalSaving.set(false);
          this.modal.set(null);
        },
        error: (err) => {
          this.modalError.set(errorMessage(err));
          this.modalSaving.set(false);
        },
      });
  }

  protected saveCategory(): void {
    const name = this.cName().trim();
    if (!name) return this.modalError.set('Informe o nome.');
    this.modalSaving.set(true);
    this.api.createCategory({ name, type: this.currentType(), color: null }).subscribe({
      next: (category) => {
        this.categories.update((list) => [...list, category]);
        this.categoryId.set(category.id);
        this.modalSaving.set(false);
        this.modal.set(null);
      },
      error: (err) => {
        this.modalError.set(errorMessage(err));
        this.modalSaving.set(false);
      },
    });
  }

  private upload(file: File): void {
    if (file.size > 5 * 1024 * 1024) {
      this.error.set('Arquivo maior que 5 MB.');
      return;
    }
    this.uploading.set(true);
    this.error.set(null);
    this.api.importPreview(file).subscribe({
      next: (preview) => {
        const pending = preview.items.filter((i) => !i.alreadyImported);
        this.preview.set(preview);
        this.queue.set(pending);
        this.alreadyCount.set(preview.items.length - pending.length);
        this.decisions.set([]);
        this.index.set(0);
        this.uploading.set(false);
        if (pending.length === 0) {
          this.phase.set('done');
        } else {
          this.phase.set('review');
          this.fillDraft();
        }
      },
      error: (err) => {
        this.error.set(errorMessage(err, 'Não foi possível ler o arquivo.'));
        this.uploading.set(false);
      },
    });
  }

  private next(): void {
    this.index.update((i) => i + 1);
    if (this.index() >= this.queue().length) {
      this.phase.set('done');
      return;
    }
    this.fillDraft();
  }

  /** Preenche o formulario com a sugestao da linha atual. */
  private fillDraft(): void {
    const item = this.current();
    if (!item) return;
    const suggestion = item.suggestion ? this.merchants().find((m) => m.id === item.suggestion!.id) ?? item.suggestion : null;
    this.merchantId.set(suggestion?.id ?? null);
    this.categoryId.set(suggestion?.category.id ?? null);
    this.description.set(item.suggestedDescription);
    this.occurredOn.set(item.occurredOn);
    this.itemError.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** A API aprendeu o apelido; aplica a mesma sugestao nas proximas linhas com o mesmo texto. */
  private learn(item: ImportItem, merchantId: number): void {
    const merchant = this.merchants().find((m) => m.id === merchantId);
    if (!merchant) return;
    const key = norm(item.description);
    const from = this.index() + 1;
    this.queue.update((list) =>
      list.map((i, idx) =>
        idx >= from && norm(i.description) === key && i.type === merchant.category.type ? { ...i, suggestion: merchant } : i,
      ),
    );
  }
}
