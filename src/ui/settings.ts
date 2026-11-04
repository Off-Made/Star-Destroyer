/** Impostazioni utente persistenti (localStorage). */
import { STORAGE_KEYS } from '../config';
import type { Storage } from '../game/game';

export interface Settings {
  dragMode: 'relative' | 'absolute';
  sensitivity: number;
  autofire: boolean;
  /** Musica (jingle) attiva. */
  music: boolean;
  /** Effetti sonori attivi. */
  sfx: boolean;
  vibrate: boolean;
  crt: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  dragMode: 'relative',
  sensitivity: 1.5,
  autofire: true,
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
      return s;
    }
  } catch { /* JSON corrotto: si torna ai default */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(store: Storage, s: Settings) {
  store.set(STORAGE_KEYS.settings, JSON.stringify(s));
}
