# PROMPT 3 — Stato reale, baseline e piano

> Nota: fotografia **pre-espansione** (21 ottobre, mattina). Lo stato aggiornato, con sei boss e le
> modalità extra, è in [expansion-progress.md](expansion-progress.md).

Aggiornato: 2026-10-21 · base: commit `bb9299a` (v1.2.0, main)

## 1. Stato effettivo verificato

### Campagna
- 9 livelli dichiarati in [LevelManager.ts](../src/world/LevelManager.ts) con id stabili
  ([levelIds.ts](../src/systems/levelIds.ts)); verificati da `tests/unit/levels.test.ts` (5 test) e
  in-game durante la sessione precedente (Porta Venezia, Sempione, Isola, Darsena avviati con ondate,
  Duomo→livello completato, Tetti→vittoria).
- Boss reali solo su `duomo` (Re del Borsello) e `tetti` (Re dei Tetti). La HUD dei boss ha
  3 fasi (+ Tonaca / Strada / Tutto o niente) ancora SCONOSCIUTE nella scala avversaria per
  Porta Venezia, Sempione e Darsena (solo `@tsignore` in `docs/expansion-audit.md`),
  quindi quelle 3 plazze condividono il boss music del capitolo con lo stesso track delle ondate.
- Salvataggi: `SAVE_VERSION = 3` con migrazione v1/v2 per id; testato su un salvataggio
  v2 reale del browser (5 livelli sbloccati migrati correttamente). Nessun campo per
  stili/guardaroba/sfide/record separati: tutti i campi nuovi di questi sistemi devono
  avere default validi per via della sanificazione.

### Modalità esistenti
- Campagna (rigiocabile per livello) più **Notte morta a Milano** (Zombies), modalità survival
  separata con due regole (Infinita, Estrazione), documentata in [zombies-mode.md](zombies-mode.md).
  Survival e Boss Rush della campagna non esistono: i prompt 1–2 non li hanno mai impostati
  (`grep` su `survival|boss rush` in src/ = 0 risultati). Il prompt 3 non li chiede.
- `debugJumpToLevel(n)` esiste come hook Playwright e va riutilizzato per l'accesso rapido
  ai livelli nel test dell'e2e; `debugSpawnEnemy` è già usato per il boss.

### Combattimento
- `AttackSpec` datato: startup/active/recovery/knockback/costo energia per ognuno;
  `chainIndex` nella Player per pugno→gancio(→calcio?). Attenzione: la catena del calcio
  (`chainIndex === 2`) NON è raggiungibile: `tryKick` resetta `chainIndex = 0` sempre,
  quindi la catena gustosa a 3 step esiste nel codice ma è morta. Regredita? Da testare.
- Schivata: `isDodging() = dodgeTimer>0 && invulnTimer>0` con invuln 0.3s su 0.34s durata;
  `onPerfectDodge` già emesso da CombatSystem su hit su schivata → bonus energia 24.
  La finestra perfetta è quindi SOTTILE ma esiste: base per il contrattacco.
- Hitstop: `combat.hitstopPending` consumato in Game; lo slow-motion usa `dt * 0.35`.
- Input buffer: `queued` con TTL 0.5s MA `clearTransient()` non è chiamato su cambio di
  stato (es. rientro dal pausa) in tutti i percorsi: possibile esecuzione di vecchi
  comandi dopo pausa. Da verificare e correggere.

### Controlli
- Desktop: WASD+mouse con pointer lock, remap NON esiste.
- Touch: joystick con deadzone, P/K/D/S, look drag; `setDeadzone`, safe-area via CSS.
- Non esistono: opacità/dimensione regolabili, layout mancino, rimappatura desktop.

### Audio
- AudioManager con volumi master/music/sfx, mute; nessuna distinzione miss/hit leggero/
  hit pesante/parata; nessun limite voci esplicito trovato.
- Tracce: menu, level1..level5, boss; nessuna variazione tra ondate.

### Grafica
- Low-poly procedural: CharacterFactory, Environment, Arena, Effects.
- Ombre: shadow map con flag qualità; contact shadow hard-coded su alcuni archetipi.
- Wobble UV acqua a Darsena già presente (`tick` del builder).
- Il bloom è in Effects?? NON presente: nessun postprocessing — budget mobile ok, resta così.

## 2. Difetti riproducibili e priorità

| # | Difetto | Riproduzione | Priorità |
|---|---------|--------------|----------|
| D1 | Catena pugno→gancio→calcio morta: tryKick azzera chainIndex, quindi il 3° step della catena non mai partira' | Buffer di input: pugno, pugno, calcio rapidi | Alta |
| D2 | Input buffer non azzerato su pausa/risultati se `clearTransient` non copre il caso | Pausa durante input, riattendi, guarda se scatta un attacco | Alta |
| D3 | Record punteggio sovrascritto da livelli successivi in `bestScore` globale | Gioca un livello, controlla best invece del per-livello | Media |
| D4 | Best combo globale non separata per livello/stile | Visibile nei risultati finali | Media |
| D5 | Nemici spawnano a caso con Math.random: nessun seed | Ondate diverse a parita' di run | Bassa (risolta da Sfide seed) |
| D6 | Special cooldown timer non è esposto in HUD (il cooldown resta dentro player) | Osservare icona speciale | Bassa |

Nessuno dei difetti è un crash o softlock riproducibile oggi.

## 3. Baseline visiva e prestazionale

- Ambiente di misura: desktop Apple Silicon, Chromium headless+SwiftShader per screenshot;
  device emulation Playwright (iPhone 13 Pro – Chromium). iPhone fisico NON disponibile.
- Baseline locale ( ultima misura in-game dalla sessione precedente, draw call
  163–314 a seconda del livello con ondate attive a medie ; FPS ~60 sul desktop).
  Da rieseguire subito prima e dopo la revisione grafica per un confronto diretto.
- Viewport richiesti dal prompt: 844×390, 932×430, 1440×900 + fallback verticale.
- Limiti controlli verificati: multitouch reale non disponibile (emulazione PointerEvent).

## 4. Piano delle modifiche

| Fase | Contenuto | Criterio di completamento |
|------|-----------|---------------------------|
| 1 | Correzione D1 (catena), D2 (buffer su pausa), verifica D3 | Unit test che passano + e2e ondate senza difetto |
| 2 | Rifinitura grafica su Navigli (character + luci + FX), poi portata sugli altri 8 livelli per differenze sostanziali | Screenshot before/after a 844×390; draw call non crescono oltre +15% |
| 3 | `FightStyle` datato (equilibrato/rapido/potente) con statistiche per spec; attacco derivato da schivata perfetta→pugno | Unit test per danni/tempi per stile; e2e contrattacco su attacco telegrafato |
| 4 | Modalità Allenamento (arena esistente, seed singolo target) | Selezionabile dal menu, nessun record salvato in campagna |
| 5 | Sfide offline con seed testo copiabile e modificatori (Tecnica, Pressione, Essenziale, Precisione) | Stesso seed→stessa config; test di determinismo; record separati |
| 6 | Guardaroba (palette+capi, no clipping nuovi), risultati arricchiti, controlli regolabili/diminuti, audio per-famiglia hit | Screenshot configurazione; controlli a 844×390 senza overlap |
| 7 | Migrazione save v4, export/import JSON, PWA aggiornata, build finale | Import invalido non altera lo stato; pwa-check OK; `tsc`/`test`/`build` verdi |

## 5. Non obiettivi (confermati)

- Nuove arene obbligatorie, mondo aperto, multiplayer, editor, classifiche online,
  lore estesa, survival/boss rush (mai richiesti da nessun prompt).
- Postprocessing costoso (bloom): restiamo senza, бюдж mobile.
- Servizi a pagamento, chiavi API, image generative AI.

## 6. Regole non firmate

- Nessun segreto nel repo. Nessun cambio provider/config OpenCode.
- Verifiche finali: `npx tsc --noEmit`, `npm test`, `npm run build`, `npx playwright test`,
  `node scripts/pwa-check.mjs`, smoke HTTP su `dist/`.

## 7. Registro giovedì (anticipazione + HUD brand)

- `AttackSpec.brandLabel?` e `AttackSpec.telegraphColor?` aggiunti in
  [src/combat/types.ts](../src/combat/types.ts): brand del fighter dichiarato
  nell'area HUD annunciazioni, colore per codifica minaccia.
- Archetipi: base `#ffd400`, turbo `#ff2f2f`, puffer `#ff8a3d`, boss
  `#b04dff`/`#5500ff`/`#0077ff` (borsettata/terremoto/carica).
- `Effects.setTelegraph` accetta un colore opzionale (clone material invariato).
- `Game.updateEnemyTelegraphs`: conta attacchi in wind-up, passa il centro della
  minaccia più vicina al Player e mostra il toast brand solo per i boss
  (`spec.label` + `spec.brandLabel`), non per nemici generici.
- `Player.setThreat(count, x, z)` + regola anticipata: con 3 o più attacchi
  telegrafati simultanei, schivata automatica (se cooldown pronto) in direzione
  opposta alla minaccia più vicina, senza consumo anticipato del cooldown.
- Test: [tests/unit/playerChain.test.ts](../tests/unit/playerChain.test.ts)
  incremento 51→55 casi; 55/55 verdi, `tsc --noEmit` pulito.
