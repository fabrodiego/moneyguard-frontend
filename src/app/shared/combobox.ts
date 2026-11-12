import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { Icon } from './icon';

export interface ComboOption {
  id: number;
  label: string;
  /** Texto menor a direita (ex.: categoria da empresa). */
  hint?: string;
}

let nextId = 0;

/** Sem acento e minusculo, caractere a caractere (mantem as posicoes para destacar o trecho). */
function fold(text: string): string {
  let out = '';
  for (const ch of text) out += (ch.normalize('NFD').replace(/\p{M}/gu, '') || ch).toLowerCase().charAt(0);
  return out;
}

/**
 * Campo de busca com lista: digita e filtra (comeca com > inicio de palavra > contem, este so com 3+ letras).
 * Setas navegam, Enter escolhe, Esc fecha. Opcional: linha "+ Criar" com o texto digitado.
 */
@Component({
  selector: 'app-combobox',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="combo" [class.open]="open()">
      <input #field class="input" type="text" autocomplete="off" spellcheck="false"
             [id]="inputId()" role="combobox" aria-autocomplete="list"
             [attr.aria-expanded]="open()" [attr.aria-controls]="listId"
             [attr.aria-activedescendant]="open() && active() >= 0 ? listId + '-' + active() : null"
             [placeholder]="shownPlaceholder()" [value]="text()"
             (focus)="onFocus()" (blur)="onBlur()" (input)="onInput($any($event.target).value)" (keydown)="onKey($event)" />
      @if (allowNone() && value() !== null) {
        <button type="button" class="clear" tabindex="-1" aria-label="Limpar" (mousedown)="$event.preventDefault()" (click)="clear()">
          <app-icon name="close" [size]="16" />
        </button>
      } @else {
        <span class="chev" aria-hidden="true"><app-icon name="chevron" [size]="16" /></span>
      }
      @if (open()) {
        <ul class="list" role="listbox" [id]="listId" #list>
          @if (allowNone() && !query().trim()) {
            <li role="option" [id]="listId + '-none'" class="none" [attr.aria-selected]="value() === null"
                (mousedown)="$event.preventDefault()" (click)="pickNone()">{{ noneLabel() }}</li>
          }
          @for (o of filtered(); track o.id; let i = $index) {
            <li role="option" [id]="listId + '-' + i" [class.active]="i === active()" [attr.aria-selected]="o.id === value()"
                (mousedown)="$event.preventDefault()" (click)="pick(o)" (mouseenter)="active.set(i)">
              <span class="label">
                @for (p of parts(o.label); track $index) {
                  @if (p.hit) {<mark>{{ p.text }}</mark>} @else {<span>{{ p.text }}</span>}
                }
              </span>
              @if (o.hint) { <span class="hint">{{ o.hint }}</span> }
              @if (o.id === value()) { <app-icon name="check" [size]="16" class="tick" /> }
            </li>
          }
          @if (canCreate()) {
            <li role="option" [id]="listId + '-' + filtered().length" class="create" [class.active]="active() === filtered().length"
                (mousedown)="$event.preventDefault()" (click)="emitCreate()" (mouseenter)="active.set(filtered().length)">
              <app-icon name="plus" [size]="16" />
              {{ createLabel() }}@if (query().trim()) { <b>"{{ query().trim() }}"</b> }
            </li>
          } @else if (filtered().length === 0) {
            <li class="empty">Nada encontrado</li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .combo { position: relative; }
    .input { padding-right: 38px; text-overflow: ellipsis; }
    .clear, .chev {
      position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
      width: 32px; height: 32px; display: grid; place-items: center; color: var(--text-muted);
      background: none; border: 0; border-radius: 6px; cursor: pointer;
    }
    .chev { pointer-events: none; }
    .clear:hover { color: var(--text-primary); background: var(--surface-2); }
    .list {
      position: absolute; z-index: 20; left: 0; right: 0; top: calc(100% + 4px);
      margin: 0; padding: 4px; list-style: none; max-height: 260px; overflow-y: auto;
      background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--radius-sm);
      box-shadow: var(--shadow);
    }
    li {
      display: flex; align-items: center; gap: 8px; padding: 10px; border-radius: 6px; cursor: pointer;
      min-height: 40px;
    }
    li.active { background: var(--surface-3); }
    .label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    mark { background: none; color: var(--accent); font-weight: 600; }
    .hint { color: var(--text-muted); font-size: 0.8rem; white-space: nowrap; }
    .tick { color: var(--accent); }
    .none { color: var(--text-secondary); }
    .create { color: var(--accent); border-top: 1px solid var(--border); border-radius: 0 0 6px 6px; margin-top: 2px; }
    .create b { margin-left: 4px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .empty { color: var(--text-muted); cursor: default; }
  `,
})
export class Combobox {
  readonly inputId = input.required<string>();
  readonly options = input.required<ComboOption[]>();
  readonly value = input<number | null>(null);
  readonly placeholder = input('Digite para buscar');
  /** Permite "nenhum" (limpar). */
  readonly allowNone = input(false);
  readonly noneLabel = input('Nenhuma');
  /** Se definido, mostra a linha "+ Criar ..." quando o texto nao bate com nenhuma opcao. */
  readonly createLabel = input<string | null>(null);

  readonly valueChange = output<number | null>();
  /** Texto digitado (pode ser vazio). */
  readonly create = output<string>();

  protected readonly listId = `combo-list-${nextId++}`;
  protected readonly open = signal(false);
  protected readonly editing = signal(false);
  protected readonly query = signal('');
  protected readonly active = signal(0);

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  private readonly list = viewChild<ElementRef<HTMLUListElement>>('list');

  private readonly selected = computed(() => this.options().find((o) => o.id === this.value()) ?? null);
  /** Ao focar o campo fica vazio para digitar; o escolhido aparece como dica. */
  protected readonly shownPlaceholder = computed(() =>
    this.editing() && this.selected() ? this.selected()!.label : this.placeholder(),
  );
  protected readonly text = computed(() => (this.editing() ? this.query() : this.selected()?.label ?? ''));

  protected readonly filtered = computed(() => {
    const q = fold(this.query().trim());
    const all = this.options();
    if (!q) return [...all].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    const rank = (label: string) => {
      const l = fold(label);
      if (l.startsWith(q)) return 0;
      if (l.includes(' ' + q)) return 1;
      // com 1-2 letras, "contem" traz quase tudo; so vale a partir de 3
      return q.length >= 3 && l.includes(q) ? 2 : -1;
    };
    return all
      .map((o) => ({ o, r: rank(o.label) }))
      .filter((x) => x.r >= 0)
      .sort((a, b) => a.r - b.r || a.o.label.localeCompare(b.o.label, 'pt-BR'))
      .map((x) => x.o);
  });

  protected readonly canCreate = computed(() => {
    if (!this.createLabel()) return false;
    const q = fold(this.query().trim());
    return !this.options().some((o) => fold(o.label) === q) || !q;
  });

  private get count(): number {
    return this.filtered().length + (this.canCreate() ? 1 : 0);
  }

  protected parts(label: string): { text: string; hit: boolean }[] {
    const q = fold(this.query().trim());
    const at = q ? fold(label).indexOf(q) : -1;
    if (at < 0) return [{ text: label, hit: false }];
    return [
      { text: label.slice(0, at), hit: false },
      { text: label.slice(at, at + q.length), hit: true },
      { text: label.slice(at + q.length), hit: false },
    ].filter((p) => p.text);
  }

  protected onFocus(): void {
    // limpa ja no foco (sem esperar a renderizacao) para a 1a tecla nao grudar no nome escolhido
    this.field().nativeElement.value = '';
    this.query.set('');
    this.editing.set(true);
    this.openList();
  }

  protected onBlur(): void {
    // texto apagado + permite nenhum = limpa; senao volta a mostrar o escolhido
    if (this.allowNone() && this.editing() && this.query() === '' && this.wasCleared) this.valueChange.emit(null);
    this.wasCleared = false;
    this.close();
  }

  private wasCleared = false;

  protected onInput(text: string): void {
    this.query.set(text);
    this.wasCleared = text === '';
    this.active.set(0);
    if (!this.open()) this.openList();
  }

  protected onKey(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) return this.openList();
        this.move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.move(-1);
        break;
      case 'Enter':
        if (!this.open()) return;
        event.preventDefault();
        this.chooseActive();
        break;
      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          event.stopPropagation();
          this.close();
          this.field().nativeElement.blur();
        }
        break;
      case 'Tab':
        if (this.open() && this.query().trim() && this.filtered().length > 0) this.chooseActive();
        break;
    }
  }

  protected pick(o: ComboOption): void {
    this.valueChange.emit(o.id);
    this.close();
    this.field().nativeElement.blur();
  }

  protected pickNone(): void {
    this.valueChange.emit(null);
    this.close();
    this.field().nativeElement.blur();
  }

  protected clear(): void {
    this.valueChange.emit(null);
    this.query.set('');
    this.field().nativeElement.focus();
  }

  protected emitCreate(): void {
    const text = this.query().trim();
    this.close();
    this.field().nativeElement.blur();
    this.create.emit(text);
  }

  private chooseActive(): void {
    const i = this.active();
    const list = this.filtered();
    if (i < list.length) this.pick(list[i]);
    else if (this.canCreate()) this.emitCreate();
  }

  private move(delta: number): void {
    const n = this.count;
    if (n === 0) return;
    this.active.set((this.active() + delta + n) % n);
    queueMicrotask(() => {
      const el = this.list()?.nativeElement.querySelector(`#${this.listId}-${this.active()}`);
      el?.scrollIntoView({ block: 'nearest' });
    });
  }

  private openList(): void {
    const idx = this.filtered().findIndex((o) => o.id === this.value());
    this.active.set(idx >= 0 ? idx : 0);
    this.open.set(true);
    // garante que a lista aparece inteira na tela (celular)
    setTimeout(() => this.list()?.nativeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50);
  }

  private close(): void {
    this.open.set(false);
    this.editing.set(false);
    this.query.set('');
  }
}
