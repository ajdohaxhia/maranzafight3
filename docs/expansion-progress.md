# Espansione — registro di avanzamento

Aggiornato: 21 ottobre 2026.

Stati: **non iniziato**, **implementato**, **verificato** (verificato = giocato fino alla fine del livello, non solo aperto).

## Campagna a 12 livelli

| # | ID | Livello | Arena | Boss | Stato |
| --- | --- | --- | --- | --- | --- |
| 1 | stazione | Stazione Centrale | esistente | — | verificato (e2e) |
| 2 | metro | Metro Milano | esistente | — | verificato (e2e) |
| 3 | navigli | Navigli Nightlife | esistente | — | verificato (e2e) |
| 4 | brera | Brera | nuova | — | verificato avvio + ondate in gioco (non completato) |
| 5 | duomo | Duomo Showdown | esistente | Re del Borsello | verificato (boss → schermata livello completato) |
| 6 | porta-venezia | Porta Venezia | nuova | — | verificato (avvio, ondate, resa a schermo) |
| 7 | sempione | Parco Sempione | nuova | — | verificato avvio + ondate in gioco (non completato) |
| 8 | citylife | CityLife | nuova | — | verificato avvio + ondate in gioco (non completato) |
| 9 | isola | Isola | nuova | — | verificato avvio + ondate in gioco (non completato) |
| 10 | citta-studi | Città Studi | nuova | — | verificato avvio + ondate in gioco (non completato) |
| 11 | darsena | Darsena | nuova | — | verificato avvio + ondate in gioco (non completato) |
| 12 | tetti | Tetti di Milano | Bosco Verticale, rinominato | Re dei Tetti | verificato (boss → vittoria finale) |

## Sistemi

| Sistema | Stato | Note |
| --- | --- | --- |
| ID livelli stabili (`src/systems/levelIds.ts`) | verificato | test unitari su catalogo e salvataggi |
| Salvataggio v3 con migrazione v1/v2 | verificato | 9 test unitari: rimappatura posizioni, score del Duomo, id sconosciuti, storage corrotto/pieno |
| Selezione livelli a 12 schede con capitoli | verificato | e2e desktop + mobile: 12 schede, 11 bloccate, tag `CAP I/II/III` |
| Anteprime reali delle arene | verificato | 12 JPEG 1200×675 rigenerati da `scripts/capture-previews.mjs` |
| Boss di metà campagna (Duomo) e finale (Tetti) | verificato | nome boss dinamico nella HUD; il boss del Duomo chiude il livello, quello dei Tetti chiude la campagna |
| Nuovi nemici (Guardiano, Lanciatore, Coordinatore) | non iniziato | oggi restano base, turbo, puffer |
| Boss di capitolo (Buttafuori, Trainer, DJ, Consiglio) | verificato in Boss Rush | profili con tre fasi e attacchi dedicati; livelli 6, 7, 9 e 11 non ancora rigiocati fino alla vittoria |
| Obiettivi intermedi di livello | non iniziato | |
| Difficoltà multiple | non iniziato | |
| Cosmetici | non iniziato | |
| Sopravvivenza | implementato, parzialmente verificato | 20 round generati, boss ogni 5, HUD e avvio e2e; la scalata completa non è stata chiusa in browser |
| Boss Rush | verificato | sei boss in fila, risultato finale, record e ritorno alle modalità provati in browser |
| Allenamento | verificato | manichino indistruttibile, nessun punteggio/record, HUD 1/1; colpo e danno in e2e |
| Sfide a seed fisso | implementato, verificato Essenziale | Tecnica, Pressione ed Essenziale; salute 80, nemici più duri e seed verificati per Essenziale |
| Remix | verificato | seed in HUD, piazza e modificatori deterministici, risultato con seed e riprova sullo stesso seed |

## Verifiche eseguite (21 ottobre)

- `npx tsc --noEmit` → 0 errori.
- `npm test` → 10 file, 68 test passati (modalità, seed, record e persistenza inclusi).
- `npm run build` → build pulita (three 498 kB, Rapier 2.2 MB).
- `npx playwright test` → 34 test, 31 passati, 3 saltati (desktop-only su mobile emulato).
- Modalità extra provate in browser reale (1440×900 e 915×412): griglia senza overflow orizzontale,
  sopravvivenza 1/20, Boss Rush con sei boss e record 146880, manichino allenamento (115000 HP),
  sfida Essenziale con 80 HP, Remix con seed in HUD, risultato e riprova.
- Nuovi quartieri Brera (264 draw call), CityLife (427) e Città Studi (323) avviati in gioco a 1440×900:
  ondata 1/4 attiva, nemici generati, HUD corretto, nessun errore console oltre al warning Rapier.
- Browser reale (dev server): selezione livelli desktop 1440×860 e mobile landscape 915×412 senza overflow,
  Porta Venezia giocata con ondate attive, Tetti con boss e schermata di vittoria, Duomo con boss
  che porta alla schermata di livello completato invece che ai titoli di coda.
- Migrazione provata su un salvataggio v2 reale del browser: 5 livelli sbloccati, Duomo riconosciuto
  come completato, Tetti marcato completato ma ancora bloccato perché mancano Isola e Darsena.
- Nuove arene avviate in gioco con ondate attive: Sempione 297 draw call, Isola 314, Darsena 163
  (qualità alta, desktop 1440×860), nessun errore in console.

## Prossimo passo

Chiudere in browser la scalata di Sopravvivenza fino al round 20, completare Brera, CityLife e
Città Studi e rigiocare Porta Venezia, Sempione, Isola e Darsena fino alla vittoria sul rispettivo
boss di capitolo, non solo dentro la Boss Rush. Poi difficoltà selezionabile, obiettivi intermedi e
cosmetici. Ogni livello passa a "verificato" solo dopo una partita reale con vittoria **e** sconfitta.
