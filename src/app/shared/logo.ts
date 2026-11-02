import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 512 512" aria-hidden="true">
      <path d="M 256,80 L 400,140 V 270 C 400,360 256,432 256,432 C 256,432 112,360 112,270 V 140 Z"
            fill="none" stroke="#0284c7" stroke-width="44" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M 175,300 V 210 L 256,280 L 337,210 V 300"
            fill="none" stroke="#22d3ee" stroke-width="38" stroke-linejoin="round" stroke-linecap="round" />
    </svg>
    @if (withName()) {
      <span class="name">Money<b>Guard</b></span>
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 10px; }
    svg { filter: drop-shadow(0 0 10px rgb(2 132 199 / 0.6)); }
    .name { font-size: 1.15rem; font-weight: 600; letter-spacing: -0.01em; color: var(--text-primary); }
    .name b { color: var(--accent); font-weight: 700; }
  `,
})
export class Logo {
  readonly size = input(32);
  readonly withName = input(true);
}
