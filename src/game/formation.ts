/**
 * Formazione 10×5. Durante gli ingressi oscilla lateralmente ("sway"); quando tutte le
 * ondate sono entrate passa al "respiro" (espansione/contrazione attorno al centro).
 *
 * Disposizione (righe dall'alto):
 *   0: 4 comandanti   (colonne 3-6)
 *   1: 8 raider        (colonne 1-8)
 *   2: 8 raider        (colonne 1-8)
 *   3: 10 mite         (colonne 0-9)
 *   4: 10 mite         (colonne 0-9)
 */
import {
  FORM_COLS, FORM_ROWS, FORM_CX, FORM_TOP, FORM_DX, FORM_DY,
  FORM_SWAY_AMP, FORM_SWAY_SPEED, FORM_BREATHE_AMP, FORM_BREATHE_SPEED,
} from '../config';
import { Kind } from './scoring';

export const SLOT_COUNT = FORM_COLS * FORM_ROWS;

export function slotKind(slot: number): Kind {
  const row = (slot / FORM_COLS) | 0;
  return row === 0 ? Kind.Warden : row <= 2 ? Kind.Raider : Kind.Mite;
}

export function slotIndex(row: number, col: number) { return row * FORM_COLS + col; }

/** Le 40 caselle realmente usate. */
export const USED_SLOTS: readonly number[] = (() => {
  const s: number[] = [];
  for (let c = 3; c <= 6; c++) s.push(slotIndex(0, c));
  for (let r = 1; r <= 2; r++) for (let c = 1; c <= 8; c++) s.push(slotIndex(r, c));
  for (let r = 3; r <= 4; r++) for (let c = 0; c <= 9; c++) s.push(slotIndex(r, c));
  return s;
})();

export class Formation {
  readonly sx = new Float32Array(SLOT_COUNT);
  readonly sy = new Float32Array(SLOT_COUNT);
  phase = 0;
  breathing = false;
  /** 0→1 transizione morbida da sway a respiro. */
  private blend = 0;
  private swayOffset = 0;

  reset() {
    this.phase = 0; this.breathing = false; this.blend = 0; this.swayOffset = 0;
    this.compute();
  }

  step() {
    this.phase += this.breathing ? FORM_BREATHE_SPEED : FORM_SWAY_SPEED;
    if (this.breathing && this.blend < 1) this.blend = Math.min(1, this.blend + 0.02);
    this.compute();
  }

  startBreathing() {
    if (this.breathing) return;
    // Il respiro parte con la formazione centrata (si "congela" lo sway e poi lo si azzera).
    this.swayOffset = Math.sin(this.phase) * FORM_SWAY_AMP;
    this.breathing = true;
    this.phase = 0;
  }

  private compute() {
    let ox: number, spread: number;
    if (!this.breathing) {
      ox = Math.sin(this.phase) * FORM_SWAY_AMP;
      spread = 1;
    } else {
      ox = this.swayOffset * (1 - this.blend);
      spread = 1 + (1 - Math.cos(this.phase)) * 0.5 * FORM_BREATHE_AMP * this.blend;
    }
    for (let r = 0; r < FORM_ROWS; r++) {
      for (let c = 0; c < FORM_COLS; c++) {
        const i = r * FORM_COLS + c;
        this.sx[i] = FORM_CX + ox + (c - (FORM_COLS - 1) / 2) * FORM_DX * spread;
        this.sy[i] = FORM_TOP + r * FORM_DY * spread;
      }
    }
  }
}
