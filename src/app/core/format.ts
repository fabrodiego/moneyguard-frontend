import { HttpErrorResponse } from '@angular/common/http';
import { Pipe, PipeTransform } from '@angular/core';
import { InsightPeriod } from './models';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCompact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

export function formatBRL(value: number | null | undefined): string {
  return brl.format(value ?? 0);
}

export function formatCompact(value: number): string {
  return brlCompact.format(value);
}

@Pipe({ name: 'brl' })
export class BrlPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatBRL(value);
  }
}

@Pipe({ name: 'dateBr' })
export class DateBrPipe implements PipeTransform {
  transform(iso: string | null | undefined, style: 'short' | 'long' = 'short'): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return style === 'long'
      ? date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
      : date.toLocaleDateString('pt-BR');
  }
}

/** Aceita "8", "8,50", "1.234,56" ou "8.5". Devolve null se invalido. */
export function parseAmount(text: string | number | null | undefined): number | null {
  if (text === null || text === undefined) return null;
  if (typeof text === 'number') return Number.isFinite(text) ? text : null;
  let s = text.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
}

export function todayIso(): string {
  return toIso(new Date());
}

export function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function monthShort(month: number): string {
  return MONTHS[month - 1];
}

export function periodLabel(period: InsightPeriod, year: number, number: number): string {
  switch (period) {
    case 'MONTH':
      return `${MONTHS_LONG[number - 1]} de ${year}`;
    case 'QUARTER':
      return `${number}º trimestre de ${year}`;
    case 'SEMESTER':
      return `${number}º semestre de ${year}`;
    case 'YEAR':
      return `${year}`;
  }
}

export const PERIOD_COUNT: Record<InsightPeriod, number> = { MONTH: 12, QUARTER: 4, SEMESTER: 2, YEAR: 1 };

/** Avanca (+1) ou volta (-1) um periodo, virando o ano quando precisa. */
export function shiftPeriod(period: InsightPeriod, year: number, number: number, delta: number) {
  const count = PERIOD_COUNT[period];
  let index = year * count + (number - 1) + delta;
  return { year: Math.floor(index / count), number: (index % count) + 1 };
}

export function currentPeriodNumber(period: InsightPeriod, date = new Date()): number {
  const months = 12 / PERIOD_COUNT[period];
  return Math.floor(date.getMonth() / months) + 1;
}

export function errorMessage(err: unknown, fallback = 'Algo deu errado. Tente de novo.'): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Sem conexão com o servidor.';
    const detail = (err.error as { detail?: string } | null)?.detail;
    if (detail) return detail;
  }
  return fallback;
}

/** Paleta categorica validada para o fundo escuro (ordem fixa). */
export const CATEGORY_COLORS = [
  '#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767',
];
