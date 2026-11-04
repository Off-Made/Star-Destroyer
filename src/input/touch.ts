/**
 * Controlli touch con Pointer Events (multitouch: ogni dito ha il suo pointerId).
 * - Pad di trascinamento: relativo (sposta di quanto muovi il dito × sensibilità)
 *   oppure assoluto (la nave va dove si trova il dito lungo la larghezza del pad).
 * - Pulsante FIRE grande con auto-fire tenendo premuto.
 * - Modalità alternativa con pulsanti ◀ ▶.
 */
import type { Input } from '../game/game';
import { SCREEN_W } from '../config';

export interface TouchSettings {
  controls: 'drag' | 'buttons';
  dragMode: 'relative' | 'absolute';
  sensitivity: number;
}

export class TouchControls {
  private dragId = -1;
  private lastX = 0;
  private dragAcc = 0;
  private absX = NaN;
  private fireIds = new Set<number>();
  private leftIds = new Set<number>();
  private rightIds = new Set<number>();
  private firePulse = false;
  /** px CSS per pixel logico del canvas (aggiornato dal layout). */
  cssPerPixel = 2;
  onAnyTouch: (() => void) | null = null;

  constructor(
    private pad: HTMLElement,
    fire: HTMLElement,
    left: HTMLElement,
    right: HTMLElement,
    private settings: TouchSettings,
    private vibrate: () => void,
  ) {
    this.bindPad();
    this.bindHold(fire, this.fireIds, () => { this.firePulse = true; this.vibrate(); });
    this.bindHold(left, this.leftIds);
    this.bindHold(right, this.rightIds);
  }

  private bindPad() {
    const pad = this.pad;
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.onAnyTouch?.();
      if (this.settings.controls !== 'drag' || this.dragId !== -1) return;
      this.dragId = e.pointerId;
      this.lastX = e.clientX;
      try { pad.setPointerCapture(e.pointerId); } catch { /* */ }
      if (this.settings.dragMode === 'absolute') this.absX = this.toLogical(e.clientX);
      pad.classList.add('active');
    });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.dragId) return;
      e.preventDefault();
      if (this.settings.dragMode === 'absolute') this.absX = this.toLogical(e.clientX);
      else {
        this.dragAcc += ((e.clientX - this.lastX) / this.cssPerPixel) * this.settings.sensitivity;
        this.lastX = e.clientX;
      }
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.dragId) return;
      this.dragId = -1;
      this.absX = NaN;
      pad.classList.remove('active');
    };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
    pad.addEventListener('lostpointercapture', end);
  }

  private toLogical(clientX: number) {
    const r = this.pad.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - r.left) / Math.max(1, r.width)));
    // margine del 6% ai lati per raggiungere comodamente i bordi
    return Math.min(1, Math.max(0, (t - 0.06) / 0.88)) * SCREEN_W;
  }

  private bindHold(el: HTMLElement, ids: Set<number>, onDown?: () => void) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.onAnyTouch?.();
      ids.add(e.pointerId);
      try { el.setPointerCapture(e.pointerId); } catch { /* */ }
      el.classList.add('active');
      onDown?.();
    });
    const up = (e: PointerEvent) => {
      ids.delete(e.pointerId);
      if (ids.size === 0) el.classList.remove('active');
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }

  apply(inp: Input) {
    if (this.leftIds.size) inp.left = true;
    if (this.rightIds.size) inp.right = true;
    if (this.fireIds.size) inp.fire = true;
    if (this.firePulse) { inp.firePressed = true; this.firePulse = false; }
    if (this.dragAcc !== 0) { inp.drag += this.dragAcc; this.dragAcc = 0; }
    if (!Number.isNaN(this.absX)) inp.absX = this.absX;
  }

  clearDrag() { this.dragAcc = 0; }

  reset() {
    this.dragId = -1; this.dragAcc = 0; this.absX = NaN;
    this.fireIds.clear(); this.leftIds.clear(); this.rightIds.clear();
  }
}
