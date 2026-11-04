/**
 * Layout responsive: canvas 224×288 scalato a multipli INTERI di pixel fisici quando
 * possibile (pixel perfettamente quadrati e nitidi), barre nere ai lati, controlli touch
 * nello spazio libero. Rispetta le safe-area (notch, Dynamic Island, barra home).
 */
import { SCREEN_W, SCREEN_H } from '../config';

export interface LayoutEls {
  app: HTMLElement;
  canvas: HTMLCanvasElement;
  crt: HTMLElement;
  pad: HTMLElement;
  fire: HTMLElement;
  bar: HTMLElement;
  pause: HTMLElement;
  probe: HTMLElement;
  homeStart: HTMLElement;
  homeHelp: HTMLElement;
}

export interface LayoutResult {
  scale: number; // pixel fisici per pixel logico
  cssW: number;
  cssH: number;
  portrait: boolean;
  integer: boolean;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function place(el: HTMLElement, x: number, y: number, w: number, h: number) {
  const s = el.style;
  s.left = `${x}px`; s.top = `${y}px`; s.width = `${Math.max(0, w)}px`; s.height = `${Math.max(0, h)}px`;
}

export function computeScale(availCssW: number, availCssH: number, dpr: number) {
  const s = Math.min((availCssW * dpr) / SCREEN_W, (availCssH * dpr) / SCREEN_H);
  const si = Math.floor(s);
  // scala intera se non sacrifica più del 22% dello spazio; altrimenti frazionaria
  const integer = si >= 1 && si / s >= 0.78;
  return { scale: integer ? si : s, integer };
}

export function layout(els: LayoutEls, touch: boolean, home: boolean): LayoutResult {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cs = getComputedStyle(els.probe);
  const st = parseFloat(cs.paddingTop) || 0, sb = parseFloat(cs.paddingBottom) || 0;
  const sl = parseFloat(cs.paddingLeft) || 0, sr = parseFloat(cs.paddingRight) || 0;
  const dpr = window.devicePixelRatio || 1;
  const availW = vw - sl - sr, availH = vh - st - sb;
  const portrait = availH >= availW * 1.05;

  let controlsH = 0, sideW = 0;
  if (touch && portrait) controlsH = clamp(availH * 0.27, 150, 280);
  if (touch && !portrait) sideW = clamp(availW * 0.2, 120, 220);
  const gameW = availW - sideW * 2, gameH = availH - controlsH;
  const { scale, integer } = computeScale(gameW, gameH, dpr);
  const cssW = (SCREEN_W * scale) / dpr, cssH = (SCREEN_H * scale) / dpr;
  const x = sl + (availW - cssW) / 2;
  const y = touch && portrait ? st + Math.max(0, Math.min(8, gameH - cssH)) : st + (gameH - cssH) / 2;
  place(els.canvas, x, y, cssW, cssH);
  place(els.crt, x, y, cssW, cssH);
  // pulsante START della home, sopra il canvas nella fascia y 220–246 (coordinate logiche)
  place(els.homeStart, x + cssW * 0.18, y + cssH * (220 / SCREEN_H), cssW * 0.64, cssH * (26 / SCREEN_H));
  // tastino pausa nell'angolo in alto a destra dell'HUD (lì non passa mai l'azione)
  const ps = Math.max(30, Math.round(cssW * (18 / SCREEN_W)));
  place(els.pause, x + cssW - ps - 4, y + 3, ps, ps);

  els.app.classList.toggle('touch', touch);
  els.app.classList.toggle('portrait', portrait);

  if (touch && portrait) {
    // zona controlli sotto il canvas
    const top = y + cssH + 4;
    const h = vh - sb - top;
    // in home la prima riga ospita MUSICA / OPZIONI; in partita tutto lo spazio va ai controlli
    const barRow = home ? 52 : 0;
    place(els.bar, sl + 10, top + 4, availW - 20, 44);
    const ctrlTop = top + barRow + 4;
    const ctrlH = h - barRow - 12;
    const fireSize = clamp(Math.min(ctrlH, availW * 0.36), 84, 150);
    const fireX = sl + availW - fireSize - 14;
    place(els.fire, fireX, ctrlTop + (ctrlH - fireSize) / 2, fireSize, fireSize);
    const padW = fireX - sl - 26;
    place(els.pad, sl + 10, ctrlTop, padW, ctrlH);
    place(els.homeHelp, sl + 13, ctrlTop + 3, availW - 26, ctrlH - 6);
    els.homeHelp.classList.toggle('compact', ctrlH - 6 < 130); // schermi bassi (es. iPhone SE)
  } else if (touch) {
    // orizzontale: pad a sinistra, FIRE a destra
    const leftX = sl + 4, leftW = x - sl - 8;
    const rightX = x + cssW + 4, rightW = vw - sr - rightX - 4;
    place(els.bar, rightX + 4, st + 8, rightW - 8, 44);
    place(els.pad, leftX + 4, st + availH * 0.3, leftW - 8, availH * 0.68);
    const fireSize = clamp(Math.min(rightW - 12, availH * 0.45), 70, 150);
    place(els.fire, rightX + (rightW - fireSize) / 2, st + availH - fireSize - 16, fireSize, fireSize);
  } else {
    // desktop: barra pulsanti compatta in alto a destra
    place(els.bar, vw - sr - 290, st + 10, 280, 40);
  }
  return { scale, cssW, cssH, portrait, integer };
}
