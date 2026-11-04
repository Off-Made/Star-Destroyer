import { describe, it, expect } from 'vitest';
import {
  Kind, enemyScore, extraLifeThreshold, extraLivesFor, isBonusStage, bonusStageReward, hitRatio, stageBadges,
} from '../../src/game/scoring';

describe('punteggi', () => {
  it('base 50/100, medio 80/160', () => {
    expect(enemyScore(Kind.Mite, false)).toBe(50);
    expect(enemyScore(Kind.Mite, true)).toBe(100);
    expect(enemyScore(Kind.Raider, false)).toBe(80);
    expect(enemyScore(Kind.Raider, true)).toBe(160);
  });
  it('comandante 150 in formazione, 400/800/1600 in attacco con 0/1/2 scorte', () => {
    expect(enemyScore(Kind.Warden, false)).toBe(150);
    expect(enemyScore(Kind.Warden, false, 2)).toBe(150);
    expect(enemyScore(Kind.Warden, true, 0)).toBe(400);
    expect(enemyScore(Kind.Warden, true, 1)).toBe(800);
    expect(enemyScore(Kind.Warden, true, 2)).toBe(1600);
  });
});

describe('vite extra', () => {
  it('20.000, 70.000 e poi ogni 70.000', () => {
    expect([0, 1, 2, 3, 4].map(extraLifeThreshold)).toEqual([20000, 70000, 140000, 210000, 280000]);
    expect(extraLivesFor(19999)).toBe(0);
    expect(extraLivesFor(20000)).toBe(1);
    expect(extraLivesFor(69999)).toBe(1);
    expect(extraLivesFor(70000)).toBe(2);
    expect(extraLivesFor(140000)).toBe(3);
  });
});

describe('stage bonus e statistiche', () => {
  it('stage bonus al 3 e poi ogni 4', () => {
    const bonus = Array.from({ length: 20 }, (_, i) => i + 1).filter(isBonusStage);
    expect(bonus).toEqual([3, 7, 11, 15, 19]);
  });
  it('PERFECT = 10.000, altrimenti colpi × 100', () => {
    expect(bonusStageReward(40, 40)).toBe(10000);
    expect(bonusStageReward(39, 40)).toBe(3900);
    expect(bonusStageReward(0, 40)).toBe(0);
  });
  it('percentuale colpi', () => {
    expect(hitRatio(0, 0)).toBe(0);
    expect(hitRatio(200, 100)).toBe(50);
    expect(hitRatio(3, 1)).toBe(33.3);
  });
  it('badge 50/30/20/10/5/1', () => {
    expect(stageBadges(1)).toEqual([1]);
    expect(stageBadges(7)).toEqual([5, 1, 1]);
    expect(stageBadges(27)).toEqual([20, 5, 1, 1]);
    expect(stageBadges(86)).toEqual([50, 30, 5, 1]);
  });
});
