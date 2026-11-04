/**
 * Grafica retrò per l'interfaccia HTML: etichette e icone generate come piccoli canvas a
 * partire dagli STESSI glifi bitmap del gioco, poi ingrandite con image-rendering: pixelated.
 * Così pulsanti e menu hanno esattamente il font del cabinato, senza web font esterni.
 */
import { PALETTE } from '../config';
import { GLYPHS } from '../art/font';

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.className = 'px';
  return c;
}

/** Testo in pixel font (celle 6×8) con ombra "a gradino" in blu notte. */
export function pixelText(text: string, color = 'Y', shadow = 'N'): HTMLCanvasElement {
  const t = text.toUpperCase();
  const c = makeCanvas(t.length * 6 + 1, 9);
  const ctx = c.getContext('2d')!;
  for (const [col, dx, dy] of [[shadow, 1, 1], [color, 0, 0]] as const) {
    ctx.fillStyle = PALETTE[col];
    [...t].forEach((ch, i) => {
      const g = GLYPHS[ch] ?? GLYPHS[' '];
      for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) {
        if (g[y][x] === '#') ctx.fillRect(i * 6 + x + dx, y + dy + 1, 1, 1);
      }
    });
  }
  return c;
}

/** Sostituisce il contenuto di un elemento con un'etichetta in pixel font. */
export function setPixelLabel(el: HTMLElement, text: string, color = 'Y') {
  el.replaceChildren(pixelText(text, color));
  el.setAttribute('aria-label', text);
}

/** Icona di pausa 11×11: due barre gialle in una cornice blu a angoli tagliati. */
export function pauseIcon(): HTMLCanvasElement {
  const rows = [
    '.BBBBBBBBB.',
    'BKKKKKKKKKB',
    'BKKYYKYYKKB',
    'BKKYYKYYKKB',
    'BKKYYKYYKKB',
    'BKKYYKYYKKB',
    'BKKYYKYYKKB',
    'BKKYYKYYKKB',
    'BKKYYKYYKKB',
    'BKKKKKKKKKB',
    '.BBBBBBBBB.',
  ];
  return paint(rows);
}

/**
 * Pulsante FIRE in pixel art (40×40): cerchio a gradini con anello scuro, bordo
 * luminoso, riflesso ad arco e scritta FIRE. `pressed` = versione premuta.
 */
export function fireButton(pressed: boolean): HTMLCanvasElement {
  const S = 40, c = makeCanvas(S, S);
  const ctx = c.getContext('2d')!;
  const cx = (S - 1) / 2, cy = (S - 1) / 2;
  const off = pressed ? 1 : 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.hypot(x - cx, y - cy);
    let col: string | null = null;
    if (d <= 19.5 && d > 18) col = 'N';                       // anello esterno
    else if (d <= 18 && d > 16.2) col = pressed ? 'M' : 'O';  // bordo luminoso
    else if (d <= 16.2) {
      const dy = y - off - cy, dx = x - cx;
      col = pressed ? 'R' : dy > 9 ? 'M' : 'R';               // ombra in basso
      // riflesso ad arco in alto a sinistra
      const dd = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
      if (!pressed && dd > 11 && dd < 13.5 && ang > -2.6 && ang < -1.7) col = 'W';
    }
    if (col) { ctx.fillStyle = PALETTE[col]; ctx.fillRect(x, y, 1, 1); }
  }
  const label = pixelText('FIRE', 'W', 'N');
  ctx.drawImage(label, Math.floor((S - label.width) / 2) + 1, 15 + off);
  return c;
}

function paint(rows: string[]): HTMLCanvasElement {
  const c = makeCanvas(rows[0].length, rows.length);
  const ctx = c.getContext('2d')!;
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === '.') return;
    ctx.fillStyle = PALETTE[ch]; ctx.fillRect(x, y, 1, 1);
  }));
  return c;
}
