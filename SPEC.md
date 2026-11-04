# STAR DESTROYER – Specifica tecnica

Shooter arcade a formazione, verticale, mobile-first (PWA). Il **gameplay** riproduce le regole
del classico arcade del 1981 descritto nel brief. **Grafica, logo, musiche ed effetti sono originali.**

## 0. Materiale di riferimento (`immagini/`)

La cartella contiene 17 file scaricati dal web (screenshot e sprite sheet dell'arcade originale,
più immagini promozionali di terze parti, ad es. `kisspng-galaga-88-…jpg` e `il_570xN.*.webp`).
Questo materiale appartiene a terzi ed è protetto. Per questo, d'accordo con il committente:

- **non** viene ritagliato, convertito, incluso nel bundle né usato come modello da copiare;
- la cartella è esclusa da git (`.gitignore`) per non pubblicarla per sbaglio;
- l'aspetto del gioco è disegnato da zero (`src/art/`). Restano le convenzioni comuni a tutto il
  genere: sfondo nero, starfield, font bitmap, HUD con punteggio e high score.

| Elemento | Scelta originale | Dove |
|---|---|---|
| Logo | "STAR DESTROYER", pixel ×3 con gradiente giallo→viola e contorno blu | `render/atlas.ts › buildLogo` |
| Nave giocatore | freccia bianco/ciano con alette rosse | `art/sprites.ts › SHIP` |
| Nemico base (*Mite*) | disco a guscio verde acqua con antenne, 2 frame | `MITE` |
| Nemico medio (*Raider*) | cuneo magenta/arancio con ali a lama, 2 frame | `RAIDER` |
| Comandante (*Warden*) | corazza esagonale oro, nucleo rosso; colpito → viola | `WARDEN`, `RECOLOR.wardenHurt` |
| Nave catturata/ostile | stessa nave ricolorata in rosso/arancio | `RECOLOR.captive` |
| Esplosioni | particelle procedurali a seme fisso (piccole e grandi) | `buildAtlas` |
| Badge stage | bandierine 1/5, diamante 10, stella 20, chevron 30, corona 50 | `BADGES` |
| Palette | 16 colori propri | `config.ts › PALETTE` |
| Audio | jingle composti per il progetto, sintesi chip a 3 voci + rumore | `audio/` |

> **Divergenza dal brief, segnalata:** il brief chiedeva aspetto e suoni "identici al 100%"
> all'originale. Non si è fatto per motivi di diritto d'autore. Le regole sono invece replicate.

## 1. Specifiche verificabili (regole → test)

| # | Regola | Valore/condizione | Verifica |
|---|---|---|---|
| R1 | Risoluzione logica | 224×288 portrait, 60 tick/s fissi | `config.ts`, `core/loop.ts` |
| R1b | Movimento (scelta del committente, diverso dall'arcade) | la nave si muove **liberamente in 2D** (x 8–216, y 36–262) seguendo il dito 1:1 (max 12 px/frame); fuoco automatico finché il dito è appoggiato; contatto con qualsiasi nemico, anche in formazione, = collisione | test "controllo col dito" |
| R2 | Vite iniziali | 3 | `game.test.ts` "parte con 3 vite" |
| R3 | Vite extra | 20.000, 70.000, poi +70.000 (140k, 210k…), con suono | `scoring.test.ts`, `game.test.ts` |
| R4 | Colpi a schermo | max 2 (singola), 4 (doppia) | `game.test.ts` "massimo 2 colpi…" |
| R5 | Stage | 5 ondate × 8 = 40; 4 comandanti, 16 medi, 20 base; caselle uniche | `game.test.ts` "5 ondate × 8" |
| R6 | Formazione | 10×5; righe: 4 comandanti / 8+8 medi / 10+10 base; sway durante gli ingressi, poi respiro | `formation.ts`, test "tutti in formazione" |
| R7 | Ingressi | traiettorie curve con loop; lati alternati; a coppie dallo stage normale n.3; varianti S/giro dal 4° | `paths.ts`, `stage.ts`, test sui limiti dei percorsi |
| R8 | Tuffi | uscita a mezzo loop, inseguimento curvo, fuoco mirato, uscita dal fondo → rientro dall'alto | `game.ts › launchDive/seek/wrapToTop` |
| R9 | Scorta | il comandante porta fino a 2 medi della riga 1 adiacente | test "0/1/2 scorte" |
| R10 | Punteggi | base 50/100, medio 80/160, comandante 150 / 400·800·1600 | `scoring.test.ts`, `game.test.ts` |
| R11 | Popup punteggio | per il comandante abbattuto in tuffo e per la nave ostile | `killEnemy › spawnPopup` |
| R12 | Comandante 2 colpi | il 1° colpo cambia colore e non dà punti | test "due colpi" |
| R13 | Raggio traente | scende a y=168, si apre (50f), resta aperto (140f), si chiude (40f); cattura se \|dx\|<14 | test "la nave viene catturata…" |
| R14 | Cattura | rotazione e risalita, jingle, −1 vita, nave in coda al comandante | idem |
| R15 | Liberazione | comandante abbattuto **fuori** formazione → la nave ruota, scende, aggancia → doppia | test "nave doppia" |
| R16 | Nave catturata colpita | distrutta | test "colpire la nave catturata…" |
| R17 | Comandante abbattuto **in** formazione con la nave | la nave diventa ostile (1.000 pt) | `turnRogue` |
| R18 | Nave doppia colpita | si perde solo la nave colpita | test dedicato |
| R19 | Stage bonus | stage 3, 7, 11…; 40 nemici, niente fuoco, niente formazione; 100 pt a nemico; colpi×100 oppure PERFECT 10.000 | `scoring.test.ts`, test "PERFECT" |
| R20 | Risultati | colpi sparati, a segno, percentuale con 1 decimale | `hitRatio`, test |
| R21 | Difficoltà | `difficulty(k)`: intervallo tuffi, tuffatori max, velocità, proiettili per tuffo, fuoco in ingresso | `config.ts` |
| R22 | HUD | 1UP lampeggiante, HIGH SCORE, vite di riserva in basso a sinistra, badge 50/30/20/10/5/1 in basso a destra | `renderer.ts › hud`, test badge |
| R23 | Record | parte da **0** se non si è mai giocato; si aggiorna in tempo reale nell'HUD; salvato in localStorage `sd.hiscore` a fine partita (e se l'app va in background) | test "record iniziale 0", "nuovo record" |
| R23b | Messaggio nuovo record | dopo GAME OVER e risultati, se il punteggio supera il record valido a inizio partita: schermata "NUOVO RECORD!" con jingle, punteggio e record precedente; nessun messaggio altrimenti (o a 0 punti) | test dedicati |
| R23c | Home | all'avvio si vede la home (logo, valori nemici, vite extra, record, pulsante START, "come si gioca"); la partita parte **solo** con START (o Invio / Start del gamepad); niente demo automatica (`ATTRACT_DEMO = false`) | test "si parte dalla home", e2e |
| R24 | Morte | esplosione 96f, attesa che i tuffatori rientrino, READY, respawn al centro | `updatePlayer` |

### Punti in cui il brief è ambiguo (scelte documentate)
- **400/800/1600:** il valore dipende dal numero di scorte partite con il comandante (`escortsLaunched`), come scritto nel brief.
- **Nave ostile:** dopo un tuffo esce dal fondo e torna all'attacco. Non blocca la fine dello stage e se ne va quando lo stage finisce.
- **"CHALLENGING STAGE"** diventa "BONUS STAGE" e **"FIGHTER CAPTURED"** diventa "SHIP CAPTURED" (testi propri).

## 2. Architettura
```
src/config.ts          costanti di bilanciamento, punteggi, tempi, palette
src/core/loop.ts       rAF + accumulatore a 60 Hz; PRNG deterministico
src/game/              logica pura (nessun DOM): game, scoring, formation, stage, paths, ai-demo
src/render/            atlas (sprite pre-ruotati 32 direzioni), renderer, layout/scaling
src/art/               pixel art e font originali
src/audio/             sintetizzatore Web Audio + jingle
src/input/             tastiera, gamepad, touch (Pointer Events multitouch)
src/ui/                impostazioni, suggerimento di installazione
vite.config.ts         plugin che genera il service worker con il precache della build
```

## 3. Checklist finale

| Requisito | Stato | Note |
|---|---|---|
| Schermata fissa verticale | ✅ | la nave si muove in tutto il campo su richiesta del committente (R1b) |
| 3 vite, extra a 20k/70k/+70k con suono | ✅ | test |
| 2 colpi a schermo (4 in doppia) | ✅ | test |
| 40 nemici, 5 gruppi da 8, ingressi curvi con varianti | ✅ | test |
| Formazione che oscilla/respira | ✅ | |
| Tuffi con curve, fuoco, rientro dall'alto; scorte | ✅ | |
| Comandante a 2 colpi con cambio colore | ✅ | test |
| Raggio traente, cattura, liberazione, nave doppia | ✅ | test |
| Nave catturata colpita = distrutta | ✅ | test |
| Punteggi esatti + popup | ✅ | test |
| Stage bonus 3, 7, 11…, NUMBER OF HITS, PERFECT 10.000 | ✅ | test + screenshot |
| Risultati: colpi, a segno, percentuale | ✅ | screenshot |
| Difficoltà crescente | ✅ | `difficulty(k)` |
| HUD 1UP/HIGH SCORE/vite/badge | ✅ | screenshot |
| Messaggi STAGE n / READY / GAME OVER / PERFECT ! / PLAYER 1 | ✅ | |
| Home: START obbligatorio, valori nemici, record, istruzioni | ✅ | la demo automatica è disattivata su richiesta (riattivabile con `ATTRACT_DEMO`) |
| Record a 0 al primo avvio + messaggio "NUOVO RECORD!" | ✅ | test |
| High score in localStorage | ✅ | test |
| Esplosione e respawn dopo READY | ✅ | |
| Canvas a schermo pieno sui telefoni: larghezza logica 224, altezza allungata (fino a 560) sulle proporzioni dello schermo, anche sotto notch/barra Home; HUD, formazione e nave nella zona sicura. Tablet/PC: 224×288 a scala intera | ✅ | e2e "nessuna fascia nera" + "notch"; scelta del committente |
| CRT opzionale (disattivo di default) | ✅ | |
| Audio sintetizzato: sparo, esplosioni per tipo, morte, raggio, cattura, liberazione, vita extra, bonus, perfect, game over, high score, avvio | ✅ | jingle originali |
| AudioContext sbloccato al tocco, ripresa dal background, interruttore silenzioso iOS, mute | ✅ | da provare su un iPhone reale |
| Viewport cover, dvh, safe-area, niente scroll/zoom/selezione/menu | ✅ | e2e |
| Da telefono nessun controller: tocca ovunque e trascina, la nave segue il dito e spara da sola | ✅ | e2e simula il dito e verifica l'assenza di pulsanti |
| In partita solo il tastino pausa → menu retrò HOME / MUSICA ON-OFF / RIPRENDI; opzioni dalla home | ✅ | e2e "menu di pausa" |
| Interfaccia in stile retrò (pixel font del gioco, cornici a gradini) | ✅ | `ui/pixel.ts` |
| Vibrazione (Android) | ✅ | |
| Timestep fisso, nessuna allocazione nel loop caldo, atlas | ✅ | lavoro CPU 0,2–0,8 ms/frame in emulazione |
| visibilitychange → pausa; Wake Lock | ✅ | Wake Lock solo in HTTPS |
| PWA: manifest, icone, service worker offline | ✅ | SW attivo solo in HTTPS |
| Audio sbloccato dal pulsante START + suggerimento una tantum "Aggiungi a Home" | ✅ | |
| Tastiera (frecce/A-D, spazio, P, M, Invio) e gamepad | ✅ | |
| Dev server su 0.0.0.0 + URL LAN + QR | ✅ | `npm run dev` |
| Test Vitest + Playwright su 7 profili dispositivo | ✅ | 35 + 23 test verdi |
| Confronto visivo con `immagini/` | ❌ (voluto) | aspetto originale per scelta; vedi §0 |
| Aspetto e musiche identici all'originale | ❌ (voluto) | non realizzabile per diritto d'autore |
