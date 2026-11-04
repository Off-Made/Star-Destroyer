/** Impostazioni utente persistenti (localStorage). */
import { STORAGE_KEYS } from '../config';
import type { Storage } from '../game/game';

export interface Settings {
  /** Versione dello schema (per migrare impostazioni salvate da versioni precedenti). */
  v: number;
  dragMode: 'relative' | 'absolute';
  sensitivity: number;
  /** Musica (jingle) attiva. */
  music: boolean;
  /** Effetti sonori attivi. */
  sfx: boolean;
  vibrate: boolean;
  crt: boolean;
}

export const SETTINGS_VERSION = 2;

export const DEFAULT_SETTINGS: Settings = {
  v: SETTINGS_VERSION,
  dragMode: 'relative',
  sensitivity: 1, // 1:1 → la nave segue esattamente il dito
  music: true,
  sfx: true,
  vibrate: true,
  crt: false,
};

export function loadSettings(store: Storage): Settings {
  try {
    const raw = store.get(STORAGE_KEYS.settings);
    if (raw) {
      const s = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      delete (s as any).controls; // opzione rimossa (pulsanti ◀ ▶)
      delete (s as any).muted;    // sostituita da music / sfx
      delete (s as any).autofire; // col dito il fuoco è sempre automatico
      if (!(s.v >= 2)) { s.v = SETTINGS_VERSION; s.sensitivity = 1; s.dragMode = 'relative'; }
      return s;
    }
  } catch { /* JSON corrotto: si torna ai default */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(store: Storage, s: Settings) {
  store.set(STORAGE_KEYS.settings, JSON.stringify(s));
}
