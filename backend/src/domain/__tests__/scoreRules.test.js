'use strict';

const {
  validateScoreInput,
  currentScores,
  isDrawEligible,
  assertNoDuplicateDate,
  ScoreValidationError,
} = require('../scoreRules');

describe('validateScoreInput', () => {
  const today = new Date('2026-09-20T00:00:00Z');

  test('accepts a valid score', () => {
    expect(validateScoreInput({ value: 36, date: '2026-09-10' }, today)).toEqual({
      value: 36,
      date: '2026-09-10',
    });
  });

  test.each([0, 46, -1, 3.5])('rejects out-of-range value %p', (value) => {
    expect(() => validateScoreInput({ value, date: '2026-09-10' }, today)).toThrow(
      ScoreValidationError
    );
  });

  test('rejects invalid date', () => {
    expect(() => validateScoreInput({ value: 30, date: 'not-a-date' }, today)).toThrow(
      /valid date/
    );
  });

  test('rejects future date', () => {
    expect(() => validateScoreInput({ value: 30, date: '2026-12-01' }, today)).toThrow(
      /future/
    );
  });

  test('accepts a score dated today', () => {
    expect(() => validateScoreInput({ value: 30, date: '2026-09-20' }, today)).not.toThrow();
  });
});

describe('currentScores', () => {
  test('returns the 5 most recent by date, newest first', () => {
    const all = [
      { value: 30, date: '2026-01-01' },
      { value: 31, date: '2026-06-01' },
      { value: 32, date: '2026-05-01' },
      { value: 33, date: '2026-08-01' },
      { value: 34, date: '2026-07-01' },
      { value: 35, date: '2026-09-01' },
    ];
    const result = currentScores(all);
    expect(result.map((s) => s.date)).toEqual([
      '2026-09-01',
      '2026-08-01',
      '2026-07-01',
      '2026-06-01',
      '2026-05-01',
    ]);
    // oldest (2026-01-01) correctly excluded
    expect(result.find((s) => s.date === '2026-01-01')).toBeUndefined();
  });

  test('does not mutate the input array', () => {
    const all = [{ value: 30, date: '2026-01-01' }];
    const copy = [...all];
    currentScores(all);
    expect(all).toEqual(copy);
  });
});

describe('isDrawEligible', () => {
  test('false with fewer than 5 scores', () => {
    const all = [
      { value: 30, date: '2026-09-01' },
      { value: 31, date: '2026-08-01' },
    ];
    expect(isDrawEligible(all)).toBe(false);
  });

  test('true with exactly 5 current scores', () => {
    const all = Array.from({ length: 5 }, (_, i) => ({
      value: 30,
      date: `2026-0${i + 1}-01`,
    }));
    expect(isDrawEligible(all)).toBe(true);

    const six = [...all, { value: 20, date: '2026-06-01' }];
    expect(isDrawEligible(six)).toBe(true);
  });
});

describe('assertNoDuplicateDate', () => {
  test('throws on duplicate date', () => {
    const existing = [{ value: 30, date: '2026-09-10' }];
    expect(() => assertNoDuplicateDate(existing, '2026-09-10')).toThrow(
      ScoreValidationError
    );
  });

  test('allows a duplicate VALUE on a different date', () => {
    const existing = [{ value: 30, date: '2026-09-10' }];
    expect(() => assertNoDuplicateDate(existing, '2026-09-11')).not.toThrow();
  });
});
