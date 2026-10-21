# MARANZA FIGHT 3 — Audit dell'espansione

Data: 20 ottobre 2026. Baseline misurata sul repository corrente, non dedotta dal README.

## 1. Stato reale del gioco

| Elemento | Stato verificato |
| --- | --- |
| Rendering | Three.js WebGL 2, scena 3D reale, 60 FPS su desktop Apple Silicon |
| Fisica | Rapier WASM, character controller, collider statici, raycast camera |
| Campagna | 5 livelli notturni: Stazione, Metro, Navigli, Bosco Verticale, Duomo |
| Boss | 1 (Re del Borsello) nella quinta arena |
| Nemici | 3 archetipi: base, turbo, puffer |
| Combattimento | catena pugno/gancio/calcio, calcio diretto, schivata, schivata perfetta, speciale |
| Progressione | punteggio, stelle per livello, sblocco sequenziale, record per livello |
| Modalità | solo campagna |
| Input | touch multitouch, tastiera/mouse, gamepad |
| Salvataggi | localStorage v2, array posizionali `levelScores`/`levelStars` |
| PWA | service worker v3, 15 risorse in cache, avvio offline verificato |
| Build | `dist/` statica, pronta per Cloudflare Pages |

### Comandi eseguiti (esiti reali)

- `npx tsc --noEmit` → 0 errori.
- `npm test` → 8 file, 44 test passati.
- `npx playwright test` → 20 test, 18 passati, 2 saltati (solo desktop).
- `npm run build` → build pulita; bundle principale 190 kB, three 498 kB, Rapier 2.2 MB (830 kB gzip).
- `node scripts/pwa-check.mjs` → service worker attivo, 15 voci in cache, riavvio offline con Rapier pronto, 0 errori.
- `node scripts/capture-previews.mjs` → 5 anteprime 1200×675 generate dalle arene reali.

### Condizioni di misura

- Desktop: macOS, Apple Silicon, Chromium 1440×860, qualità alta.
- Mobile: emulazione Chromium `Pixel 7`, viewport 915×412, DPR 2. Non è hardware reale.
- Draw call misurate: 269 (Navigli, 3 nemici), 326–418 (Tetti/Bosco, ondate attive).
- Nessuna misura FPS su iPhone/Android fisici.

## 2. Difetti trovati e corretti in questa fase

1. **Tap persi su frame lente.** Il buffer input scadeva a tempo reale (260 ms): con frame SwiftShader lente un tocco poteva svanire prima della fixed update. Ora il buffer scade in tempo di gioco (0,34 s simulate) e il tocco viene consumato al primo step. Riprodotto dal test e2e mobile, corretto, test verde.
2. **Camera dietro i lampioni** (sessione precedente): spawn/props spostati e lift della camera.
3. **Suggerimenti desktop su touch** (sessione precedente): testi sostituiti.
4. **PWA non offline** (sessione precedente): il service worker legge gli asset hash da `index.html`.

Nessun errore console bloccante: resta solo il warning di deprecazione della init di Rapier.

## 3. Limiti attuali rispetto all'espansione richiesta

- Livelli: 5, non 9. Mancano Porta Venezia, Parco Sempione, Isola, Darsena e un finale Tetti distinto.
- Boss: 1, non 5. Mancano Buttafuori, Personal Trainer, DJ, Consiglio del Borsello.
- Nemici: 3, non 6. Mancano Guardiano, Lanciatore, Coordinatore.
- Obiettivi di livello (punti da attivare, difesa zona, carichi, distruggibili) non esistono.
- Difficoltà multiple, cosmetici, Sopravvivenza e Boss Rush non esistono.
- Salvataggi: schema posizionale v2, da migrare a ID stabili.

## 4. Formato salvataggi da preservare

Chiave: `maranza-fight-3:save`.

v2: `{ version, bestScore, unlockedLevel, levelScores[5], levelStars[5], completed, settings, updatedAt }`.
La posizione 4 era il Bosco Verticale, la 5 il Duomo. La migrazione deve rimappare per nome, non per indice.

## 5. Vincoli rispettati

- Solo asset procedurali locali (geometrie, Canvas, Web Audio). Nessun asset generato da AI, nessuna API.
- Nessun backend, nessuna credenziale, nessuna pubblicazione.
- Build statica e PWA.
