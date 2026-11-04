/**
 * Bootstrap: collega gioco, renderer, audio, input e UI del browser.
 */
import './style.css';
import { T, ATTRACT_DEMO } from './config';
import { Game, Storage } from './game/game';
import { demoInput } from './game/ai-demo';
import { FixedLoop, Rng } from './core/loop';
import { buildAtlas } from './render/atlas';
import { Renderer } from './render/renderer';
import { layout, LayoutEls } from './render/screen';
import { AudioEngine } from './audio/synth';
import { Keyboard, Gamepads, HostActions } from './input/keys';
import { TouchControls } from './input/touch';
import { loadSettings, saveSettings, Settings } from './ui/settings';
import { setupInstallHint } from './ui/install';
import { setPixelLabel, pauseIcon, fireButton } from './ui/pixel';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const localStore: Storage = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* modalità privata */ } },
};

const settings: Settings = loadSettings(localStore);
const audio = new AudioEngine();
audio.vibrate = settings.vibrate;
audio.setMusic(settings.music);
audio.setSfx(settings.sfx);

const game = new Game(audio, new Rng((Date.now() & 0xffffff) | 1), localStore);
const canvas = $<HTMLCanvasElement>('screen');
const ctx = canvas.getContext('2d', { alpha: false })!;
const renderer = new Renderer(ctx, buildAtlas());

const els: LayoutEls = {
  app: $('app'), canvas, crt: $('crt'), pad: $('pad'), fire: $('fire'),
  bar: $('bar'), pause: $('bPause'), probe: $('probe'), homeStart: $('homeStart'), homeHelp: $('homeHelp'),
};

// ── Grafica retrò dei controlli (generata una volta dai glifi del gioco) ──
for (const el of document.querySelectorAll<HTMLElement>('[data-px]')) setPixelLabel(el, el.dataset.px!, el.dataset.col ?? 'Y');
setPixelLabel($('padLabel'), 'TRASCINA QUI', 'C');
setPixelLabel($('bSettings'), 'OPZIONI', 'C');
setPixelLabel($('mHome'), 'HOME', 'M');
setPixelLabel($('mResume'), 'RIPRENDI', 'Y');
$('bPause').replaceChildren(pauseIcon());
{
  const up = fireButton(false), down = fireButton(true);
  up.classList.add('up'); down.classList.add('down');
  els.fire.replaceChildren(up, down);
}

const isTouch = () => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
let touchUI = isTouch();
renderer.startLabel = touchUI ? 'TAP' : 'PUSH';

const keyboardActions: HostActions = {
  start: () => startGame(),
  pause: () => { if (game.mode === 'game') setPaused(!paused); },
  mute: () => toggleMusic(),
};
const keyboard = new Keyboard(keyboardActions);
const pads = new Gamepads(keyboardActions);
const touch = new TouchControls(els.pad, els.fire, settings, () => {});
touch.onAnyTouch = () => audio.resume();

// ── Pausa e menu di pausa ──
let paused = false;
const pauseMenu = $('pauseMenu');
function setPaused(p: boolean) {
  paused = p && game.mode === 'game';
  renderer.paused = paused;
  pauseMenu.classList.toggle('hidden', !paused);
  if (paused) { audio.beam(false); touch.reset(); }
}

/** Avvia la partita: SOLO dalla home (START). In partita riprende dalla pausa. */
function startGame() {
  audio.unlock(); // dentro il gesto dell'utente: sblocca l'audio (iOS)
  if (game.mode !== 'game') {
    touch.clearDrag();
    game.startGame('game');
    setPaused(false);
    syncHome(); // mostra subito i controlli di gioco
    requestWakeLock();
  } else if (paused) setPaused(false);
}

/** Torna alla home abbandonando la partita. */
function goHome() {
  game.saveRecord(); // un record fatto prima di abbandonare non va perso
  setPaused(false);
  game.toTitle();
  syncHome();
}

function toggleMusic() {
  settings.music = !settings.music;
  audio.setMusic(settings.music);
  saveSettings(localStore, settings);
  syncButtons();
}
function syncButtons() {
  const label = settings.music ? 'MUSICA ON' : 'MUSICA OFF';
  const col = settings.music ? 'L' : 'S';
  setPixelLabel($('mMusic'), label, col);
  setPixelLabel($('bMusic'), label, col);
  els.app.classList.toggle('crt', settings.crt);
}

// ── Layout ──
let lastLayoutKey = '';
function relayout(force = false) {
  const home = game.mode === 'title';
  const key = `${innerWidth}x${innerHeight}@${devicePixelRatio}:${touchUI}:${home}`;
  if (!force && key === lastLayoutKey) return;
  lastLayoutKey = key;
  const r = layout(els, touchUI, home);
  touch.cssPerPixel = r.cssW / 224;
  $('rotate').classList.toggle('hidden', !(touchUI && !r.portrait && r.cssH < 300));
}
addEventListener('resize', () => relayout());
addEventListener('orientationchange', () => setTimeout(() => relayout(true), 250));
window.visualViewport?.addEventListener('resize', () => relayout());

// ── Pulsanti ──
const tapBtn = (id: string, fn: () => void) => {
  $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audio.unlock(); fn(); });
};
tapBtn('homeStart', startGame);
tapBtn('bPause', () => setPaused(true));
tapBtn('bMusic', toggleMusic);
tapBtn('bSettings', () => openSettings());
tapBtn('mHome', goHome);
tapBtn('mMusic', toggleMusic);
tapBtn('mResume', () => setPaused(false));

// ── Opzioni (dalla home) ──
const sDrag = $<HTMLSelectElement>('sDragMode');
const sSens = $<HTMLInputElement>('sSens');
const sAuto = $<HTMLInputElement>('sAuto');
const sSfx = $<HTMLInputElement>('sSfx');
const sVibe = $<HTMLInputElement>('sVibe');
const sCrt = $<HTMLInputElement>('sCrt');
function openSettings() {
  sDrag.value = settings.dragMode;
  sSens.value = String(settings.sensitivity); $('sSensV').textContent = settings.sensitivity.toFixed(1);
  sAuto.checked = settings.autofire; sSfx.checked = settings.sfx; sVibe.checked = settings.vibrate; sCrt.checked = settings.crt;
  $('settings').classList.remove('hidden');
}
const readSettings = () => {
  settings.dragMode = sDrag.value as Settings['dragMode'];
  settings.sensitivity = Number(sSens.value);
  settings.autofire = sAuto.checked;
  settings.sfx = sSfx.checked;
  settings.vibrate = sVibe.checked;
  settings.crt = sCrt.checked;
  $('sSensV').textContent = settings.sensitivity.toFixed(1);
  audio.vibrate = settings.vibrate;
  audio.setSfx(settings.sfx);
  saveSettings(localStore, settings);
  syncButtons();
};
for (const el of [sDrag, sSens, sAuto, sSfx, sVibe, sCrt]) el.addEventListener('input', readSettings);
tapBtn('sClose', () => $('settings').classList.add('hidden'));
syncButtons();

// ── Home ──
setTimeout(() => setupInstallHint(localStore), 800);
let homeShown: boolean | null = null;
function syncHome() {
  const home = game.mode === 'title';
  if (home === homeShown) return;
  homeShown = home;
  els.app.classList.toggle('home', home);
  if (home) setPaused(false);
  relayout(true);
}
syncHome();

// ── Background / foreground ──
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (game.mode === 'game') setPaused(true); // al ritorno si trova il menu di pausa
    game.saveRecord();
    audio.suspend();
    releaseWakeLock();
  } else {
    audio.resume();
    requestWakeLock();
    loopObj.start();
  }
});
addEventListener('pageshow', () => audio.resume());
addEventListener('pointerdown', () => {
  if (!touchUI && isTouch() && navigator.maxTouchPoints > 0) { touchUI = true; renderer.startLabel = 'TAP'; relayout(true); }
}, { passive: true });
addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// ── Wake Lock ──
let wakeLock: { release(): Promise<void> } | null = null;
async function requestWakeLock() {
  try {
    const wl = (navigator as any).wakeLock;
    if (wl && !wakeLock && document.visibilityState === 'visible') {
      wakeLock = await wl.request('screen');
      (wakeLock as any).addEventListener?.('release', () => { wakeLock = null; });
    }
  } catch { wakeLock = null; }
}
function releaseWakeLock() { wakeLock?.release().catch(() => {}); wakeLock = null; }

// ── Loop ──
let titleT = 0;
function tick() {
  relayout();
  const inp = game.input;
  // l'input viene ricostruito a ogni tick (OR di tutti i dispositivi)
  inp.left = inp.right = inp.fire = false;
  inp.absX = NaN;
  inp.autofire = settings.autofire;
  if (game.mode === 'demo') {
    demoInput(game);
    inp.drag = 0;
    inp.firePressed = false;
  } else {
    keyboard.apply(inp); // frecce / A-D: solo tastiera da PC
    pads.apply(inp);
    touch.apply(inp);    // da telefono: solo trascinamento + FIRE
  }
  if (paused) { inp.drag = 0; inp.firePressed = false; return; }
  if (game.mode === 'title' && ATTRACT_DEMO) {
    if (++titleT > T.title) { titleT = 0; game.startGame('demo'); }
  } else titleT = 0;
  game.step();
  syncHome();
}
const loopObj = new FixedLoop(tick, () => renderer.render(game));
loopObj.start();

// ── Service worker (solo build di produzione, contesto sicuro) ──
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
  addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}

// ganci di diagnostica per i test end-to-end
(window as any).__sd = {
  game, loop: loopObj, settings, audio,
  isPaused: () => paused,
  /** Benchmark: n tick + render eseguiti di fila, ritorna i ms medi per frame. */
  bench(n = 600) {
    const t0 = performance.now();
    for (let i = 0; i < n; i++) { game.step(); renderer.render(game); }
    return (performance.now() - t0) / n;
  },
};
