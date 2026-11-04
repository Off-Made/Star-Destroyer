/**
 * Controllo touch "a dito libero" (Pointer Events).
 *
 * - Si tocca un punto QUALSIASI dello schermo e si trascina: la nave segue il dito in
 *   tempo reale, in tutte le direzioni (relativo 1:1 → puoi toccare la nave stessa o
 *   tenere il dito più in basso per vederla meglio).
 * - Finché il dito è appoggiato la nave spara da sola, verso l'alto (nei limiti dei colpi
 *   a schermo). Nessun pulsante da premere.
 * - Conta solo il primo dito; i pulsanti (pausa, menu) non avviano il trascinamento.
 */
import type { Input } from '../game/game';
import { FINGER_OFFSET_Y } from '../config';

export interface TouchSettings {
  dragMode: 'relative' | 'absolute';
  sensitivity: number;
}

export class TouchControls {
  private id = -1;
  private lastX = 0;
  private lastY = 0;
  private accX = 0;
  private accY = 0;
  private absX = NaN;
  private absY = NaN;
  private pulse = false;
  /** px CSS per pixel logico del canvas e posizione del canvas (aggiornati dal layout). */
  cssPerPixel = 2;
  canvasRect: { left: number; top: number } = { left: 0, top: 0 };
  /** Il controllo è attivo solo durante la partita (non in home o in pausa). */
  enabled = false;
  onAnyTouch: (() => void) | null = null;

  constructor(surface: HTMLElement, private settings: TouchSettings) {
    surface.addEventListener('pointerdown', (e) => {
      this.onAnyTouch?.();
      if (!this.enabled || this.id !== -1) return; // anche il mouse da PC: tieni premuto e trascina
      const t = e.target as HTMLElement;
      if (t.closest('button, .overlay, select, input, label')) return;
      e.preventDefault();
      this.id = e.pointerId;
      this.lastX = e.clientX; this.lastY = e.clientY;
      this.pulse = true;
      try { surface.setPointerCapture(e.pointerId); } catch { /* */ }
      if (this.settings.dragMode === 'absolute') this.setAbs(e.clientX, e.clientY);
    });
    surface.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.id) return;
      e.preventDefault();
      // gli eventi intermedi raggruppati dal browser: si usa l'ultima posizione reale
      const list = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      const last = list.length ? list[list.length - 1] : e;
      if (this.settings.dragMode === 'absolute') { this.setAbs(last.clientX, last.clientY); return; }
      const k = this.settings.sensitivity / this.cssPerPixel;
      this.accX += (last.clientX - this.lastX) * k;
      this.accY += (last.clientY - this.lastY) * k;
      this.lastX = last.clientX; this.lastY = last.clientY;
    });
    const end = (e: PointerEvent) => { if (e.pointerId === this.id) this.release(); };
    surface.addEventListener('pointerup', end);
    surface.addEventListener('pointercancel', end);
    surface.addEventListener('lostpointercapture', end);
  }

  private setAbs(cx: number, cy: number) {
    this.absX = (cx - this.canvasRect.left) / this.cssPerPixel;
    this.absY = (cy - this.canvasRect.top) / this.cssPerPixel + FINGER_OFFSET_Y;
  }

  get touching() { return this.id !== -1; }

  apply(inp: Input) {
    if (!this.enabled) return;
    if (this.id !== -1) inp.fire = true; // fuoco automatico finché il dito è giù
    if (this.pulse) { inp.firePressed = true; this.pulse = false; }
    if (this.accX !== 0 || this.accY !== 0) {
      inp.drag += this.accX; inp.dragY += this.accY;
      this.accX = 0; this.accY = 0;
    }
    if (!Number.isNaN(this.absX)) { inp.absX = this.absX; inp.absY = this.absY; }
  }

  private release() {
    this.id = -1;
    this.absX = this.absY = NaN;
  }

  /** Azzera tutto (inizio partita, pausa, ritorno in home). */
  reset() {
    this.release();
    this.accX = this.accY = 0;
    this.pulse = false;
  }
}
