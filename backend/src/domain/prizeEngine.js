'use strict';

const TIER_SHARES = { 5: 40, 4: 35, 3: 25 };

function splitPoolByTier(totalPoolMinor) {
  const result = {};
  let allocated = 0;
  for (const tier of [5, 4, 3]) {
    result[tier] = Math.floor((totalPoolMinor * TIER_SHARES[tier]) / 100);
    allocated += result[tier];
  }
  result.splitRemainder = totalPoolMinor - allocated;
  return result;
}

function computeTierPools(totalPoolMinor, jackpotCarryInMinor = 0) {
  const tiers = splitPoolByTier(totalPoolMinor);
  tiers[5] += jackpotCarryInMinor;
  return tiers;
}

function splitTierAmongWinners(tierPoolMinor, winnerCount) {
  if (winnerCount === 0) return { payoutPerWinner: 0, remainder: tierPoolMinor, totalPaid: 0 };
  const payoutPerWinner = Math.floor(tierPoolMinor / winnerCount);
  const totalPaid = payoutPerWinner * winnerCount;
  return { payoutPerWinner, remainder: tierPoolMinor - totalPaid, totalPaid };
}

function settleDraw(totalPoolMinor, winnersByTier, jackpotCarryInMinor = 0) {
  const tierPools = computeTierPools(totalPoolMinor, jackpotCarryInMinor);
  const payouts = {};
  let carryOutJackpot = 0;
  let unawardedMinor = tierPools.splitRemainder;
  const unawardedByTier = { 5: 0, 4: 0, 3: 0 };

  for (const tier of [5, 4, 3]) {
    const winnerIds = winnersByTier[tier] || [];
    const split = splitTierAmongWinners(tierPools[tier], winnerIds.length);
    payouts[tier] = { payoutPerWinner: split.payoutPerWinner, winnerIds };

    if (winnerIds.length === 0) {
      if (tier === 5) carryOutJackpot += tierPools[tier];
      else { unawardedByTier[tier] += tierPools[tier]; unawardedMinor += tierPools[tier]; }
    } else if (split.remainder > 0) {
      if (tier === 5) carryOutJackpot += split.remainder;
      else { unawardedByTier[tier] += split.remainder; unawardedMinor += split.remainder; }
    }
  }

  return { tierPools, payouts, carryOutJackpot, unawardedMinor, unawardedByTier };
}

function verifyConservation(totalPoolMinor, jackpotCarryInMinor, settlement) {
  let totalPaidOut = 0;
  for (const tier of [5, 4, 3]) {
    const p = settlement.payouts[tier];
    totalPaidOut += p.payoutPerWinner * p.winnerIds.length;
  }
  return totalPoolMinor + jackpotCarryInMinor === totalPaidOut + settlement.carryOutJackpot + settlement.unawardedMinor;
}

module.exports = { TIER_SHARES, splitPoolByTier, computeTierPools, splitTierAmongWinners, settleDraw, verifyConservation };
