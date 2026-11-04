/**
 * Suggerimento una tantum per installare il gioco sulla Home.
 * - iOS Safari non permette il fullscreen da browser → istruzioni "Aggiungi a Home".
 * - Android/Chrome → pulsante INSTALLA tramite l'evento beforeinstallprompt.
 */
import { STORAGE_KEYS } from '../config';
import type { Storage } from '../game/game';

let deferred: any = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });

const standalone = () =>
  matchMedia('(display-mode: standalone)').matches ||
  matchMedia('(display-mode: fullscreen)').matches ||
  (navigator as any).standalone === true;

export function setupInstallHint(store: Storage) {
  if (standalone() || store.get(STORAGE_KEYS.installHint)) return;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const mobile = ios || /Android/i.test(ua);
  if (!mobile) return;
  const box = document.getElementById('install')!;
  const text = document.getElementById('installText')!;
  const btn = document.getElementById('installBtn')!;
  text.textContent = ios
    ? 'Su iPhone/iPad: tocca il pulsante Condividi (□↑) e scegli "Aggiungi alla schermata Home". Il gioco si aprirà a schermo intero e funzionerà anche offline.'
    : 'Installa il gioco sulla schermata Home per giocare a schermo intero e anche offline.';
  const show = () => box.classList.remove('hidden');
  if (!ios) {
    if (deferred) btn.classList.remove('hidden');
    btn.addEventListener('click', async () => {
      if (!deferred) return;
      deferred.prompt();
      await deferred.userChoice.catch(() => {});
      deferred = null;
      box.classList.add('hidden');
    });
  }
  document.getElementById('installClose')!.addEventListener('click', () => box.classList.add('hidden'));
  store.set(STORAGE_KEYS.installHint, '1');
  setTimeout(show, 400);
}
