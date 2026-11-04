/** Tastiera e gamepad (desktop). */
import type { Input } from '../game/game';

export interface HostActions {
  start(): void;
  pause(): void;
  mute(): void;
}

export class Keyboard {
  private down = new Set<string>();
  private prevFire = false;

  constructor(private actions: HostActions) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) { if (this.isGameKey(e.code)) e.preventDefault(); return; }
      this.down.add(e.code);
      switch (e.code) {
        case 'Enter': case 'NumpadEnter': this.actions.start(); break;
        case 'KeyP': case 'Escape': this.actions.pause(); break;
        case 'KeyM': this.actions.mute(); break;
      }
      if (this.isGameKey(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  }

  private isGameKey(c: string) {
    return c === 'Space' || c.startsWith('Arrow');
  }

  /** Scrive lo stato della tastiera nell'input del gioco (OR con gli altri dispositivi). */
  apply(inp: Input) {
    const d = this.down;
    if (d.has('ArrowLeft') || d.has('KeyA')) inp.left = true;
    if (d.has('ArrowRight') || d.has('KeyD')) inp.right = true;
    const fire = d.has('Space') || d.has('KeyZ') || d.has('KeyX') || d.has('ArrowUp');
    if (fire) inp.fire = true;
    if (fire && !this.prevFire) inp.firePressed = true;
    this.prevFire = fire;
  }
}

export class Gamepads {
  private prevFire = false;
  private prevStart = false;
  private prevPause = false;
  constructor(private actions: HostActions) {}

  apply(inp: Input) {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    let fire = false, start = false, pause = false;
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes[0] ?? 0;
      if (ax < -0.35 || p.buttons[14]?.pressed) inp.left = true;
      if (ax > 0.35 || p.buttons[15]?.pressed) inp.right = true;
      if (p.buttons[0]?.pressed || p.buttons[1]?.pressed || p.buttons[2]?.pressed) fire = true;
      if (p.buttons[9]?.pressed) start = true;
      if (p.buttons[8]?.pressed) pause = true;
    }
    if (fire) inp.fire = true;
    if (fire && !this.prevFire) inp.firePressed = true;
    if (start && !this.prevStart) this.actions.start();
    if (pause && !this.prevPause) this.actions.pause();
    this.prevFire = fire; this.prevStart = start; this.prevPause = pause;
  }
}
