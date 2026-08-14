import { describe, it, expect } from 'vitest';
import { isIndependenceWindow } from './independenceOffer';

describe('isIndependenceWindow', () => {
  it('is open 11-15 Aug inclusive', () => {
    expect(isIndependenceWindow(new Date(2026, 7, 11))).toBe(true);
    expect(isIndependenceWindow(new Date(2026, 7, 14))).toBe(true);
    expect(isIndependenceWindow(new Date(2026, 7, 15, 23, 59))).toBe(true);
  });

  it('is closed outside the window', () => {
    expect(isIndependenceWindow(new Date(2026, 7, 10, 23, 59))).toBe(false);
    expect(isIndependenceWindow(new Date(2026, 7, 16))).toBe(false);
    expect(isIndependenceWindow(new Date(2026, 6, 15))).toBe(false); // July
    expect(isIndependenceWindow(new Date(2026, 8, 15))).toBe(false); // September
  });
});
