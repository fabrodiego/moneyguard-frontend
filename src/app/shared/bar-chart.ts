import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { formatBRL, formatCompact } from '../core/format';
import { SeriesPoint } from '../core/models';

interface Bar {
  x: number;
  y: number;
  w: number;
  h: number;
  path: string;
}

interface Band {
  index: number;
  x: number;
  w: number;
  label: string;
  showLabel: boolean;
  income: Bar;
  expense: Bar;
  point: SeriesPoint;
}

const HEIGHT = 260;
const PAD = { top: 12, right: 8, bottom: 28, left: 52 };
const MAX_BAR = 24;
const GAP = 2;

/** Colunas agrupadas renda x gasto, com tooltip por fatia e alternancia para tabela. */
@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <div class="legend" aria-hidden="true">
        <span><i style="background: var(--series-income)"></i>Rendas</span>
        <span><i style="background: var(--series-expense)"></i>Gastos</span>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" (click)="showTable.set(!showTable())"
              [attr.aria-pressed]="showTable()">
        {{ showTable() ? 'Ver gráfico' : 'Ver tabela' }}
      </button>
    </div>

    @if (showTable()) {
      <div class="table-wrap">
        <table>
          <thead><tr><th>Período</th><th>Rendas</th><th>Gastos</th><th>Saldo</th></tr></thead>
          <tbody>
            @for (p of points(); track p.from) {
              <tr>
                <td>{{ labelFor(p.label) }}</td>
                <td class="num">{{ brl(p.income) }}</td>
                <td class="num">{{ brl(p.expense) }}</td>
                <td class="num">{{ brl(p.balance) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <div class="plot" (mouseleave)="hover.set(null)">
        <svg [attr.viewBox]="'0 0 ' + width() + ' ' + H" role="img" [attr.aria-label]="ariaLabel()">
          @for (t of ticks(); track t.value) {
            <line class="grid" [attr.x1]="P.left" [attr.x2]="width() - P.right" [attr.y1]="t.y" [attr.y2]="t.y" />
            <text class="tick" [attr.x]="P.left - 8" [attr.y]="t.y + 4" text-anchor="end">{{ t.label }}</text>
          }
          @for (b of bands(); track b.index) {
            @if (hover() === b.index) {
              <rect class="band-hover" [attr.x]="b.x" [attr.y]="P.top" [attr.width]="b.w" [attr.height]="plotH" />
            }
            <path [attr.d]="b.income.path" fill="var(--series-income)" />
            <path [attr.d]="b.expense.path" fill="var(--series-expense)" />
            @if (b.showLabel) {
              <text class="tick" [attr.x]="b.x + b.w / 2" [attr.y]="H - 8" text-anchor="middle">{{ b.label }}</text>
            }
            <rect class="hit" [attr.x]="b.x" [attr.y]="P.top" [attr.width]="b.w" [attr.height]="plotH + P.bottom"
                  tabindex="0" [attr.aria-label]="bandAria(b)"
                  (mouseenter)="hover.set(b.index)" (focus)="hover.set(b.index)" (blur)="hover.set(null)"
                  (touchstart)="hover.set(b.index)" />
          }
          <line class="axis" [attr.x1]="P.left" [attr.x2]="width() - P.right" [attr.y1]="baseline()" [attr.y2]="baseline()" />
        </svg>
        @if (tooltip(); as tip) {
          <div class="tooltip" [style.left.%]="tip.left" role="status">
            <div class="tip-title">{{ tip.title }}</div>
            <div class="tip-row"><i style="background: var(--series-income)"></i><b class="num">{{ brl(tip.p.income) }}</b><span>Rendas</span></div>
            <div class="tip-row"><i style="background: var(--series-expense)"></i><b class="num">{{ brl(tip.p.expense) }}</b><span>Gastos</span></div>
            <div class="tip-row"><i class="none"></i><b class="num">{{ brl(tip.p.balance) }}</b><span>Saldo</span></div>
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host { display: grid; gap: 10px; min-width: 0; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .legend { display: flex; gap: 16px; font-size: 0.85rem; color: var(--text-secondary); }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .legend i, .tip-row i { width: 12px; height: 3px; border-radius: 2px; display: inline-block; }
    .tip-row i.none { background: transparent; }
    .plot { position: relative; width: 100%; min-width: 0; }
    svg { display: block; width: 100%; height: 260px; overflow: visible; }
    .grid { stroke: var(--surface-3); stroke-width: 1; vector-effect: non-scaling-stroke; }
    .axis { stroke: var(--border); stroke-width: 1; vector-effect: non-scaling-stroke; }
    .tick { fill: var(--text-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
    .band-hover { fill: rgb(255 255 255 / 0.04); }
    .hit { fill: transparent; cursor: pointer; outline: none; }
    .hit:focus-visible { stroke: var(--focus); stroke-width: 1; }
    .tooltip {
      position: absolute; top: 4px; transform: translateX(-50%); pointer-events: none; z-index: 2;
      background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm);
      padding: 8px 10px; box-shadow: var(--shadow); font-size: 0.82rem; min-width: 160px;
    }
    .tip-title { color: var(--text-secondary); margin-bottom: 4px; }
    .tip-row { display: flex; align-items: center; gap: 8px; }
    .tip-row b { color: var(--text-primary); font-weight: 600; }
    .tip-row span { color: var(--text-muted); }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th, td { padding: 8px 6px; text-align: right; border-bottom: 1px solid var(--border); white-space: nowrap; }
    th:first-child, td:first-child { text-align: left; }
    th { color: var(--text-secondary); font-weight: 500; }
  `,
})
export class BarChart {
  readonly points = input.required<SeriesPoint[]>();
  /** Converte o label cru da API ("05" ou "2026-10") no texto do eixo. */
  readonly labelFormat = input<(label: string) => string>((l) => l);

  /** Largura real do container: o SVG desenha em pixels, sem esticar texto nem barras. */
  protected readonly width = signal(720);
  protected readonly H = HEIGHT;
  protected readonly P = PAD;
  protected readonly plotH = HEIGHT - PAD.top - PAD.bottom;
  protected readonly hover = signal<number | null>(null);
  protected readonly showTable = signal(false);

  private readonly max = computed(() => {
    const m = Math.max(0, ...this.points().flatMap((p) => [p.income, p.expense]));
    return niceMax(m);
  });

  protected readonly baseline = computed(() => PAD.top + this.plotH);

  protected readonly ticks = computed(() => {
    const max = this.max();
    return [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      value: max * f,
      y: PAD.top + this.plotH * (1 - f),
      label: max === 0 && f > 0 ? '' : formatCompact(max * f),
    }));
  });

  protected readonly bands = computed<Band[]>(() => {
    const pts = this.points();
    const innerW = this.width() - PAD.left - PAD.right;
    const bandW = innerW / Math.max(1, pts.length);
    const barW = Math.min(MAX_BAR, Math.max(2, (bandW * 0.7 - GAP) / 2));
    const labelEvery = pts.length > 16 ? (bandW < 14 ? 5 : bandW < 24 ? 3 : 1) : 1;
    const max = this.max() || 1;
    const base = this.baseline();

    return pts.map((p, i) => {
      const x = PAD.left + i * bandW;
      const groupW = barW * 2 + GAP;
      const start = x + (bandW - groupW) / 2;
      const bar = (value: number, bx: number): Bar => {
        const h = (value / max) * this.plotH;
        return { x: bx, y: base - h, w: barW, h, path: roundedTop(bx, base, barW, h) };
      };
      return {
        index: i,
        x,
        w: bandW,
        label: this.labelFormat()(p.label),
        showLabel: i === 0 || (i + 1) % labelEvery === 0,
        income: bar(p.income, start),
        expense: bar(p.expense, start + barW + GAP),
        point: p,
      };
    });
  });

  protected readonly tooltip = computed(() => {
    const i = this.hover();
    if (i === null) return null;
    const b = this.bands()[i];
    if (!b) return null;
    const center = ((b.x + b.w / 2) / this.width()) * 100;
    return { left: Math.min(82, Math.max(18, center)), title: b.label, p: b.point };
  });

  constructor() {
    const host = inject(ElementRef<HTMLElement>);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = host.nativeElement as HTMLElement; // largura do host = largura do card (svg e 100%)
      const observer = new ResizeObserver(([entry]) => {
        const w = Math.round(entry.contentRect.width);
        if (w > 0) this.width.set(w);
      });
      observer.observe(el);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected readonly ariaLabel = computed(() => {
    const total = this.points().reduce((a, p) => ({ i: a.i + p.income, e: a.e + p.expense }), { i: 0, e: 0 });
    return `Rendas ${formatBRL(total.i)} e gastos ${formatBRL(total.e)} no período. Use Tab para ler cada fatia.`;
  });

  protected brl(v: number): string {
    return formatBRL(v);
  }

  protected labelFor(label: string): string {
    return this.labelFormat()(label);
  }

  protected bandAria(b: Band): string {
    return `${b.label}: rendas ${formatBRL(b.point.income)}, gastos ${formatBRL(b.point.expense)}`;
  }
}

/** Barra com cantos de 4px arredondados so no topo (ponta do dado), base reta. */
function roundedTop(x: number, base: number, w: number, h: number): string {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  const top = base - h;
  return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${base} Z`;
}

function niceMax(value: number): number {
  if (value <= 0) return 0;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}
