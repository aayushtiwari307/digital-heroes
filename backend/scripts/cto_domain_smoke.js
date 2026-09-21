'use strict';
const assert = require('assert');
const { createSeededRng, drawRandomNumbers, drawWeightedNumbers, buildTicket, countMatches } = require('../src/domain/drawEngine');
const { settleDraw, verifyConservation } = require('../src/domain/prizeEngine');
const { validateScoreInput, currentScores } = require('../src/domain/scoreRules');
const { detectImageType } = require('../src/utils/imageValidation');

const seed = '0123456789abcdef0123456789abcdef';
const first = drawRandomNumbers(createSeededRng(seed));
const second = drawRandomNumbers(createSeededRng(seed));
assert.deepStrictEqual(first, second);
assert.strictEqual(first.length, 5);
assert.strictEqual(new Set(first).size, 5);
assert(first.every((n) => n >= 1 && n <= 45));

const tickets = [[1, 2, 3, 4, 5], [1, 2, 3, 4, 5]];
assert.deepStrictEqual(
  drawWeightedNumbers(tickets, createSeededRng(seed)),
  drawWeightedNumbers(tickets, createSeededRng(seed))
);
assert.deepStrictEqual(buildTicket([10, 10, 20, 30, 40]), [10, 20, 30, 40]);
assert.strictEqual(countMatches([1, 2, 2, 3, 4], [1, 2, 3, 40, 41]), 3);

const allUnclaimed = settleDraw(100000, { 5: [], 4: [], 3: [] }, 0);
assert.strictEqual(allUnclaimed.carryOutJackpot, 40000);
assert.strictEqual(allUnclaimed.unawardedMinor, 60000);
assert(verifyConservation(100000, 0, allUnclaimed));

const fourUnclaimed = settleDraw(100000, { 5: ['u'], 4: [], 3: ['v'] }, 0);
assert.strictEqual(fourUnclaimed.carryOutJackpot, 0);
assert.strictEqual(fourUnclaimed.unawardedByTier[4], 35000);
assert(verifyConservation(100000, 0, fourUnclaimed));

const threeUnclaimed = settleDraw(100000, { 5: ['u'], 4: ['v'], 3: [] }, 0);
assert.strictEqual(threeUnclaimed.unawardedByTier[3], 25000);
assert(verifyConservation(100000, 0, threeUnclaimed));

const six = currentScores([
  { date: '2026-01-01' }, { date: '2026-06-01' }, { date: '2026-02-01' },
  { date: '2026-05-01' }, { date: '2026-04-01' }, { date: '2026-03-01' },
]);
assert.strictEqual(six.length, 5);
assert.strictEqual(six[0].date, '2026-06-01');
assert(!six.some((s) => s.date === '2026-01-01'));
assert.deepStrictEqual(
  validateScoreInput({ value: 45, date: '2026-09-21' }, new Date('2026-09-21T00:00:00Z')),
  { value: 45, date: '2026-09-21' }
);

assert.strictEqual(detectImageType(Buffer.from('89504e470d0a1a0a', 'hex')), 'png');
assert.strictEqual(detectImageType(Buffer.from('not-an-image')), null);

console.log('CTO_DOMAIN_SMOKE_OK');
