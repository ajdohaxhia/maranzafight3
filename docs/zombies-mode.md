# Notte morta a Milano — modalità Zombies

Modalità survival separata dalla campagna, raggiungibile dal menu con `ZOMBIES` o
`window.__MARANZA__.startZombies()`. Tutto lato client: nessun asset esterno, nessun
salvataggio remoto.

## Mappa e settori

Una sola mappa notturna a cinque settori, collegati da sei porte acquistabili:

| Settore | Zona | Finestre | Accesso |
| --- | --- | --- | --- |
| Bottega | atrio di via Padova, punto di partenza | 4 | sempre aperto |
| Via commerciale | corso Buenos Aires | 5 | porta `d0` (500) |
| Cortile | cortile di via Padova | 4 | porta `d1` (750) |
| Metro | accesso linea gialla | 4 | porta `d2` (750) |
| Piazza | piazza del Duomo, estrazione | 4 | porte `d3`/`d4`/`d5` (1000/750/750) |

Ogni finestra è una barricata da 160 HP: i non-morti la consumano restando fuori, i colpi
passano sopra la parte bassa della barricata (il collider è alto 0,9 m, le assi sono
visibili a tutta altezza), e quando si sfonda il varco resta aperto finché non lo ripari
(100 punti). Le porte aprono nuove zone e nuovi punti di spawn.

## Economia

| Acquisto | Costo | Effetto |
| --- | --- | --- |
| Porta | 500–1000 | sblocca un settore, i suoi spawn e i suoi acquisti |
| Arma al muro | 1000–1500 | SMG, fucile a pompa, carabina (secondo slot) |
| Munizioni | 350–700 | rifornisce l'arma posseduta |
| Corrente | 1000 | sblocca perk e banco |
| Perk | 2500 | Resistenza (-35% danni), Mani Veloci (-40% ricarica), Passo Lungo (+18% velocità) |
| Banco | 1500 | +35% danno, massimo 3 livelli per arma |
| Riparazione barricata | 100 | riporta la finestra a 160 HP |

I punti arrivano dai colpi (10), dai KO (90–500 a seconda dell'archetipo), dai round
completati e dalle schivate. Il moltiplicatore doppio punti dura 25 secondi ed è un pickup.

## Round

- Composizione: `min(42, 4 + round*2 + floor(round²*0.3))` non-morti.
- Dal round 3 entrano i corridori, dal 5 i palazzinari, ogni 5 round un sindaco morto
  (due dal round 15).
- Cap simultaneo: `min(maxAlive, 3 + floor(round*0.85))`, con `maxAlive` 9/11/12 in base
  alla qualità grafica.
- Intermissione di 12 secondi tra i round; il checkpoint viene scritto qui.
- Archetipi: passante (150 HP), corridore (110, veloce), palazzinaro (420, lento e pesante),
  sindaco morto (900, attacco ad area).

## Regole

- **Infinita**: nessun limite di round, record personale (round, KO, punti).
- **Estrazione**: dopo il round 20 si attiva la zona in piazza; restare dentro per 8 secondi
  con ondate continue chiude la run. Il timer di estrazione parte a 90 secondi.

## Salvataggi

Chiave separata `maranza-fight-3:zombies`, schema versionato e sanitizzato in
[ZombieSave.ts](../src/zombies/ZombieSave.ts). Contiene record e un solo checkpoint attivo
(round successivo, punti, HP, armi, porte, corrente, perk, tempo). Un salvataggio corrotto o
di una versione sconosciuta viene scartato senza toccare i progressi della campagna. Il
pulsante di una nuova run chiede conferma se un checkpoint è già in pausa.

## HUD e controlli

HUD dedicato (`#zombies-hud`): round, HP, punti, non-morti rimasti, corrente, perk, arma con
caricatore/riserva, barra di ricarica, slot, prompt di interazione e stato estrazione.
Su touch il layout shooter sostituisce i pulsanti del beat 'em up: stick a sinistra, FUOCO /
RICARICA / CAMBIA a destra, SCHIVA e INTERAGISCI sopra. Il pannello arma è spostato a destra
dello stick e le etichette degli slot sono nascoste sotto i 560 px di altezza, così a 844×390
non si sovrappone ai comandi.

## File

| File | Ruolo |
| --- | --- |
| [ZombiesMode.ts](../src/zombies/ZombiesMode.ts) | stato della run, round, shooting hitscan, economia, HUD, checkpoint |
| [ZombiesMap.ts](../src/zombies/ZombiesMap.ts) | mappa procedurale, porte, finestre/barricate, acquisti, settori |
| [Zombie.ts](../src/zombies/Zombie.ts) | archetipi, movimento, attacco corpo a corpo, ingresso dalle finestre |
| [Weapons.ts](../src/zombies/Weapons.ts) | specifiche armi e stato munizioni/ricarica/slot (testabile senza motore) |
| [WeaponView.ts](../src/zombies/WeaponView.ts) | modello dell'arma in prima persona sul personaggio |
| [ZombieSave.ts](../src/zombies/ZombieSave.ts) | record, checkpoint, sanitizzazione |
| [ZombiesHUD.ts](../src/ui/ZombiesHUD.ts) | binding DOM dell'HUD |

## Verifiche

- `tests/unit/weapons.test.ts` — munizioni, ricarica, switch, upgrade.
- `tests/unit/zombieSave.test.ts` — sanitizzazione, checkpoint, record.
- `tests/e2e/game.spec.ts` — ingresso dal menu, HUD, sparo con punti reali, fine round,
  layout mobile senza overlap e fuoco touch.
- `scripts/zombies-shots.mjs` — run mobile 844×390 con screenshot e report JSON
  (`screenshots/mobile-zombies*.png`).

Limite noto: bilanciamento dei round alti e dell'estrazione provato solo in emulazione
Chromium, non su hardware mobile reale.
