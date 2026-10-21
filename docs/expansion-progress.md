# Espansione — registro di avanzamento

Aggiornato: 21 ottobre 2026.

Stati: **non iniziato**, **implementato**, **verificato** (verificato = giocato fino alla fine del livello, non solo aperto).

## Campagna a 9 livelli

| # | ID | Livello | Arena | Boss | Stato |
| --- | --- | --- | --- | --- | --- |
| 1 | stazione | Stazione Centrale | esistente | — | verificato (e2e) |
| 2 | metro | Metro Milano | esistente | — | verificato (e2e) |
| 3 | navigli | Navigli Nightlife | esistente | — | verificato (e2e) |
| 4 | duomo | Duomo Showdown | esistente | Re del Borsello | verificato (boss → schermata livello completato) |
| 5 | porta-venezia | Porta Venezia | nuova | — | verificato (avvio, ondate, resa a schermo) |
| 6 | sempione | Parco Sempione | nuova | — | verificato avvio + ondate in gioco (non completato) |
| 7 | isola | Isola | nuova | — | verificato avvio + ondate in gioco (non completato) |
| 8 | darsena | Darsena | nuova | — | verificato avvio + ondate in gioco (non completato) |
| 9 | tetti | Tetti di Milano | Bosco Verticale, rinominato | Re dei Tetti | verificato (boss → vittoria finale) |

## Sistemi

| Sistema | Stato | Note |
| --- | --- | --- |
| ID livelli stabili (`src/systems/levelIds.ts`) | verificato | test unitari su catalogo e salvataggi |
| Salvataggio v3 con migrazione v1/v2 | verificato | 9 test unitari: rimappatura posizioni, score del Duomo, id sconosciuti, storage corrotto/pieno |
| Selezione livelli a 9 schede con capitoli | verificato | e2e desktop + mobile: 9 schede, 8 bloccate, tag `CAP I/II/III` |
| Anteprime reali delle arene | verificato | 9 JPEG 1200×675 rigenerati da `scripts/capture-previews.mjs` |
| Boss di metà campagna (Duomo) e finale (Tetti) | verificato | nome boss dinamico nella HUD; il boss del Duomo chiude il livello, quello dei Tetti chiude la campagna |
| Nuovi nemici (Guardiano, Lanciatore, Coordinatore) | non iniziato | oggi restano base, turbo, puffer |
| Boss di capitolo (Buttafuori, Trainer, DJ, Consiglio) | verificato in Boss Rush | profili con tre fasi e attacchi dedicati; livelli 5–8 non ancora rigiocati fino alla vittoria |
| Obiettivi intermedi di livello | non iniziato | |
| Difficoltà multiple | non iniziato | |
| Cosmetici | non iniziato | |
| Sopravvivenza | implementato, parzialmente verificato | 20 round generati, boss ogni 5, HUD e avvio e2e; la scalata completa non è stata chiusa in browser |
| Boss Rush | verificato | sei boss in fila, risultato finale, record e ritorno alle modalità provati in browser |
| Allenamento | verificato | manichino indistruttibile, nessun punteggio/record, HUD 1/1; colpo e danno in e2e |
| Sfide a seed fisso | implementato, verificato Essenziale | Tecnica, Pressione ed Essenziale; salute 80, nemici più duri e seed verificati per Essenziale |
| Remix | verificato | seed in HUD, piazza e modificatori deterministici, risultato con seed e riprova sullo stesso seed |
| **Notte morta a Milano (Zombies)** | verificato | modalità separata: 5 settori, round, armi, perk, barricate, estrazione |

## Verifiche eseguite (21 ottobre)

- `npx tsc --noEmit` → 0 errori.
- `npm test` → 12 file, 87 test passati (modalità, seed, record e persistenza inclusi).
- `npm run build` → build pulita (three 498 kB, Rapier 2.2 MB).
- `npx playwright test` → 36 test, 32 passati, 4 saltati per progetto (desktop-only su mobile emulato).
- Modalità extra provate in browser reale (1440×900 e 915×412): griglia senza overflow orizzontale,
  sopravvivenza 1/20, Boss Rush con sei boss e record 146880, manichino allenamento (115000 HP),
  sfida Essenziale con 80 HP, Remix con seed in HUD, risultato e riprova.
- Zombies verificato su desktop e mobile emulato 844×390: ingresso dal menu, HUD, sparo con punti,
  chiusura del round, fuoco touch; nessun errore console. Vedi `scripts/zombies-shots.mjs`.
- Browser reale (dev server): selezione livelli desktop 1440×860 e mobile landscape 915×412 senza overflow,
  Porta Venezia giocata con ondate attive, Tetti con boss e schermata di vittoria, Duomo con boss
  che porta alla schermata di livello completato invece che ai titoli di coda.
- Migrazione provata su un salvataggio v2 reale del browser: 5 livelli sbloccati, Duomo riconosciuto
  come completato, Tetti marcato completato ma ancora bloccato perché mancano Isola e Darsena.
- Nuove arene avviate in gioco con ondate attive: Sempione 297 draw call, Isola 314, Darsena 163
  (qualità alta, desktop 1440×860), nessun errore in console.

## Notte morta a Milano (Zombies)

Modalità survival separata dalla campagna, raggiungibile dal menu con `ZOMBIES`.
Dettagli tecnici in [zombies-mode.md](zombies-mode.md).

| Elemento | Stato | Note |
| --- | --- | --- |
| Mappa a 5 settori (bottega, via, cortile, metro, piazza) | verificato | porte acquistabili, 21 finestre barricabili, muri con armi, corrente, 3 perk |
| Round e ondate | verificato | ondate crescenti, intermissione 12 s, barricate danneggiabili e riparabili |
| Armi e munizioni | verificato | pistola, SMG, fucile a pompa, fucile d'assalto; upgrade e acquisti al muro |
| Due regole | verificato | Infinita (record) ed Estrazione (20 round + 8 s in zona) |
| Checkpoint | verificato | chiave `maranza-fight-3:zombies`, salvataggio tra i round, run riprendibile |
| HUD mobile | verificato | 844×390: arma libera da stick e pulsanti, fuoco touch sotto test e2e |
| Bilanciamento round alti | non verificato | provato in emulazione Chromium, non su hardware reale |

## Prossimo passo

Chiudere in browser la scalata di Sopravvivenza fino al round 20 e rigiocare i livelli 5–8 fino alla
vittoria sul rispettivo boss di capitolo, non solo dentro la Boss Rush. Poi difficoltà selezionabile,
obiettivi intermedi e cosmetici. Ogni livello passa a "verificato" solo dopo una partita reale con
vittoria **e** sconfitta.
