/**
 * Layout responsive: canvas 224×288 scalato a multipli INTERI di pixel fisici quando
 * possibile (pixel perfettamente quadrati e nitidi), barre nere ai lati.
 * Non c'è nessun controller: TUTTO lo schermo (canvas e spazio libero) è superficie di
 * tocco. Rispetta le safe-area (notch, Dynamic Island, barra home).
 */
import { SCREEN_W, SCREEN_H, MAX_FIELD_H } from '../config';

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
  /** Altezza logica del campo (288 = formato arcade; di più sui telefoni). */
  fieldH: number;
  /** Fasce di area NON sicura (notch / barra Home) dentro il campo, in pixel logici. */
  insetTop: number;
  insetBottom: number;
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

  // Telefono in verticale: il campo si ALLUNGA per riempire tutto lo schermo (larghezza 224
  // logici a tutta larghezza, altezza calcolata sulle proporzioni del telefono): niente
  // barre nere. Altrove (tablet, orizzontale, PC) resta il formato arcade a scala intera.
  // Il canvas copre TUTTO lo schermo, anche sotto notch e barra Home (lì solo stelle);
  // il gioco usa le fasce "insetTop/insetBottom" per restare nella zona sicura.
  let scale: number, integer: boolean, fieldH = SCREEN_H, insetTop = 0, insetBottom = 0;
  let x: number, y: number, cssW: number, cssH: number, k: number;
  const tall = touch && portrait && vh / vw > SCREEN_H / SCREEN_W;
  if (tall) {
    scale = (vw * dpr) / SCREEN_W;
    integer = Number.isInteger(scale);
    k = vw / SCREEN_W;
    fieldH = Math.min(MAX_FIELD_H, Math.round(vh / k));
    insetTop = Math.ceil(st / k);
    insetBottom = Math.ceil(sb / k);
    cssW = vw; cssH = fieldH * k;
    x = 0; y = (vh - cssH) / 2;
  } else {
    ({ scale, integer } = computeScale(availW, availH, dpr));
    cssW = (SCREEN_W * scale) / dpr; cssH = (fieldH * scale) / dpr;
    k = cssW / SCREEN_W;
    x = sl + (availW - cssW) / 2;
    y = st + (availH - cssH) / 2;
  }
  const safeTop = y + insetTop * k; // dove inizia la zona di gioco sicura (CSS px)
  place(els.canvas, x, y, cssW, cssH);
  place(els.crt, x, y, cssW, cssH);
  place(els.homeStart, x + cssW * 0.18, safeTop + 220 * k, cssW * 0.64, 26 * k);
  // tastino pausa nell'angolo in alto a destra dell'HUD (lì non passa mai l'azione)
  const ps = Math.max(30, Math.round(cssW * (18 / SCREEN_W)));
  place(els.pause, x + cssW - ps - 4 - sr, safeTop + 3, ps, ps);

  els.app.classList.toggle('touch', touch);
  els.app.classList.toggle('portrait', portrait);

  // barra della home (MUSICA / OPZIONI) e riquadro "come si gioca": sotto i contenuti della
  // home (che occupano i primi 288 pixel logici), sopra il cielo stellato del campo
  const contentBottom = safeTop + SCREEN_H * k;
  const below = vh - sb - contentBottom;
  let compactHome = false;
  if (portrait && below >= BAR_H + 14) {
    const top = contentBottom + 8;
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
      place(els.bar, x + 8, safeTop + 258 * k, cssW - 16, Math.min(BAR_H, 26 * k));
      compactHome = true;
    }
    els.homeHelp.classList.add('no-space');
  }
  els.app.classList.toggle('compact-home', compactHome);
  return { scale, cssW, cssH, left: x, top: y, fieldH, insetTop, insetBottom, portrait, integer };
}
