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
| Nuovi boss (Buttafuori, Trainer, DJ, Consiglio) | non iniziato | servono archetipi e set di attacchi dedicati |
| Obiettivi intermedi di livello | non iniziato | |
| Difficoltà multiple | non iniziato | |
| Cosmetici | non iniziato | |
| Sopravvivenza | non iniziato | |
| Boss Rush | non iniziato | |

## Verifiche eseguite (21 ottobre)

- `npx tsc --noEmit` → 0 errori.
- `npm test` → 8 file, 48 test passati.
- `npm run build` → build pulita (bundle 208 kB, three 498 kB, Rapier 2.2 MB).
- `npx playwright test` → 20 test, 18 passati, 2 saltati (solo desktop).
- Browser reale (dev server): selezione livelli desktop 1440×860 e mobile landscape 915×412 senza overflow,
  Porta Venezia giocata con ondate attive, Tetti con boss e schermata di vittoria, Duomo con boss
  che porta alla schermata di livello completato invece che ai titoli di coda.
- Migrazione provata su un salvataggio v2 reale del browser: 5 livelli sbloccati, Duomo riconosciuto
  come completato, Tetti marcato completato ma ancora bloccato perché mancano Isola e Darsena.
- Nuove arene avviate in gioco con ondate attive: Sempione 297 draw call, Isola 314, Darsena 163
  (qualità alta, desktop 1440×860), nessun errore in console.

## Prossimo passo

Aggiungere i boss di capitolo (Buttafuori a Porta Venezia, Trainer al Sempione, DJ alla Darsena) con
attacchi e arene dedicate, poi le modalità (Sopravvivenza, Boss Rush) e la difficoltà selezionabile.
Ogni livello passa a "verificato" solo dopo una partita reale con vittoria **e** sconfitta.
