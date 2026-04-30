import { describe, it, expect } from 'vitest';
import { DateNormalizer } from './dateNormalizer';

describe('DateNormalizer.parseDateFlexible', () => {
  it('returns invalid for empty string', () => {
    const result = DateNormalizer.parseDateFlexible('');
    expect(result.isValid).toBe(false);
  });

  it('parses a plain year', () => {
    const result = DateNormalizer.parseDateFlexible('2022');
    expect(result.isValid).toBe(true);
    expect(result.year).toBe(2022);
    expect(result.month).toBeNull();
  });

  it('parses month/year format', () => {
    const result = DateNormalizer.parseDateFlexible('06/2021');
    expect(result.isValid).toBe(true);
    expect(result.year).toBe(2021);
    expect(result.month).toBe(6);
  });

  it('parses month name + year', () => {
    const result = DateNormalizer.parseDateFlexible('March 2020');
    expect(result.isValid).toBe(true);
    expect(result.year).toBe(2020);
    expect(result.month).toBe(3);
  });

  it('recognises "Present" keyword', () => {
    const result = DateNormalizer.parseDateFlexible('Present');
    expect(result.isPresent).toBe(true);
    expect(result.isValid).toBe(true);
  });

  it('recognises "Current" keyword', () => {
    const result = DateNormalizer.parseDateFlexible('Current');
    expect(result.isPresent).toBe(true);
  });

  it('flags expected graduation date', () => {
    const result = DateNormalizer.parseDateFlexible('Expected May 2025');
    expect(result.isExpected).toBe(true);
    expect(result.isValid).toBe(true);
  });

  it('detects future date without expected keyword as warning', () => {
    const result = DateNormalizer.parseDateFlexible('December 2099');
    expect(result.isFuture).toBe(true);
    expect(result.warning).toBeDefined();
  });

  it('returns invalid for garbage string', () => {
    const result = DateNormalizer.parseDateFlexible('not a date at all');
    expect(result.isValid).toBe(false);
  });
});

describe('DateNormalizer.calculateDuration', () => {
  it('calculates duration between two dates', () => {
    const result = DateNormalizer.calculateDuration('Jan 2020', 'Jan 2022');
    expect(result.isValid).toBe(true);
    expect(result.years).toBe(2);
    expect(result.months).toBe(0);
  });

  it('returns invalid when end is before start', () => {
    const result = DateNormalizer.calculateDuration('Jan 2023', 'Jan 2020');
    expect(result.isValid).toBe(false);
  });

  it('returns invalid for bad date strings', () => {
    const result = DateNormalizer.calculateDuration('bad', 'also bad');
    expect(result.isValid).toBe(false);
  });

  it('handles present as end date', () => {
    const result = DateNormalizer.calculateDuration('Jan 2020', 'Present');
    expect(result.isValid).toBe(true);
    expect(result.totalMonths).toBeGreaterThan(0);
  });
});
