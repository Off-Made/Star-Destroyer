/** Pilota automatico per la demo dell'attract mode: insegue i bersagli e schiva i proiettili. */
import { Game, ES } from './game';

export function demoInput(g: Game) {
  const inp = g.input;
  inp.left = inp.right = false;
  inp.fire = true;
  inp.autofire = true;
  inp.absX = NaN;
  let target = g.px;
  // bersaglio: il nemico più basso (i tuffatori hanno la priorità)
  let best = -1;
  for (const e of g.enemies) {
    if (!e.active || e.state === ES.Wait) continue;
    const score = e.y + (e.state === ES.Form ? 0 : 200);
    if (score > best) { best = score; target = e.x; }
  }
  // schivata: proiettili in arrivo sopra la nave
  for (const b of g.eBullets) {
    if (!b.active) continue;
    const dy = g.py - b.y;
    if (dy > 0 && dy < 70 && Math.abs(b.x + b.vx * (dy / b.vy) - g.px) < 12) {
      target = g.px + (b.x < g.px ? 30 : -30);
    }
  }
  for (const e of g.enemies) {
    if (!e.active || e.state === ES.Form) continue;
    if (e.y > g.py - 50 && Math.abs(e.x - g.px) < 18) target = g.px + (e.x < g.px ? 30 : -30);
  }
  if (target < g.px - 2) inp.left = true;
  else if (target > g.px + 2) inp.right = true;
}
