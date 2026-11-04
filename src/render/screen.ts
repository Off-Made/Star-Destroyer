/**
 * Layout responsive: canvas 224×288 scalato a multipli INTERI di pixel fisici quando
 * possibile (pixel perfettamente quadrati e nitidi), barre nere ai lati.
 * Non c'è nessun controller: TUTTO lo schermo (canvas e spazio libero) è superficie di
 * tocco. Rispetta le safe-area (notch, Dynamic Island, barra home).
 */
import { SCREEN_W, SCREEN_H } from '../config';

export interface LayoutEls {
  app: HTMLElement;
  canvas: HTMLCanvasElement;
  crt: HTMLElement;
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
  left: number;
  top: number;
  portrait: boolean;
  integer: boolean;
}

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

const BAR_H = 44;

export function layout(els: LayoutEls, touch: boolean): LayoutResult {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cs = getComputedStyle(els.probe);
  const st = parseFloat(cs.paddingTop) || 0, sb = parseFloat(cs.paddingBottom) || 0;
  const sl = parseFloat(cs.paddingLeft) || 0, sr = parseFloat(cs.paddingRight) || 0;
  const dpr = window.devicePixelRatio || 1;
  const availW = vw - sl - sr, availH = vh - st - sb;
  const portrait = availH >= availW * 1.05;

  // stessa dimensione del canvas in home e in partita (niente "salti" all'avvio)
  const { scale, integer } = computeScale(availW, availH, dpr);
  const cssW = (SCREEN_W * scale) / dpr, cssH = (SCREEN_H * scale) / dpr;
  const x = sl + (availW - cssW) / 2;
  // telefono in verticale: canvas in alto, lo spazio sotto resta libero per il dito
  const y = touch && portrait ? st + Math.max(0, Math.min(6, availH - cssH)) : st + (availH - cssH) / 2;
  place(els.canvas, x, y, cssW, cssH);
  place(els.crt, x, y, cssW, cssH);
  place(els.homeStart, x + cssW * 0.18, y + cssH * (220 / SCREEN_H), cssW * 0.64, cssH * (26 / SCREEN_H));
  // tastino pausa nell'angolo in alto a destra dell'HUD (lì non passa mai l'azione)
  const ps = Math.max(30, Math.round(cssW * (18 / SCREEN_W)));
  place(els.pause, x + cssW - ps - 4, y + 3, ps, ps);

  els.app.classList.toggle('touch', touch);
  els.app.classList.toggle('portrait', portrait);

  // barra della home (MUSICA / OPZIONI) e riquadro "come si gioca"
  const below = vh - sb - (y + cssH);
  let compactHome = false;
  if (portrait && below >= BAR_H + 14) {
    const top = y + cssH + 8;
    place(els.bar, sl + 10, top, availW - 20, BAR_H);
    const helpTop = top + BAR_H + 14;
    const helpH = vh - sb - helpTop - 8;
    place(els.homeHelp, sl + 13, helpTop, availW - 26, helpH);
    els.homeHelp.classList.toggle('no-space', helpH < 70);
    els.homeHelp.classList.toggle('compact', helpH < 130);
  } else {
    // poco spazio sotto (tablet, orizzontale, desktop): barra a lato del canvas se c'è posto
    const sideW = vw - sr - (x + cssW);
    if (sideW >= 180) place(els.bar, x + cssW + 10, st + 10, Math.min(280, sideW - 20), BAR_H);
    else {
      // altrimenti sulla fascia bassa del canvas (la home nasconde la scritta di piè di pagina)
      place(els.bar, x + 8, y + cssH * (258 / SCREEN_H), cssW - 16, Math.min(BAR_H, cssH * (26 / SCREEN_H)));
      compactHome = true;
    }
    els.homeHelp.classList.add('no-space');
  }
  els.app.classList.toggle('compact-home', compactHome);
  return { scale, cssW, cssH, left: x, top: y, portrait, integer };
}
