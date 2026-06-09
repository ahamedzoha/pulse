import type { TaskStatus } from '@pulse/shared-types';

/**
 * Classic lexicon sentiment — the instant, deterministic half of the hybrid.
 * AFINN-style word scores (-5..5) with negation and intensifier handling,
 * normalized to a -1..1 valence the same way VADER does (alpha smoothing).
 * No dependencies, English-only, runs synchronously on the write path so the
 * UI gets an immediate read before the LLM refines it in the worker.
 */

// Work-flavoured lexicon. Scores are intentionally coarse (-4..4).
const LEXICON: Record<string, number> = {
  // negative — blockers, breakage, friction
  blocked: -3, block: -2, stuck: -3, stalled: -3, broken: -3, broke: -2,
  break: -2, bug: -2, bugs: -2, buggy: -3, fail: -3, fails: -3, failed: -3,
  failing: -3, failure: -3, error: -2, errors: -2, crash: -3, crashes: -3,
  crashed: -3, delay: -2, delayed: -2, late: -2, overdue: -2, risk: -1,
  risky: -2, nightmare: -4, frustrating: -3, frustrated: -3, frustration: -3,
  confusing: -2, confused: -2, painful: -3, pain: -2, slow: -2, sluggish: -2,
  regression: -2, regressed: -2, waiting: -1, waited: -1, struggle: -2,
  struggling: -2, hard: -1, difficult: -2, tricky: -1, timeout: -2,
  timeouts: -2, flaky: -2, leak: -2, leaking: -2, issue: -1, issues: -1,
  problem: -2, problems: -2, problematic: -2, concern: -1, concerned: -1,
  worried: -2, worry: -2, worrying: -2, mess: -2, messy: -2, hack: -1,
  hacky: -2, ugly: -2, unstable: -2, dropped: -1, drop: -1, abandon: -2,
  abandoned: -2, deadline: -1, scope: -1, creep: -2, denied: -2, reject: -2,
  rejected: -2, annoying: -2, tedious: -1, burnout: -4, exhausted: -3,
  exhausting: -3, tired: -2, swamped: -2, overwhelmed: -3, impossible: -3,

  // positive — progress, shipping, wins
  done: 2, shipped: 3, ship: 2, shipping: 2, resolved: 3, resolve: 2,
  fixed: 3, fix: 1, fixes: 1, great: 3, good: 2, works: 2, working: 2,
  worked: 2, success: 3, successful: 3, succeeded: 3, passed: 2, passing: 2,
  pass: 1, nice: 2, clean: 2, smooth: 2, smoothly: 2, improved: 2,
  improve: 2, improvement: 2, faster: 2, fast: 1, unblocked: 3, progress: 2,
  ready: 2, love: 3, loved: 3, excellent: 4, awesome: 4, amazing: 4,
  solid: 2, win: 3, wins: 3, winning: 2, complete: 2, completed: 2,
  happy: 2, glad: 2, confident: 2, optimistic: 2, optimism: 2, relieved: 2,
  relief: 2, perfect: 3, perfectly: 3, finally: 1, breakthrough: 3,
  efficient: 2, stable: 2, polished: 2, delighted: 3, thrilled: 3,
  momentum: 2, productive: 2, easy: 1, simpler: 1, simplified: 2,
};

const NEGATORS = new Set([
  'not', 'no', 'never', 'none', 'cannot', "can't", 'cant', "won't", 'wont',
  "don't", 'dont', "doesn't", 'doesnt', "didn't", 'didnt', "isn't", 'isnt',
  "aren't", 'arent', "wasn't", 'wasnt', 'without', 'lack', 'lacking',
]);

const INTENSIFIERS: Record<string, number> = {
  very: 1.5, extremely: 1.8, really: 1.4, so: 1.3, super: 1.6,
  incredibly: 1.8, totally: 1.4, absolutely: 1.6, completely: 1.5,
  // dampeners
  slightly: 0.5, somewhat: 0.6, barely: 0.4, kinda: 0.6, mildly: 0.5,
};

const NEGATION_WINDOW = 2;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Lexicon valence for free text, normalized to -1..1 (0 when no signal). */
export function scoreValence(text: string): number {
  const tokens = tokenize(text);
  let sum = 0;

  for (let i = 0; i < tokens.length; i++) {
    const base = LEXICON[tokens[i]];
    if (base === undefined) continue;

    let score = base;

    // Intensifier/dampener immediately before the sentiment word.
    const mult = INTENSIFIERS[tokens[i - 1]];
    if (mult !== undefined) score *= mult;

    // Negation within a small preceding window flips polarity (damped).
    for (let j = 1; j <= NEGATION_WINDOW; j++) {
      if (NEGATORS.has(tokens[i - j])) {
        score *= -0.75;
        break;
      }
    }

    sum += score;
  }

  if (sum === 0) return 0;
  // VADER-style alpha normalization → squashes into (-1, 1).
  const normalized = sum / Math.sqrt(sum * sum + 15);
  return Math.max(-1, Math.min(1, normalized));
}

const STATUS_ORDER: Record<TaskStatus, number> = {
  todo: 0,
  in_progress: 1,
  review: 2,
  done: 3,
};

/**
 * Valence from a status move when there's no text to read: forward progress
 * is positive, regressions are negative (weighted heavier). null if unknown.
 */
export function valenceFromTransition(
  oldStatus?: string,
  newStatus?: string,
): number | null {
  if (!oldStatus || !newStatus) return null;
  const from = STATUS_ORDER[oldStatus as TaskStatus];
  const to = STATUS_ORDER[newStatus as TaskStatus];
  if (from === undefined || to === undefined) return null;
  const delta = to - from;
  if (delta > 0) return Math.min(0.4, 0.2 * delta);
  if (delta < 0) return Math.max(-0.6, 0.3 * delta);
  return 0;
}
