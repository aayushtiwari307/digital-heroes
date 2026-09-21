'use strict';

/**
 * Score domain rules — see ARCHITECTURE_DECISIONS.md Part 9/M.
 * Pure functions only: no DB, no HTTP. The DB's UNIQUE(user_id, score_date)
 * and CHECK(value BETWEEN 1 AND 45) constraints are the ultimate authority;
 * these functions exist so the client and the API agree with the DB *before*
 * a round trip, and so the rules are independently unit-testable.
 */

const MIN_SCORE = 1;
const MAX_SCORE = 45;
const CURRENT_TICKET_SIZE = 5;

class ScoreValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

/**
 * Validates a single score submission (create or edit).
 * @param {{value:number, date:string}} input - date as 'YYYY-MM-DD'
 * @param {Date} today - injected for testability
 */
function validateScoreInput(input, today = new Date()) {
  const { value, date } = input;

  if (!Number.isInteger(value) || value < MIN_SCORE || value > MAX_SCORE) {
    throw new ScoreValidationError(
      `Score must be an integer between ${MIN_SCORE} and ${MAX_SCORE}`,
      'INVALID_RANGE'
    );
  }

  if (!date || Number.isNaN(Date.parse(date))) {
    throw new ScoreValidationError('A valid date is required', 'INVALID_DATE');
  }

  const scoreDate = new Date(date + 'T00:00:00Z');
  const todayUTC = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );

  if (scoreDate.getTime() > todayUTC.getTime()) {
    throw new ScoreValidationError('Score date cannot be in the future', 'FUTURE_DATE');
  }

  return { value, date };
}

/**
 * Given all of a user's scores (unsorted, any length), return the "current"
 * set: the CURRENT_TICKET_SIZE most recent by date, newest first.
 * Does not mutate or delete anything. Persistence enforces the latest-five
 * retention policy; this helper also remains useful for deterministic rule tests.
 */
function currentScores(allScores) {
  return [...allScores]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, CURRENT_TICKET_SIZE);
}

/**
 * A user is draw-eligible only if they have a full current ticket.
 * See ARCHITECTURE_DECISIONS.md table M, row/decision on score eligibility.
 */
function isDrawEligible(allScores) {
  return currentScores(allScores).length === CURRENT_TICKET_SIZE;
}

/**
 * Enforces the "one score per date" rule against an in-memory list —
 * used by the service layer before hitting the DB, and by tests.
 */
function assertNoDuplicateDate(existingScores, newDate) {
  const clash = existingScores.some((s) => s.date === newDate);
  if (clash) {
    throw new ScoreValidationError(
      'A score already exists for this date — edit or delete it instead',
      'DUPLICATE_DATE'
    );
  }
}

module.exports = {
  MIN_SCORE,
  MAX_SCORE,
  CURRENT_TICKET_SIZE,
  ScoreValidationError,
  validateScoreInput,
  currentScores,
  isDrawEligible,
  assertNoDuplicateDate,
};
