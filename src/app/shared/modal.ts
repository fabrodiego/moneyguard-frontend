import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { Icon } from './icon';

/** Dialogo nativo (<dialog>): foco preso, Esc fecha, vira folha inferior no celular. */
@Component({
  selector: 'app-modal',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg (close)="closed.emit()" (click)="onBackdrop($event)" [attr.aria-label]="title()">
      <div class="sheet">
        <header>
          <h2>{{ title() }}</h2>
          <button type="button" class="btn btn-ghost btn-icon" (click)="dlg.close()" aria-label="Fechar">
            <app-icon name="close" />
          </button>
        </header>
        <ng-content />
      </div>
    </dialog>
  `,
  styles: `
    dialog {
      border: 1px solid var(--border); border-radius: var(--radius); padding: 0;
      background: var(--surface-1); color: var(--text-primary);
      width: min(520px, calc(100vw - 32px)); max-height: calc(100dvh - 32px);
      box-shadow: var(--shadow), var(--glow);
    }
    dialog::backdrop { background: rgb(0 0 0 / 0.65); backdrop-filter: blur(2px); }
    .sheet { padding: 18px; display: grid; gap: 16px; }
    header { display: flex; align-items: center; justify-content: space-between; }
    @media (max-width: 640px) {
      dialog {
        width: 100vw; max-width: 100vw; margin: auto 0 0; border-radius: var(--radius) var(--radius) 0 0;
        padding-bottom: var(--safe-bottom);
      }
    }
  `,
})
export class Modal {
  readonly title = input.required<string>();
  readonly open = input(false);
  readonly closed = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      if (this.open() && !el.open) el.showModal();
      if (!this.open() && el.open) el.close();
    });
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.dialog().nativeElement.close();
  }
}
