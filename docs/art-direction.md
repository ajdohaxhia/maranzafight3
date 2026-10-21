# Art direction — Milano Graphic Novel 3D

Documento operativo per l'overhaul grafico. Vale per tutti gli archetipi, le arene e i profili di qualità.

## 1. Identità

**Milano di notte, graphic novel tridimensionale.** Indie 3D rifinito, non fotorealismo: forme scolpite, proporzioni caricaturali solide, materiali letti per come rispondono alla luce e non per aggiunta di dettaglio infinito.

Tre regole assolute:
1. **Silhouette prima del colore.** Ogni personaggio/prop/arena deve essere riconoscibile a immagine ferma in bianco e nero.
2. **Contrast servo.** Personaggi separati dal fondale per contrasto di valore (valore tonale) + colorTemperature (freddo ambiente/luce calda soggetti), non per postprocessing o alone generico.
3. **Dettaglio dove lo sguardo cade.** Alta densità in testa, torso, mani, scarpe, facciate principali; rumoroso e generico in periferia.

## 2. Proporzioni e silhouette

**Personaggi** (altezza logica base ≈ 1,82 m — scala `player/base`=1, `turbo`=0,96, `puffer`=1,1, `boss`=1,24):
- Cranio compatto e **superiore largo, inferiore stretto** (orizzontale maschile); mandibola riconoscibile con volume in `[lower jaw]` separato dal collo.
- Spalle modellate: massa scapolareDataAdapter del torso che *nascere* dal raccordo braccio-torso, non più only capsule disconnesse.
- Mani: gusci + **pollice opposabile corto**; a distanza di gioco leggibili come "mani", non come "(blob)".
- Scarpe: tomaia + punta (cap toe) + **suola che stacca dal terreno** col colore `sole`, contrasto chiaro/scuro.
- Puffer: stencil a segmenti (torus) + cerniera centrale + colletto; volume gonfio credibile.
- Boss: un volume in più — **colletto pelliccia** e catena d'oro letali come landmark a silhouette.

**Palette globale** (MILANO NOTTURNA):
- Superficie urbana: `aspa. #14161a` / `ceme. #22303c` / `inton. #a8967f`
- Accenti fisici: `segna. #ffd400` (giallo insegne/linee) / `em2 #2f9c63` o `#c62b2b` per brand nemici.
- **Personaggi caldo: pelle `d3a077/c99062/e2b286`** mint vs. fondale freddo → prima chiave di separatorone.
- Emissive: `#ffd400` (insegne), `#88f` (vetro/lampioni), mai `>0.65` di intensità per puro decorativo.

**Camera:** FOV 60–64 follow, lomi bassa (dopo `hitstop`); `shake` ≤0.55 sempre.

## 3. Materiali

| Materiale | roughness | metalness | Note |
|---|---|---|---|
| Pelle | 0.78 | 0 | Mai metallica, mai emissive |
| Tela/tessuto | 0.88 | 0 | piega solo su colletti e tasche |
| Nylon puff | 0.55 | 0.05 | un po' più lucido, riflessi netti |
| Suola gomma | 0.9 | 0 | matto scuro, contrasto con tomaia |
| Metallo verniciato | 0.35 | 0.6 | lanterne, graffize, ringhiere |
| Asfalto | 0.86 | 0 | canvas texture, grana fina |
| Pietra pavimento | 0.72 | 0 | cordolo e giunti disegnati, non "puntini" |
| Intonaco facciate | 0.75 | 0 | patinatura saturata scura |
| Vetro insegne | 0.15 | 0.5 | emissive da segnaletica |

Texture procedurali canvas/SVG: **pattern tileable, deterministiche**, generate una sola volta per livello. Disciplinate su asfalto/pietra/intonaco, mai su pelle o personaggi. `flatShading` resta lo standard per lo stile, ma **solo dove la poligonale giustifica la faccetta** — evitare grana perfettamente uguale su tutto.

Color space: renderer già `SRGBColorSpace` + ACES Filmic `exposure 1.28`. Mantenere (niente doppie conversioni gamma, i canvas texture si producono già in sRGB e Three non riconverte `map` con `colorSpace = SRGBColorSpace`).

## 4. Luce

Per arena, sempre stessa formula:
1. **Key**: 1 `DirectionalLight` "moon" calda-fredda coerente col quartiere (stazione: fredda metallica; navigli: ambrata da lampiona; duomo: sabbia). Ombre solo profilo Alto.
2. **Fill**: HemisphereLight con sky/ground asimmetrici non grigi: sky leggermente `colorTemp` scura, ground riflesso dal pavimento reale.
3. **Accents**: max 6–8 `PointLight`/emissive per fascia visiva: porte, insegne, lampioni *il giallo sempre a temperatura calda*. Glowsprite solo dove c'an emissive reale.

**Mai:** unico `pointLight` enorme su tutto l'arena; alone generico su personaggi; emissive tanato tanta che la scena brucia. `toneMappingExposure` resta 1.28.

## 5. Composizione arena

Ogni arena, tre fasce:
- **Zona combattimento** (±10 m attorno al centro): pavimento pulito e leggibile, nessun prop区内, contrasto alto.
- **Margini**: props con collisione (panchine, moduli,/idrante) e dettagli intermedi.
- **Fondale**: landmark monumentale (facciata stazione, guglie duomo, skyline tetti), densità alta, **nessuna collisione**.

Fondo scena (lato camera): giunti, cordoli, drenaggi, linee di guida; differente per ogni arena, mai lo stesso set di props sparso casualmente.

## 6. Regole di verifica

- Screenshot a 844×390 e 1440×900, menu + combattimento reale (mai scene costruite per lo screenshot).
- Draw call e triangoli dalla `renderer.info`: confronto before/after stesso livello stesso profilo.
- Pelle/fondali leggibili anche con sola emissive spenta.
- Ogni archetipo distinto di forma non solo colore.

## 7. Non obiettivi

Fotorealismo, ray tracing, Lumen, crowd simulata, traffico, nuove modalità/livelli, cambio motore, ImageGen o asset AI.
