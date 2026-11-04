/**
 * Costruisce UNA volta, all'avvio, tutti gli sprite pre-renderizzati:
 * - sprite 16×16 in 32 rotazioni (nearest-neighbour, pixel nitidi, nessun costo per frame);
 * - esplosioni procedurali;
 * - font bitmap in più colori;
 * - logo e badge.
 */
import { PALETTE } from '../config';
import { SHIP, MITE, RAIDER, WARDEN, RECOLOR, BADGES, HalfSprite } from '../art/sprites';
import { GLYPHS, FONT_CHARS } from '../art/font';

export const ROT_STEPS = 32;
export const CELL = 16;

export enum Spr { Ship, Captive, Mite0, Mite1, Raider0, Raider1, Warden0, Warden1, WardenHurt0, WardenHurt1, Count }

export const FONT_COLORS = ['W', 'R', 'C', 'Y', 'B', 'T', 'M', 'O', 'G', 'L', 'V', 'S', 'D'] as const;
export type FontColor = typeof FONT_COLORS[number];

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** Espande le mezze righe in una matrice 16×16 di caratteri palette. */
export function expandHalf(half: HalfSprite, recolor?: Record<string, string>): string[] {
  return half.map((row) => {
    const full = row + row.split('').reverse().join('');
    return recolor ? full.replace(/./g, (ch) => recolor[ch] ?? ch) : full;
  });
}

function paintRotated(ctx: CanvasRenderingContext2D, rows: string[], ox: number, oy: number, angle: number) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const c = (CELL - 1) / 2;
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      // rotazione inversa: per ogni pixel di destinazione cerco il pixel sorgente
      const dx = x - c, dy = y - c;
      const sx = Math.round(c + dx * cos + dy * sin);
      const sy = Math.round(c - dx * sin + dy * cos);
      if (sx < 0 || sy < 0 || sx >= CELL || sy >= CELL) continue;
      const ch = rows[sy][sx];
      if (ch === '.' || !ch) continue;
      ctx.fillStyle = PALETTE[ch];
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

export interface Atlas {
  sprites: HTMLCanvasElement;
  fx: HTMLCanvasElement; // esplosioni: riga 0 piccole (24px), riga 1 grandi (32px)
  font: HTMLCanvasElement;
  fontIndex: Int16Array; // charCode → colonna
  logo: HTMLCanvasElement;
  /** Parola START nello stesso stile del logo: normale e "accesa" (per il lampeggio). */
  start: HTMLCanvasElement;
  startLit: HTMLCanvasElement;
  badges: Map<number, HTMLCanvasElement>;
}

export function buildAtlas(): Atlas {
  const defs: string[][] = [
    expandHalf(SHIP),
    expandHalf(SHIP, RECOLOR.captive),
    expandHalf(MITE[0]), expandHalf(MITE[1]),
    expandHalf(RAIDER[0]), expandHalf(RAIDER[1]),
    expandHalf(WARDEN[0]), expandHalf(WARDEN[1]),
    expandHalf(WARDEN[0], RECOLOR.wardenHurt), expandHalf(WARDEN[1], RECOLOR.wardenHurt),
  ];
  const sprites = canvas(ROT_STEPS * CELL, Spr.Count * CELL);
  const sctx = sprites.getContext('2d')!;
  defs.forEach((rows, id) => {
    for (let r = 0; r < ROT_STEPS; r++) paintRotated(sctx, rows, r * CELL, id * CELL, (r / ROT_STEPS) * Math.PI * 2);
  });

  // ── Esplosioni procedurali (seme fisso → sempre identiche) ──
  const fx = canvas(4 * 32, 2 * 32);
  const fctx = fx.getContext('2d')!;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const sparks = Array.from({ length: 28 }, () => ({ a: rnd() * Math.PI * 2, r: 0.4 + rnd() * 0.6, c: rnd() }));
  for (let big = 0; big < 2; big++) {
    const size = big ? 32 : 24;
    const colors = big ? ['W', 'C', 'R', 'Y'] : ['W', 'Y', 'O', 'R'];
    for (let f = 0; f < 4; f++) {
      const ox = f * 32 + (32 - size) / 2, oy = big * 32 + (32 - size) / 2;
      const radius = (size / 2 - 1) * (0.3 + f * 0.24);
      for (const s of sparks) {
        const r = radius * s.r;
        const x = Math.round(size / 2 + Math.cos(s.a) * r), y = Math.round(size / 2 + Math.sin(s.a) * r);
        const col = colors[Math.min(3, Math.floor(s.c * 2) + f)];
        if (f === 3 && s.c > 0.6) continue;
        fctx.fillStyle = PALETTE[col];
        const sz = f < 2 ? 2 : 1;
        fctx.fillRect(ox + x, oy + y, sz, sz);
      }
      if (f < 2) { // nucleo
        fctx.fillStyle = PALETTE[f === 0 ? 'W' : 'Y'];
        const c = size / 2 - 2 + f;
        fctx.fillRect(ox + c, oy + c, 4 - f * 2, 4 - f * 2);
      }
    }
  }

  // ── Font ──
  const font = canvas(FONT_CHARS.length * 8, FONT_COLORS.length * 8);
  const tctx = font.getContext('2d')!;
  const fontIndex = new Int16Array(128).fill(-1);
  [...FONT_CHARS].forEach((ch, i) => {
    fontIndex[ch.charCodeAt(0)] = i;
    const g = GLYPHS[ch];
    FONT_COLORS.forEach((col, ci) => {
      tctx.fillStyle = PALETTE[col];
      for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) if (g[y][x] === '#') tctx.fillRect(i * 8 + x + 1, ci * 8 + y, 1, 1);
    });
  });

  // ── Logo: lettere ×3 con gradiente e contorno ──
  const logo = buildLogo(['STAR', 'DESTROYER'], LOGO_GRAD);
  const start = buildLogo(['START'], LOGO_GRAD);
  const startLit = buildLogo(['START'], LIT_GRAD);

  // ── Badge ──
  const badges = new Map<number, HTMLCanvasElement>();
  for (const [k, rows] of Object.entries(BADGES)) {
    const v = Number(k);
    const wide = v >= 10;
    const full = wide ? expandHalf(rows) : (rows as string[]);
    const c = canvas(wide ? 16 : 8, 16);
    const bctx = c.getContext('2d')!;
    full.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      bctx.fillStyle = PALETTE[ch]; bctx.fillRect(x, y, 1, 1);
    }));
    badges.set(v, c);
  }

  return { sprites, fx, font, fontIndex, logo, start, startLit, badges };
}

/** Gradiente del logo (riga per riga del glifo) e variante "accesa" per il lampeggio. */
const LOGO_GRAD = ['Y', 'Y', 'O', 'O', 'R', 'M', 'P'];
const LIT_GRAD = ['W', 'W', 'Y', 'Y', 'O', 'O', 'R'];

/** Scritta in stile logo: pixel ×3, gradiente verticale, contorno blu con ombra. */
function buildLogo(lines: string[], grad: string[]): HTMLCanvasElement {
  const S = 3; // scala dei pixel del logo
  const maxLen = Math.max(...lines.map((l) => l.length));
  const w = maxLen * 6 * S + 8, h = lines.length * 9 * S + 8;
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  const pass = (outline: boolean) => {
    lines.forEach((line, li) => {
      const lw = line.length * 6 * S;
      const ox = Math.floor((w - lw) / 2), oy = 4 + li * 9 * S;
      [...line].forEach((ch, i) => {
        const g = GLYPHS[ch];
        for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) {
          if (g[y][x] !== '#') continue;
          const px = ox + i * 6 * S + x * S, py = oy + y * S;
          if (outline) {
            ctx.fillStyle = PALETTE.B;
            ctx.fillRect(px - 1, py - 1, S + 2, S + 2);
            ctx.fillStyle = PALETTE.N;
            ctx.fillRect(px + 1, py + 2, S + 1, S + 1);
          } else {
            ctx.fillStyle = PALETTE[grad[y]];
            ctx.fillRect(px, py, S, S);
            if (y === 0) { ctx.fillStyle = PALETTE.W; ctx.fillRect(px, py, S, 1); }
          }
        }
      });
    });
  };
  pass(true);
  pass(false);
  return c;
}
