'use strict';

const NUMBER_RANGE = { min: 1, max: 45 };
const DRAW_SIZE = 5;
const WIN_TIERS = [3, 4, 5];

function buildTicket(currentScoreValues) {
  if (!Array.isArray(currentScoreValues) || currentScoreValues.length !== DRAW_SIZE) {
    throw new Error('Ticket requires exactly 5 current scores');
  }
  return Array.from(new Set(currentScoreValues));
}

function seedToUint32(seed) {
  const hex = String(seed).replace(/[^a-f0-9]/gi, '').slice(0, 8).padEnd(8, '0');
  return parseInt(hex, 16) >>> 0;
}

function createSeededRng(seed) {
  let x = seedToUint32(seed) || 0x6d2b79f5;
  return () => {
    x |= 0;
    x = (x + 0x6D2B79F5) | 0;
    let t = Math.imul(x ^ (x >>> 15), 1 | x);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawRandomNumbers(rng) {
  if (typeof rng !== 'function') throw new Error('A seeded RNG is required for authoritative draws');
  const pool = [];
  for (let n = NUMBER_RANGE.min; n <= NUMBER_RANGE.max; n++) pool.push(n);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, DRAW_SIZE).sort((a, b) => a - b);
}

function drawWeightedNumbers(allTickets, rng) {
  if (typeof rng !== 'function') throw new Error('A seeded RNG is required for authoritative draws');
  const weights = new Map();
  for (let n = NUMBER_RANGE.min; n <= NUMBER_RANGE.max; n++) weights.set(n, 1);
  for (const ticket of allTickets) for (const n of new Set(ticket)) weights.set(n, weights.get(n) + 1);

  const pool = Array.from(weights.entries());
  const drawn = [];
  while (drawn.length < DRAW_SIZE && pool.length) {
    const totalWeight = pool.reduce((sum, [, w]) => sum + w, 0);
    let r = rng() * totalWeight;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i][1];
      if (r <= 0) { idx = i; break; }
    }
    drawn.push(pool[idx][0]);
    pool.splice(idx, 1);
  }
  return drawn.sort((a, b) => a - b);
}

function countMatches(ticket, winningNumbers) {
  const ticketSet = new Set(ticket);
  const winSet = new Set(winningNumbers);
  let matches = 0;
  for (const n of ticketSet) if (winSet.has(n)) matches += 1;
  return matches;
}

function matchTier(ticket, winningNumbers) {
  const matches = countMatches(ticket, winningNumbers);
  return WIN_TIERS.includes(matches) ? matches : null;
}

module.exports = { NUMBER_RANGE, DRAW_SIZE, WIN_TIERS, buildTicket, seedToUint32, createSeededRng, drawRandomNumbers, drawWeightedNumbers, countMatches, matchTier };
