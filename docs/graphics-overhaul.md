# Graphics Overhaul — stato, baseline e piano

Ultimo aggiornamento: in corso (Fase 1 – audit e baseline).

## 1. Ambiente di verifica

- Server: `npm run dev` su `127.0.0.1:5173` (Vite 7).
- Browser del task: Chromium, **WebGL 2.0 disponibile** (`WebGL 2.0 (OpenGL ES 3.0 Chromium)`), canvas 844×390 CSS px (DPR 2 → 1688×780 reale).
- Screenshot baseline: `screenshots/overhaul-baseline-menu.png`, `screenshots/overhaul-baseline-play.png` — menu + combattimento a 844×390.
- Livello ispezionato: **Stazione Centrale**, ondata 1/3.
- Non disponibili in questo ambiente: multitouch reale, profili hardware mobile variegati → le misure su Mobile restano emulazione + giudizio di studio del codice, non run fisici.

## 2. Difetti osservati a immagine ferma (baseline gameplay)

**Personaggi**
- Testa: cranio = sfera + calotta; mascella, ponte nasale e raccordo collo-torso assenti → la testa sembra un "coppolone" lego.
- Niente spalle modellate: il torso slitta sotto le capsule-braccia senza raccordo visibile dietro al personaggio.
- Mani = gusci sferici senza pollice; scarpe senza punta/cap toe, niente contrasto tomaia/suola credibile.
- Niente pieghe d'abito o cuciture selettive: tutto `flatShading` con blocchi tinta unita.

**Arena (Stazione Centrale)**
- Pavimento enorme e piatto a grandi lastre con puntini: sembra "bagno", non asfalto/piazza; mancano cordoli, drenaggi, differenziazione marciapiede.
- Facciata stazione piatta e monocromatica, zero profondità delle finestre.
- Bordi arena: il fondale finisce troppo presto → buchi neri ai lati anziché skyline/facade continuo.
- Lampioni = paletti neri con un cono di luce scialbo, senza testa/riflettore.

**Illuminazione**
- `HemisphereLight` scialba + `AmbientLight` bassa + 2 `DirectionalLight` (moon + rim) + poche `PointLight` + sprite glow.
- Risultato: scena scurissima, personaggi scarsamente separati dal fondale, facciata quasi spenta.

## 3. Baseline codice (audit)

- `src/core/Renderer.ts`: profili `low/medium/high` con `renderScale` + `pixelRatioCap`; ACES Filmic + sRGB; `antialias: true`, `stencil: false`.
- `src/graphics/CharacterFactory.ts` (691 rig): gerarchia a giunti con geometrie condivise in cache; `flatShading: true` globale; 10+ materiali per personaggio (per-istanza, dispose gestito in `disposeCharacter`).
- `src/world/Environment.ts` (974 rig): builder `addBox/addCylinder/addSign/addGlow/addLightCone/addPointLight`, texture procedurali via `canvasTexture`.
- `src/world/Arena.ts` (1628 rig): 9 builder di arena già ampliati (stazione, metro, duomo, navigli, towers, porta-venezia, sempione, isola, darsena); luce di base `setNightSky`.
- `src/styles/main.css` (2900 rig): HUD/menu coerenti con la direzione arcade.

## 4. Cosa è già valido e si conserva

- Gerarchia giunti + cache di geometrie: lo standard AniSys è padrone dell'animazione, lo estendo senza riscriture.
- Palette outfit (`PLAYER_OUTFIT` giallo/nero, varianti base/puffer/turbo/boss): già riconoscibili a colore.
- Sprite glow come fake bloom: economico e leggibile, si raffina, non si rimuove.

## 5. Piano per fase (aggiornato live)

| Fase | Contenuto | Criterio |
|---|---|---|
| 1 | Audit + baseline screenshot + questo file | **fatto** |
| 2 | Rebuild `player`+`base` (testa/collo/spalle/mani/scarpe) + piazza Stazione (texture realistiche, nicchie facciata) + luce composta | **fatto** — screenshot `overhaul-f2-play-v2.png` |
| 3 | Verifica visiva/prestazionale su dist + browser; fix incoerenze | **fatto su dev** — 60 fps, 26.7k tri, 324 draw call; `tsc`/`vitest`/`build` verdi; dist ancora da validare |
| 4 | Propagazione a puffer/turbo/boss e alle altre 8 arene | Ogni archetipo riconoscibile anche solo di forma, non solo di colore |
| 5 | Profili rinominati Mobile/Bilanciato/Alto (UI + Renderer), gioco rivelato a 60 fps stabili | **fatto** — profili coerenti client/rendering; draw call ≈324 invariati |
| 6 | Regressioni (tsc + vitest + build + HTTP dist), rilascio risorse, report finale | Nessuna risorsa persa fra arena→menu→arena |

## 6. Non obiettivi

- Fotorealismo, ray tracing, crowd simulata, traffico complesso, editor, nuove modalità/livelli.
- Cambio motore: resta Three.js WebGL 2 come stack attuale.
