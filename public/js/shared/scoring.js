// Points – one formula for the in-game display and the server (which recomputes and
// clamps everything the browser reports).
import { HALF_SECONDS, STICKERS_PER_HALF } from './levelgen.js';
import { penaltyOutcome, freekickOutcome } from './finale.js';

export const SCORE = {
  ITEM: 10,            // national collectible (kiwi, pretzel, croissant …)
  STICKER: 100,        // player sticker from a bonus jump
  SQUAD_BONUS: 500,    // all 11 stickers of one half
  DRIBBLE: 50,         // jumped over a defender
  FINISH: 1000,        // reached the penalty area
  TIME_PER_SEC: 5,     // per second left on each half's clock
  HEADER_MAX: 500,     // finale: header power / shot quality 0..1
  GOAL: 1500,          // the finale ended in a goal
  GOAL_POWER: 0.45,    // minimum header power that beats the keeper
};

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));
const clampNum = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));

// r: { items:[h1,h2], stickers:[h1,h2], dribbles, timeLeft:[s1,s2], header:{kind,hit,power,aim,angle} }
// facts (optional, from levelFacts): { matchId, finale, counts, minHalfSeconds } – used to clamp
// and to replay free kicks and penalties (their outcome follows from aim/angle and power)
export function computeScore(r, facts) {
  const counts = facts?.counts ?? { items: [999, 999], stickers: [STICKERS_PER_HALF, STICKERS_PER_HALF], enemies: 999 };
  const minT = facts?.minHalfSeconds ?? [0, 0];
  const items = [0, 1].map(h => clampInt(r.items?.[h], 0, counts.items[h]));
  const stickers = [0, 1].map(h => clampInt(r.stickers?.[h], 0, counts.stickers[h]));
  const dribbles = clampInt(r.dribbles, 0, counts.enemies);
  const timeLeft = [0, 1].map(h => clampNum(r.timeLeft?.[h], 0, Math.max(0, HALF_SECONDS - minT[h])));
  const fin = r.header || {};
  const kind = facts?.finale || fin.kind || 'header';
  const hit = !!fin.hit;
  let power = 0, goal = false;
  if (hit && kind === 'penalty') { const o = penaltyOutcome(facts?.matchId ?? 0, fin.aim, fin.power); power = o.quality; goal = o.goal; }
  else if (hit && kind === 'freekick') { const o = freekickOutcome(fin.angle, fin.power); power = o.quality; goal = o.goal; }
  else if (hit) { power = clampNum(fin.power, 0, 1); goal = power >= SCORE.GOAL_POWER; }

  const b = {
    finish: SCORE.FINISH,
    items: (items[0] + items[1]) * SCORE.ITEM,
    stickers: (stickers[0] + stickers[1]) * SCORE.STICKER,
    squad: stickers.filter((s, h) => s >= counts.stickers[h] && s > 0).length * SCORE.SQUAD_BONUS,
    dribbles: dribbles * SCORE.DRIBBLE,
    time: Math.round((timeLeft[0] + timeLeft[1]) * SCORE.TIME_PER_SEC),
    header: Math.round(power * SCORE.HEADER_MAX),
    goal: goal ? SCORE.GOAL : 0,
  };
  const total = Object.values(b).reduce((s, v) => s + v, 0);
  return { total, breakdown: b, goal, kind, clean: { items, stickers, dribbles, timeLeft, header: { kind, hit, power } } };
}

// points collected so far (shown live in the HUD, no finish/time/header yet)
export function liveScore(items, stickers, dribbles) {
  return (items[0] + items[1]) * SCORE.ITEM + (stickers[0] + stickers[1]) * SCORE.STICKER + dribbles * SCORE.DRIBBLE;
}
