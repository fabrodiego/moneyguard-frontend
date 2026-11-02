import { describe, expect, it } from 'vitest';
import { currentPeriodNumber, parseAmount, periodLabel, shiftPeriod } from './format';

describe('parseAmount', () => {
  it('aceita formatos brasileiros e com ponto', () => {
    expect(parseAmount('8')).toBe(8);
    expect(parseAmount('8,50')).toBe(8.5);
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('R$ 10,00')).toBe(10);
    expect(parseAmount('8.5')).toBe(8.5);
  });

  it('rejeita valores invalidos', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('1,234')).toBeNull();
  });
});

describe('periodos', () => {
  it('vira o ano ao navegar', () => {
    expect(shiftPeriod('MONTH', 2026, 1, -1)).toEqual({ year: 2025, number: 12 });
    expect(shiftPeriod('QUARTER', 2026, 4, 1)).toEqual({ year: 2027, number: 1 });
    expect(shiftPeriod('YEAR', 2026, 1, -1)).toEqual({ year: 2025, number: 1 });
  });

  it('calcula o periodo atual', () => {
    const oct = new Date(2026, 9, 15);
    expect(currentPeriodNumber('MONTH', oct)).toBe(10);
    expect(currentPeriodNumber('QUARTER', oct)).toBe(4);
    expect(currentPeriodNumber('SEMESTER', oct)).toBe(2);
    expect(currentPeriodNumber('YEAR', oct)).toBe(1);
  });

  it('gera rotulos em portugues', () => {
    expect(periodLabel('MONTH', 2026, 10)).toBe('Outubro de 2026');
    expect(periodLabel('QUARTER', 2026, 4)).toBe('4º trimestre de 2026');
  });
});
