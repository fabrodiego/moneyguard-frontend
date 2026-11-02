import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BrlPipe, CATEGORY_COLORS } from '../core/format';
import { CategoryTotal } from '../core/models';

/** Ranking por categoria: barra horizontal + valor + participacao. */
@Component({
  selector: 'app-category-breakdown',
  imports: [BrlPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items().length === 0) {
      <p class="empty">{{ emptyText() }}</p>
    } @else {
      <ul>
        @for (c of items(); track c.categoryId) {
          <li>
            <div class="line">
              <span class="name"><i class="dot" [style.background]="colorOf(c)"></i>{{ c.name }}</span>
              <span class="num value">{{ c.total | brl }}</span>
            </div>
            <div class="track" aria-hidden="true">
              <span [style.width.%]="c.percent" [style.background]="colorOf(c)"></span>
            </div>
            <div class="meta muted">{{ c.percent.toFixed(1).replace('.', ',') }}% · {{ c.count }} {{ c.count === 1 ? 'lançamento' : 'lançamentos' }}</div>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
    .line { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
    .name { display: inline-flex; align-items: center; gap: 8px; font-weight: 500; min-width: 0; }
    .value { font-weight: 600; }
    .track { height: 8px; margin: 6px 0 4px; background: var(--surface-3); border-radius: 999px; overflow: hidden; }
    .track span { display: block; height: 100%; border-radius: 0 4px 4px 0; min-width: 2px; }
    .meta { font-size: 0.78rem; }
  `,
})
export class CategoryBreakdown {
  readonly items = input.required<CategoryTotal[]>();
  readonly emptyText = input('Nada no período.');

  protected colorOf(c: CategoryTotal): string {
    return categoryColor(c.categoryId, c.color);
  }
}

/** Cor da categoria: a escolhida pelo usuario ou uma fixa da paleta pelo id (nunca pela posicao). */
export function categoryColor(id: number, color: string | null): string {
  return color ?? CATEGORY_COLORS[id % CATEGORY_COLORS.length];
}
