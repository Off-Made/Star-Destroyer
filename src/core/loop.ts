/**
 * Game loop a timestep fisso (60 Hz logici) guidato da requestAnimationFrame.
 * Funziona identico su display a 60/90/120/144 Hz: la logica avanza sempre a passi
 * di 1/60 s grazie a un accumulatore; il rendering avviene una volta per rAF.
 */
import { TICK_MS, MAX_CATCHUP_TICKS } from '../config';

export class FixedLoop {
  private acc = 0;
  private last = 0;
  private raf = 0;
  running = false;
  /** Durata media del frame (ms), utile per diagnostica prestazioni. */
  frameMs = 16.7;
  /** Tempo CPU medio speso in logica + rendering per frame (ms): la vera misura del costo. */
  workMs = 0;

  constructor(private tick: () => void, private render: () => void) {}

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  // Arrow function creata una volta: nessuna allocazione per frame.
  private frame = (now: number) => {
    if (!this.running) return;
    let dt = now - this.last;
    this.last = now;
    if (dt > 250) dt = 250; // ritorno da background / tab inattiva
    this.frameMs += (dt - this.frameMs) * 0.05;
    this.acc += dt;
    const t0 = performance.now();
    let n = 0;
    while (this.acc >= TICK_MS && n < MAX_CATCHUP_TICKS) {
      this.tick();
      this.acc -= TICK_MS;
      n++;
    }
    if (n === MAX_CATCHUP_TICKS) this.acc = 0;
    this.render();
    this.workMs += (performance.now() - t0 - this.workMs) * 0.05;
    this.raf = requestAnimationFrame(this.frame);
  };
}

/** PRNG deterministico (mulberry32): stessa sequenza a parità di seme → test riproducibili. */
export class Rng {
  constructor(private s = 0x9e3779b9) {}
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number) { return a + (b - a) * this.next(); }
  int(n: number) { return Math.floor(this.next() * n); }
  chance(p: number) { return this.next() < p; }
}
