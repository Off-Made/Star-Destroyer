/**
 * STAR DESTROYER – configurazione unica di bilanciamento.
 * Tutti i numeri "di gioco" vivono qui: nessun numero magico sparso nei moduli.
 * Unità: pixel logici (schermo 224×288) e frame logici (60 al secondo).
 */

export const GAME_TITLE = 'STAR DESTROYER';

// ── Schermo ────────────────────────────────────────────────────────────────
export const SCREEN_W = 224;
export const SCREEN_H = 288;
export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;
/** Massimo numero di tick recuperati in un singolo frame (evita la "spirale della morte"). */
export const MAX_CATCHUP_TICKS = 5;

// ── Layout HUD ─────────────────────────────────────────────────────────────
export const HUD_TOP_H = 16;
export const HUD_BOTTOM_Y = 272;
export const PLAYER_Y = 256;
export const PLAYER_MIN_X = 8;
export const PLAYER_MAX_X = SCREEN_W - 8;

// ── Giocatore ──────────────────────────────────────────────────────────────
export const START_LIVES = 3;
export const PLAYER_SPEED = 2; // px/frame
export const DUAL_OFFSET = 16; // distanza fra le due navi della nave doppia
export const PLAYER_BULLET_SPEED = 6;
export const MAX_PLAYER_BULLETS_SINGLE = 2;
export const MAX_PLAYER_BULLETS_DUAL = 4;
export const FIRE_COOLDOWN = 6; // frame minimi fra due spari
export const PLAYER_EXPLODE_FRAMES = 96;
export const RESPAWN_MIN_WAIT = 120;
export const READY_FRAMES = 100;
/** Accumulo massimo del drag relativo (px logici) per evitare "ritardi" del movimento. */
export const DRAG_MAX_PENDING = 48;

// ── Vite extra ─────────────────────────────────────────────────────────────
export const EXTRA_LIFE_FIRST = 20000;
export const EXTRA_LIFE_SECOND = 70000;
export const EXTRA_LIFE_EVERY = 70000;

// ── Punteggi ───────────────────────────────────────────────────────────────
export const SCORE = {
  mite: { formation: 50, diving: 100 },
  raider: { formation: 80, diving: 160 },
  warden: { formation: 150, diving: [400, 800, 1600] as const },
  rogue: 1000, // nave catturata diventata ostile, abbattuta
  captive: 0, // nave catturata colpita per errore mentre è trattenuta
  bonusPerKill: 100,
  bonusPerHit: 100, // bonus a fine stage bonus: colpi × 100
  bonusPerfect: 10000,
} as const;

// ── Formazione ─────────────────────────────────────────────────────────────
export const FORM_COLS = 10;
export const FORM_ROWS = 5;
export const FORM_CX = SCREEN_W / 2;
export const FORM_TOP = 44;
export const FORM_DX = 16;
export const FORM_DY = 16;
export const FORM_SWAY_AMP = 14;
export const FORM_SWAY_SPEED = 0.025; // rad/frame
export const FORM_BREATHE_AMP = 0.14; // espansione relativa
export const FORM_BREATHE_SPEED = 0.035;

// ── Nemici ─────────────────────────────────────────────────────────────────
export const ENTRY_SPEED = 2.2;
export const ENTRY_SPAWN_GAP = 7; // frame fra un nemico e il successivo di uno stesso flusso
export const WAVE_GAP = 24; // frame fra la fine di un'ondata e la successiva
export const HOME_TURN = (7 * Math.PI) / 180;
export const HOME_SNAP_DIST = 20;
export const PEEL_TURN = (6 * Math.PI) / 180;
export const PEEL_FRAMES = 30;
export const SEEK_TURN = (2 * Math.PI) / 180;
export const LOOP_TURN = (5 * Math.PI) / 180;
export const ENEMY_HIT_W = 6;
export const ENEMY_HIT_H = 7;
export const BODY_HIT = 10;
export const EXIT_Y = SCREEN_H + 12;
export const ENTER_Y = -16;

// ── Raggio traente ─────────────────────────────────────────────────────────
export const BEAM_STOP_Y = 168;
export const BEAM_OPEN_FRAMES = 50;
export const BEAM_HOLD_FRAMES = 140;
export const BEAM_CLOSE_FRAMES = 40;
export const BEAM_MAX_HALF_W = 24;
export const BEAM_CAPTURE_HALF_W = 14;
export const CAPTIVE_RISE_SPEED = 1;
export const CAPTIVE_OFFSET_Y = -16; // posizione "in coda" al comandante
export const RESCUE_SPIN_FRAMES = 64;
export const RESCUE_SPEED = 2;

// ── Proiettili nemici ──────────────────────────────────────────────────────
export const MAX_ENEMY_BULLETS = 10;
export const ENEMY_BULLET_MAX_VX = 1.4;
export const PLAYER_HIT_W = 5;
export const PLAYER_HIT_H = 6;

// ── Bonus stage ────────────────────────────────────────────────────────────
export const FIRST_BONUS_STAGE = 3;
export const BONUS_STAGE_EVERY = 4;
export const BONUS_ENEMIES = 40;

// ── Tempi di schermata ─────────────────────────────────────────────────────
export const T = {
  gameStart: 260,
  stageIntro: 110,
  stageClearDelay: 90,
  bonusResults: 300,
  gameOver: 200,
  results: 360,
  title: 600,
  demo: 1800,
  scorePopup: 70,
  captureMsg: 160,
};

/** Difficoltà in funzione del numero di stage "normali" già superati (k = 0, 1, 2…). */
export function difficulty(k: number) {
  return {
    diveInterval: Math.max(36, 150 - 9 * k),
    maxDivers: Math.min(2 + Math.floor(k / 2), 8),
    diveSpeed: Math.min(2.0 + 0.07 * k, 3.1),
    bulletSpeed: Math.min(2.6 + 0.06 * k, 3.6),
    bulletsPerDive: k < 1 ? 1 : k < 6 ? 2 : 3,
    entryFireChance: k < 1 ? 0 : Math.min(0.004 + 0.002 * k, 0.02),
    pairedEntry: k >= 2,
    wardenChance: Math.min(0.25 + 0.03 * k, 0.45),
    raiderLoopChance: Math.min(0.3 + 0.05 * k, 0.7),
  };
}

// ── Palette (16 colori, originale) ─────────────────────────────────────────
export const PALETTE: Record<string, string> = {
  W: '#ffffff',
  C: '#38e8ff',
  B: '#2f5bff',
  N: '#1b2a8a',
  R: '#ff2f45',
  O: '#ff9a1f',
  Y: '#ffe63a',
  G: '#e2b12c',
  M: '#ff45c8',
  P: '#8f3dff',
  V: '#c79bff',
  T: '#1fd9a8',
  L: '#8cff3c',
  S: '#a7a9c0',
  D: '#4a4c66',
  K: '#000000',
};

/** High score mostrato alla prima accensione. */
export const DEFAULT_HISCORE = 20000;

export const STORAGE_KEYS = {
  hiScore: 'sd.hiscore',
  settings: 'sd.settings',
  installHint: 'sd.installhint',
};
