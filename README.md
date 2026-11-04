# STAR DESTROYER

Shooter arcade a formazione in stile anni '80, pensato per telefono (iPhone/Android) e giocabile anche da PC.
HTML5 Canvas + TypeScript + Vite, nessuna libreria di gioco. Grafica e audio originali.

## Installazione e avvio
```bash
npm install
npm run dev        # dev server su 0.0.0.0:5173: stampa l'URL di rete locale e un QR code
```
- **Da PC:** apri `http://localhost:5173/`.
- **Da telefono:** collegalo alla stessa rete Wi-Fi del PC e scansiona il QR stampato nel terminale (oppure apri `http://<IP-del-PC>:5173/`).
  Se non si apre, consenti a Node.js nel firewall di Windows (reti private).

> In HTTP sulla rete locale funzionano gioco, audio e touch. Service worker (offline) e Wake Lock richiedono HTTPS:
> provali dalla versione pubblicata (vedi sotto).

```bash
npm run build      # typecheck + build di produzione in dist/ (con service worker)
npm run preview    # serve dist/ su 0.0.0.0:4173
npm test           # test di logica (Vitest)
npm run e2e        # test su dispositivi emulati (Playwright; serve prima `npm run build`)
npm run icons      # rigenera le icone PWA
```

## Comandi
| | Touch | Tastiera | Gamepad |
|---|---|---|---|
| Muovi | trascina nel riquadro TRASCINA (o pulsanti ◀ ▶) | ← → / A D | stick / d-pad |
| Spara | FIRE (tenendo premuto = auto-fire) | Spazio / Z / X | A / B |
| Start (solo dalla home) | pulsante START | Invio | Start |
| Pausa | II | P / Esc | Select |
| Audio | ♪ | M | |

In ⚙ trovi: controlli a trascinamento o a pulsanti, trascinamento relativo o assoluto, sensibilità, auto-fire, vibrazione ed effetto CRT.

## Installare come app (PWA)
- **iPhone/iPad (Safari):** Condividi → *Aggiungi alla schermata Home*. Si apre a schermo intero e funziona offline.
- **Android (Chrome):** menu ⋮ → *Installa app* (oppure il pulsante INSTALLA del suggerimento).

## Pubblicare gratis
Il build usa percorsi relativi (`base: './'`), quindi funziona in qualsiasi sottocartella.
- **Netlify:** `npm run build` e trascina la cartella `dist/` su <https://app.netlify.com/drop>.
- **GitHub Pages:** `npm run build`, poi pubblica `dist/` sul branch `gh-pages`
  (ad es. `npx gh-pages -d dist`) e attiva Pages su quel branch.

## Struttura
Vedi [SPEC.md](SPEC.md): regole verificabili, architettura e checklist.
Le costanti di bilanciamento sono tutte in `src/config.ts`.

## Note
- Il nome "Star Destroyer" è anche un termine di Star Wars: prima di pubblicare valuta un nome diverso
  (si cambia in `src/config.ts › GAME_TITLE`, `index.html`, `public/manifest.webmanifest` e nel logo `render/atlas.ts`).
- La cartella `immagini/` (materiale di terzi) è esclusa da git e non viene usata dal gioco.
