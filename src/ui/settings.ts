/** Impostazioni utente persistenti (localStorage). */
import { STORAGE_KEYS } from '../config';
import type { Storage } from '../game/game';

export interface Settings {
  controls: 'drag' | 'buttons';
  dragMode: 'relative' | 'absolute';
  sensitivity: number;
  autofire: boolean;
  vibrate: boolean;
  crt: boolean;
  muted: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  controls: 'drag',
  dragMode: 'relative',
  sensitivity: 1.5,
  autofire: true,
  vibrate: true,
  crt: false,
  muted: false,
};

export function loadSettings(store: Storage): Settings {
  try {
    const raw = store.get(STORAGE_KEYS.settings);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* JSON corrotto: si torna ai default */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(store: Storage, s: Settings) {
  store.set(STORAGE_KEYS.settings, JSON.stringify(s));
}
