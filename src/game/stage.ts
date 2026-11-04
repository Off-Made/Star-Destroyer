/**
 * Composizione degli stage: 5 ondate da 8 nemici (= 40), con varianti per stage.
 * Le liste vengono costruite una volta a inizio stage (fuori dal loop caldo).
 */
import { ENTRY_SPAWN_GAP } from '../config';
import { ENTRY_PATHS, BONUS_PATHS, Path } from './paths';
import { slotIndex as si } from './formation';
import { Kind } from './scoring';

export interface Spawn {
  /** Frame di ritardo rispetto all'inizio dell'ondata. */
  delay: number;
  slot: number; // -1 nello stage bonus
  kind: Kind;
  path: Path;
  mirror: boolean;
  /** Spostamento laterale per l'ingresso "a coppie". */
  dx: number;
}

export type Wave = Spawn[];

interface WaveDef {
  streams: { path: Path; mirror: boolean; slots: number[] }[];
}

function kindOf(slot: number): Kind {
  const row = Math.floor(slot / 10);
  return row === 0 ? Kind.Warden : row <= 2 ? Kind.Raider : Kind.Mite;
}

/** Restituisce le 5 ondate di uno stage normale. `k` = stage normali già superati. */
export function buildStageWaves(k: number, paired: boolean): Wave[] {
  const variant = k >= 3 ? (k % 2) : -1;
  const top = variant === 0 ? ENTRY_PATHS.topSnake : ENTRY_PATHS.topLoop;
  const bottom = variant === 1 ? ENTRY_PATHS.bottomHook : ENTRY_PATHS.bottomLoop;
  const flip = k % 2 === 1; // gli stage dispari invertono i lati

  const defs: WaveDef[] = [
    { streams: [
      { path: top, mirror: flip, slots: [si(1, 4), si(1, 5), si(2, 4), si(2, 5)] },
      { path: top, mirror: !flip, slots: [si(3, 4), si(3, 5), si(4, 4), si(4, 5)] },
    ] },
    { streams: [{ path: bottom, mirror: flip, slots: [
      si(0, 3), si(1, 3), si(0, 4), si(2, 3), si(0, 5), si(1, 6), si(0, 6), si(2, 6),
    ] }] },
    { streams: [{ path: bottom, mirror: !flip, slots: [
      si(1, 7), si(1, 8), si(2, 7), si(2, 8), si(1, 2), si(1, 1), si(2, 2), si(2, 1),
    ] }] },
    { streams: [{ path: top, mirror: !flip, slots: [
      si(3, 6), si(3, 7), si(4, 6), si(4, 7), si(3, 3), si(3, 2), si(4, 3), si(4, 2),
    ] }] },
    { streams: [{ path: top, mirror: flip, slots: [
      si(3, 0), si(3, 1), si(4, 0), si(4, 1), si(3, 9), si(3, 8), si(4, 9), si(4, 8),
    ] }] },
  ];

  return defs.map((def) => {
    const wave: Wave = [];
    for (const st of def.streams) {
      st.slots.forEach((slot, i) => {
        // A coppie: due nemici affiancati partono insieme.
        const pairIdx = paired ? Math.floor(i / 2) : i;
        const dx = paired ? (i % 2 === 0 ? -6 : 6) : 0;
        wave.push({ delay: pairIdx * ENTRY_SPAWN_GAP * (paired ? 1.6 : 1), slot, kind: kindOf(slot), path: st.path, mirror: st.mirror, dx });
      });
    }
    return wave;
  });
}

/** Stage bonus: 5 ondate da 8, percorsi che escono dallo schermo. */
export function buildBonusWaves(bonusIndex: number): Wave[] {
  const kinds: Kind[][] = [
    [Kind.Mite, Kind.Mite, Kind.Raider, Kind.Raider, Kind.Mite],
    [Kind.Raider, Kind.Warden, Kind.Mite, Kind.Raider, Kind.Mite],
    [Kind.Mite, Kind.Raider, Kind.Warden, Kind.Mite, Kind.Raider],
  ];
  const ks = kinds[bonusIndex % kinds.length];
  const waves: Wave[] = [];
  for (let w = 0; w < 5; w++) {
    const path = BONUS_PATHS[(w + bonusIndex * 2) % BONUS_PATHS.length];
    const twin = (w + bonusIndex) % 2 === 0; // due flussi speculari o un unico flusso
    const wave: Wave = [];
    for (let i = 0; i < 8; i++) {
      const mirror = twin ? i % 2 === 1 : (w % 2 === 1);
      const delay = twin ? Math.floor(i / 2) * ENTRY_SPAWN_GAP * 1.3 : i * ENTRY_SPAWN_GAP;
      wave.push({ delay, slot: -1, kind: ks[w], path, mirror, dx: 0 });
    }
    waves.push(wave);
  }
  return waves;
}
