/**
 * Bootstrap: collega gioco, renderer, audio, input e UI del browser.
 */
import './style.css';
import { T } from './config';
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

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const localStore: Storage = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* modalità privata */ } },
};

const settings: Settings = loadSettings(localStore);
const audio = new AudioEngine();
audio.vibrate = settings.vibrate;
audio.setMuted(settings.muted);

const game = new Game(audio, new Rng((Date.now() & 0xffffff) | 1), localStore);
const canvas = $<HTMLCanvasElement>('screen');
const ctx = canvas.getContext('2d', { alpha: false })!;
const renderer = new Renderer(ctx, buildAtlas());

const els: LayoutEls = {
  app: $('app'), canvas, crt: $('crt'), pad: $('pad'), fire: $('fire'),
  btnL: $('btnL'), btnR: $('btnR'), bar: $('bar'), probe: $('probe'),
};

const isTouch = () => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
let touchUI = isTouch();
renderer.startLabel = touchUI ? 'TAP' : 'PUSH';

let paused = false;
const setPaused = (p: boolean) => {
  paused = p && game.mode !== 'title';
  renderer.paused = paused;
  $('bPause').classList.toggle('on', paused);
  if (paused) audio.beam(false);
};

const startGame = () => {
  audio.unlock();
  if (game.mode !== 'game' || game.phase === 'results') { touch.clearDrag(); game.startGame('game'); setPaused(false); requestWakeLock(); }
  else if (paused) setPaused(false);
};

const actions: HostActions = {
  start: startGame,
  pause: () => { if (game.mode !== 'title') setPaused(!paused); },
  mute: () => toggleMute(),
};

const keyboard = new Keyboard(actions);
const pads = new Gamepads(actions);
const touch = new TouchControls(els.pad, els.fire, els.btnL, els.btnR, settings, () => {});
touch.onAnyTouch = () => audio.resume();

function toggleMute() {
  settings.muted = !settings.muted;
  audio.setMuted(settings.muted);
  saveSettings(localStore, settings);
  syncButtons();
}
function syncButtons() {
  $('bMute').textContent = settings.muted ? '×' : '♪';
  $('bMute').classList.toggle('on', settings.muted);
  els.app.classList.toggle('crt', settings.crt);
}

// ── Layout ──
let lastLayoutKey = '';
function relayout(force = false) {
  const key = `${innerWidth}x${innerHeight}@${devicePixelRatio}:${touchUI}:${settings.controls}`;
  if (!force && key === lastLayoutKey) return;
  lastLayoutKey = key;
  const r = layout(els, touchUI, settings.controls === 'buttons');
  touch.cssPerPixel = r.cssW / 224;
  $('rotate').classList.toggle('hidden', !(touchUI && !r.portrait && r.cssH < 300));
}
addEventListener('resize', () => relayout());
addEventListener('orientationchange', () => setTimeout(() => relayout(true), 250));
window.visualViewport?.addEventListener('resize', () => relayout());
relayout(true);

// ── Pulsanti ──
const tapBtn = (id: string, fn: () => void) => {
  const el = $(id);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); fn(); });
};
tapBtn('bStart', startGame);
tapBtn('bPause', actions.pause);
tapBtn('bMute', toggleMute);
tapBtn('bSettings', () => openSettings());

// FIRE avvia la partita dal titolo/demo; un tocco sul canvas avvia o riprende
els.fire.addEventListener('pointerdown', () => { if (game.mode !== 'game' || game.phase === 'results') startGame(); else if (paused) setPaused(false); });
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (game.mode !== 'game') startGame();
  else if (paused) setPaused(false);
});

// ── Impostazioni ──
const sControls = $<HTMLSelectElement>('sControls');
const sDrag = $<HTMLSelectElement>('sDragMode');
const sSens = $<HTMLInputElement>('sSens');
const sAuto = $<HTMLInputElement>('sAuto');
const sVibe = $<HTMLInputElement>('sVibe');
const sCrt = $<HTMLInputElement>('sCrt');
function openSettings() {
  if (game.mode === 'game') setPaused(true);
  sControls.value = settings.controls; sDrag.value = settings.dragMode;
  sSens.value = String(settings.sensitivity); $('sSensV').textContent = settings.sensitivity.toFixed(1);
  sAuto.checked = settings.autofire; sVibe.checked = settings.vibrate; sCrt.checked = settings.crt;
  $('settings').classList.remove('hidden');
}
const readSettings = () => {
  settings.controls = sControls.value as Settings['controls'];
  settings.dragMode = sDrag.value as Settings['dragMode'];
  settings.sensitivity = Number(sSens.value);
  settings.autofire = sAuto.checked;
  settings.vibrate = sVibe.checked;
  settings.crt = sCrt.checked;
  $('sSensV').textContent = settings.sensitivity.toFixed(1);
  audio.vibrate = settings.vibrate;
  saveSettings(localStore, settings);
  syncButtons();
  relayout(true);
};
for (const el of [sControls, sDrag, sSens, sAuto, sVibe, sCrt]) el.addEventListener('input', readSettings);
$('sClose').addEventListener('click', () => $('settings').classList.add('hidden'));
syncButtons();

// ── TAP TO START (sblocca l'audio: obbligatorio su iOS) ──
const tap = $('tap');
tap.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  audio.unlock();
  tap.classList.add('hidden');
  requestWakeLock();
  setupInstallHint(localStore);
}, { once: true });

// ── Background / foreground ──
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (game.mode === 'game') setPaused(true);
    audio.suspend();
    releaseWakeLock();
  } else {
    audio.resume();
    requestWakeLock();
    loopObj.start();
  }
});
addEventListener('pageshow', () => audio.resume());
addEventListener('pointerdown', () => { if (!touchUI && isTouch() && navigator.maxTouchPoints > 0) { touchUI = true; renderer.startLabel = 'TAP'; relayout(true); } }, { passive: true });
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
    keyboard.apply(inp);
    pads.apply(inp);
    touch.apply(inp);
  }
  if (paused) { inp.drag = 0; inp.firePressed = false; return; }
  if (game.mode === 'title') {
    if (++titleT > T.title) { titleT = 0; game.startGame('demo'); }
  } else titleT = 0;
  game.step();
}
const loopObj = new FixedLoop(tick, () => renderer.render(game));
loopObj.start();

// ── Service worker (solo build di produzione, contesto sicuro) ──
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
  addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}

// ganci di diagnostica per i test end-to-end
(window as any).__sd = { game, loop: loopObj, settings };
