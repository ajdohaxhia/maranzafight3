# MARANZA FIGHT 3

Beat 'em up arcade 3D, mobile-first, giocabile da browser. Milano caricaturale, **nove livelli in tre
capitoli**, quattro archetipi di "maranza" e due scontri con il boss: **Il Re del Borsello** al Duomo
e **Il Re dei Tetti** sul finale.

Tutto gira lato client: rendering Three.js su WebGL, fisica Rapier 3D compilata in WebAssembly,
audio sintetizzato con la Web Audio API. Nessun backend, nessuna API key, nessun servizio a pagamento.

---

## Stack

| Ambito | Tecnologia |
| --- | --- |
| Rendering | Three.js (WebGL 2) |
| Fisica | `@dimforge/rapier3d-compat` (Rapier 3D in WASM, character controller) |
| Linguaggio | TypeScript strict |
| Build | Vite |
| UI | HTML + CSS + TypeScript, nessun framework |
| Audio | Web Audio API (effetti e musica sintetizzati in runtime) |
| PWA | Web App Manifest + Service Worker |
| Test | Vitest (logica) + Playwright (browser, desktop e mobile) |
| Hosting | Cloudflare Pages (build statica) |

---

## Comandi

```bash
npm install         # dipendenze
npm run dev         # server di sviluppo su http://localhost:5173
npm run build       # typecheck + build di produzione in dist/
npm run preview     # anteprima della build (porta 4173)
npm test            # test di logica (Vitest)
npm run test:e2e    # test end-to-end (Playwright; esegue build + preview)
npm run icons       # rigenera le icone PWA in public/icons
node scripts/mobile-shots.mjs      # screenshot mobile (gioco su http://127.0.0.1:5173)
node scripts/capture-previews.mjs  # rigenera le anteprime dei livelli in public/previews
node scripts/pwa-check.mjs         # verifica service worker e avvio offline della build
```

Requisiti: Node 20+ e un browser con WebGL 2. Rapier viene inizializzato in modo asincrono
all'avvio: se il WASM non parte, il gioco mostra la schermata di errore invece di restare bloccato.

---

## Controlli

### Touch (piattaforma principale)

- **Stick virtuale** in basso a sinistra: movimento analogico proporzionale, zona morta regolabile.
- **PUGNO** / **CALCIO** in basso a destra, **SCHIVA** e **SPECIALE** sopra: multitouch reale,
  puoi muoverti, ruotare la camera e attaccare contemporaneamente.
- **Trascina** sulla zona libera per ruotare la camera.
- Il gioco è progettato per il landscape; in verticale compare l'invito a ruotare il telefono
  (con opzione "apri comunque").

### Desktop

| Azione | Tasto |
| --- | --- |
| Movimento | `WASD` / frecce |
| Corsa | `Shift` |
| Camera | mouse (pointer lock) o trascinamento |
| Pugno | click sinistro |
| Calcio | click destro |
| Schivata | `Spazio` |
| Speciale | `Q` |
| Interazione / raccogli | `E` |
| Pausa | `Esc` / `P` |

Gamepad (Gamepad API) supportato come opzione secondaria: stick sinistro per muoversi,
stick destro per la camera, A pugno, X calcio, B schivata, Y speciale, Start pausa.

---

## Il gioco

- **Combattimento**: pugno leggero → gancio → calcio, con input buffer, combo, moltiplicatore,
  hitstop, flash, particelle, knockback, camera shake. Schivata con finestra di invulnerabilità
  e "schivata perfetta"; attacco speciale ad area con barra energia.
- **Hit detection**: hurtbox a capsula per personaggio, cono direzionale per gli attacchi,
  un solo colpo per bersaglio per frame attivo, danni solo ai bersagli realmente colpiti.
- **IA**: state machine (idle, patrol, alert, chase, positioning, attack, recover, hurt, stunned,
  defeated) con token di attacco per non accalcare il giocatore, telegraph a terra, schivate
  e attacchi ad area per il boss.
- **Nemici**: Maranza Base, Puffer, Turbo, più il boss con tre fasi e attacchi annunciati.
- **Livelli**: nove arene notturne in tre capitoli, ognuna con identità visiva e sonora propria.
  - **Capitolo I — Centro**
    1. **Stazione Centrale** — banchina, tram giallo, panini.
    2. **Metro Milano** — banchina della linea gialla, treno fermo, luci al neon.
    3. **Navigli Nightlife** — canale con acqua animata, barche ormeggiate, spritz e insegne al neon.
  - **Capitolo II — Piazze**
    4. **Duomo Showdown** — piazza, palco e il Re del Borsello (boss di metà campagna).
    5. **Porta Venezia** — corso, portici, edicola e strisce pedonali.
    6. **Parco Sempione** — prato, alberi, campo da basket e il Castello sullo sfondo.
  - **Capitolo III — Quartieri**
    7. **Isola** — cantiere delle torri: container, ponteggi, gru.
    8. **Darsena** — mercato sul naviglio, faro, banchine e acqua animata.
    9. **Tetti di Milano** — rooftop del Bosco Verticale, eliporto e il Re dei Tetti (finale).
- **Selezione livelli**: schermata dedicata con nove anteprime 16:9 generate dalle vere arene,
  capitolo di appartenenza, record per livello, stelle (ottenute da salute residua e tempo),
  livelli bloccati finché non si completa il precedente e avanzamento della campagna.
  Si può partire da qualsiasi piazza sbloccata.
- **Progressione**: ondate, punteggio (colpi, combo, KO, schivate perfette, ondate, hp residui),
  salute, game over/riavvio, salvataggi in `localStorage` con gestione degli errori. Lo schema v3
  salva i progressi per **id stabile del livello** (non per posizione) e migra i salvataggi
  posizionali v1/v2, rimappando il vecchio rooftop su *Tetti di Milano* e il vecchio finale sul Duomo.
- **Juicing**: hitstop (più lungo sui colpi pesanti), slow motion su schivata perfetta e KO del boss,
  zoom punch della camera (FOV kick), camera shake, lampi additivi sull'impatto, scintille, onde
  d'urto, flash a schermo su danno/speciale/fasi del boss.
- **Presentazione**: menu, selezione livelli, come giocare, impostazioni (qualità bassa/media/alta, volumi,
  sensibilità, inversione Y, camera shake, zona morta), pausa, livelli completati, vittoria,
  game over, schermata di rotazione e schermata di errore WebGL.

### Qualità e performance

Tre profili grafici (bassa, media, alta) che cambiano pixel ratio, risoluzione interna, ombre e
densità particellare. La fisica gira a timestep fisso a 60 Hz con accumulatore e limite di catch-up,
il rendering interpola le posizioni, la simulazione si ferma quando la pagina non è visibile e
le risorse vengono rilasciate alla chiusura del livello.

---

## Struttura

```text
src/
├── main.ts                 bootstrap, WebGL check, caricamento WASM, PWA
├── core/                   Game, Renderer, Physics, GameLoop, CameraRig
├── entities/               Fighter, Player, Enemy, Boss, Pickup
├── combat/                 CombatSystem, HitDetection, ComboSystem, tipi e specifiche attacco
├── ai/                     StateMachine, AttackDirector (token di attacco)
├── world/                  LevelManager (9 livelli, 3 capitoli), Arena, Environment (props/luci/animazioni)
├── graphics/               CharacterFactory (modelli procedurali), AnimationSystem, Effects
├── controls/               InputManager, KeyboardInput, TouchControls, GamepadInput
├── ui/                     HUD, UI (menu, schermate, impostazioni)
├── audio/                  AudioManager (sintesi SFX + musica procedurale)
├── systems/                WaveManager, SaveManager (v3 + migrazione), levelIds, SettingsManager
└── styles/main.css
public/
├── previews/               anteprime 16:9 delle arene (renderizzate dalle vere scene)
├── icons/, manifest.webmanifest, sw.js, _headers
scripts/
├── capture-previews.mjs    render headless delle arene per la selezione livelli
├── mobile-shots.mjs, pwa-check.mjs, gen-icons.mjs
```

---

## Test

```bash
npm test          # 48 test di logica: hit detection, combo, salvataggi e migrazione, catalogo livelli, ondate, state machine, animazioni, director
npm run test:e2e  # 20 test browser reali (desktop + mobile emulato): 18 eseguiti, 2 saltati su mobile
```

I test Playwright coprono: boot con WebGL e Rapier attivi, avvio partita, movimento da tastiera,
rotazione camera col mouse, pugni con danno/punteggio, pausa e ripresa, game over e riprova,
boss attivo con barra dedicata al Duomo, selezione livelli (nove schede in tre capitoli, blocchi,
avvio della piazza scelta), schermata di rotazione in portrait, joystick touch e pulsanti con
drag camera multitouch. I due test desktop (tastiera e click del mouse) sono saltati in emulazione
mobile perché lì i comandi sono touch.

I test e2e girano sulla build di produzione servita da `vite preview` (porta 4173), non sul dev server.
Gli hook `window.__MARANZA__` (snapshot, spawn, teleport, clearWave, jumpToLevel, hurtPlayer,
captureLevel) servono solo ai test e agli strumenti offline, e non espongono altro stato.
Le anteprime dei livelli si rigenerano con `node scripts/capture-previews.mjs`: lo script avvia
un dev server temporaneo, apre `/?capture=N`, attende il render dell'arena e salva il canvas in
`public/previews/level-N.jpg` (1200×675, Chromium headless con SwiftShader).

### Limiti dichiarati

- Nessun test su iPhone/Android fisici: i controlli touch sono verificati con l'emulazione mobile di
  Chromium (Playwright), che copre Pointer Events e multitouch ma non prestazioni o gesture reali.
- I test sono eseguiti su Chromium; Safari/WebKit headless non è incluso nella suite.
- FPS misurati solo sulla macchina di sviluppo (desktop Apple Silicon, Chromium): l'obiettivo di
  30 FPS stabili su smartphone di fascia media non è stato verificato su hardware reale.
- Il service worker non è attivo durante i test Playwright (`serviceWorkers: 'block'`).
- Solo Duomo e Tetti hanno uno scontro con il boss: i boss dedicati agli altri capitoli
  (Buttafuori, Trainer, DJ) sono lavoro futuro, non promesse già rispettate.

---

## Pubblicazione su Cloudflare Pages

1. `npm install && npm run build`
2. Carica il repository su GitHub/GitLab e collega il progetto a Cloudflare Pages, oppure pubblica
   direttamente la cartella `dist/`:

```bash
npx wrangler pages deploy dist --project-name maranza-fight-3
```

Configurazione Pages:

| Impostazione | Valore |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | 20 |

Non servono variabili d'ambiente, segreti, database o funzioni server: è un sito statico.
`dist/` contiene `index.html`, gli asset con hash, `manifest.webmanifest`, `sw.js`, le icone,
le anteprime in `previews/` e `_headers` per i content-type e la cache.

La PWA è installabile e, dopo un primo caricamento completo, il service worker mantiene in cache
shell e asset per l'uso offline: all'installazione legge i nomi con hash dal `index.html` della build
e li precarica, poi aggiorna la cache a ogni nuova versione. `node scripts/pwa-check.mjs` verifica
installazione del worker, contenuto della cache e un riavvio con rete disattivata. Il caching è per
origine: se il deploy cambia domini, l'offline va riconquistato con un nuovo caricamento.

---

## Note

Tutti i personaggi sono di fantasia, il combattimento è cartoon e non ci sono sangue,
mutilazioni o riferimenti a persone reali.
