// Tolerance for comparing stored amounts (numeric(14,2)) against
// user-typed thresholds, to absorb floating point noise.
const EPSILON = 0.005;

export type AmountPredicate = (amount: number) => boolean;

const RANGE_PATTERN = /^(-?\d+(?:\.\d+)?)\s*(<=|<|>=|>)\s*(-?\d+(?:\.\d+)?)$/;
const BOUND_PATTERN = /^(<=|<|>=|>|=)\s*(-?\d+(?:\.\d+)?)$/;

/**
 * Parses a free-text amount filter into a predicate. Supports:
 * - a plain number ("150") - exact match
 * - a single bound ("<300", ">=50", "=42")
 * - a range written as two numbers either side of an operator
 *   ("300 < 500" or "500 > 300" - both mean 300 < amount < 500)
 * - multiple expressions combined with "&", all of which must match
 *   ("<500 & >100" or "100 < 500 & >200")
 *
 * Unparseable segments are ignored; returns null if none parsed
 * (no filter applied).
 */
export function parseAmountFilter(input: string): AmountPredicate | null {
  const predicates = input
    .split("&")
    .map(parseSingleExpression)
    .filter((predicate): predicate is AmountPredicate => predicate !== null);

  if (predicates.length === 0) {
    return null;
  }

  return (amount) => predicates.every((predicate) => predicate(amount));
}

function parseSingleExpression(input: string): AmountPredicate | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const rangeMatch = trimmed.match(RANGE_PATTERN);
  if (rangeMatch) {
    const [, leftText, operator, rightText] = rangeMatch;
    const left = Number(leftText);
    const right = Number(rightText);
    const ascending = operator === "<" || operator === "<=";
    const inclusive = operator === "<=" || operator === ">=";
    const lower = ascending ? left : right;
    const upper = ascending ? right : left;
    return inclusive
      ? (amount) => amount >= lower - EPSILON && amount <= upper + EPSILON
      : (amount) => amount > lower + EPSILON && amount < upper - EPSILON;
  }

  const boundMatch = trimmed.match(BOUND_PATTERN);
  if (boundMatch) {
    const [, operator, valueText] = boundMatch;
    const value = Number(valueText);
    switch (operator) {
      case "<":
        return (amount) => amount < value - EPSILON;
      case "<=":
        return (amount) => amount <= value + EPSILON;
      case ">":
        return (amount) => amount > value + EPSILON;
      case ">=":
        return (amount) => amount >= value - EPSILON;
      default:
        return (amount) => Math.abs(amount - value) <= EPSILON;
    }
  }

  const plain = Number(trimmed);
  if (!Number.isNaN(plain)) {
    return (amount) => Math.abs(amount - plain) <= EPSILON;
  }

  return null;
}
