/** Regole di punteggio e vite extra: funzioni pure, coperte da test. */
import {
  SCORE, EXTRA_LIFE_FIRST, EXTRA_LIFE_SECOND, EXTRA_LIFE_EVERY,
  FIRST_BONUS_STAGE, BONUS_STAGE_EVERY,
} from '../config';

export enum Kind { Mite = 0, Raider = 1, Warden = 2, Rogue = 3 }

/**
 * Punti per un nemico abbattuto.
 * @param diving  true se il nemico era fuori formazione (ingresso, tuffo, rientro)
 * @param escorts numero di scorte partite insieme al comandante (0..2)
 */
export function enemyScore(kind: Kind, diving: boolean, escorts = 0): number {
  switch (kind) {
    case Kind.Mite: return diving ? SCORE.mite.diving : SCORE.mite.formation;
    case Kind.Raider: return diving ? SCORE.raider.diving : SCORE.raider.formation;
    case Kind.Warden: {
      if (!diving) return SCORE.warden.formation;
      const e = escorts < 0 ? 0 : escorts > 2 ? 2 : escorts;
      return SCORE.warden.diving[e];
    }
    case Kind.Rogue: return SCORE.rogue;
  }
  return 0;
}

/** Soglia della n-esima vita extra (n = 0, 1, 2…): 20.000, 70.000, 140.000, 210.000… */
export function extraLifeThreshold(n: number): number {
  if (n === 0) return EXTRA_LIFE_FIRST;
  if (n === 1) return EXTRA_LIFE_SECOND;
  return EXTRA_LIFE_SECOND + (n - 1) * EXTRA_LIFE_EVERY;
}

/** Quante vite extra spettano a un certo punteggio. */
export function extraLivesFor(score: number): number {
  let n = 0;
  while (score >= extraLifeThreshold(n)) n++;
  return n;
}

export function isBonusStage(stage: number): boolean {
  return stage >= FIRST_BONUS_STAGE && (stage - FIRST_BONUS_STAGE) % BONUS_STAGE_EVERY === 0;
}

/** Numero di stage normali che precedono `stage` (misura della difficoltà). */
export function normalStagesBefore(stage: number): number {
  let k = 0;
  for (let s = 1; s < stage; s++) if (!isBonusStage(s)) k++;
  return k;
}

export function bonusStageReward(hits: number, total: number): number {
  return hits >= total ? SCORE.bonusPerfect : hits * SCORE.bonusPerHit;
}

/** Percentuale colpi a segno, una cifra decimale (troncata come nei vecchi cabinati). */
export function hitRatio(shots: number, hits: number): number {
  if (shots <= 0) return 0;
  return Math.floor((hits / shots) * 1000) / 10;
}

/** Badge degli stage: scomposizione greedy in 50/30/20/10/5/1. */
export const BADGE_VALUES = [50, 30, 20, 10, 5, 1] as const;
export function stageBadges(stage: number, out: number[] = []): number[] {
  out.length = 0;
  let s = stage;
  for (const v of BADGE_VALUES) while (s >= v) { out.push(v); s -= v; }
  return out;
}
