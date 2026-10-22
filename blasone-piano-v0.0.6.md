# Blasone — piano versione 0.0.6

**Versione di partenza:** 0.0.5, implementata il 22 ottobre 2026  
**Stato di questo documento:** implementato il 22 ottobre 2026 (punti 1–5 della sequenza); restano le partite umane  
**Obiettivo:** rendere più chiaro l'esito delle partite e raccogliere riscontri umani sul bilanciamento introdotto in 0.0.5, senza ampliare il catalogo.

## Riepilogo della 0.0.5

La versione 0.0.5 ha portato Blasone a sedici carte nel formato Classico e a venti nel catalogo complessivo, con il formato Crepuscolo che ne seleziona sedici per partita. Ha aggiunto menu e impostazioni, bestiario, miglioramenti alla selezione sul tabellone, riepilogo finale, quattro nuove bestie (Orso, Salamandra, Cinghiale e Scorpione) e l'Editto opzionale. Le simulazioni riportate in `blasone-piano-aggiornamento.md` sono promettenti, ma non sostituiscono le partite umane: i valori delle nuove bestie e il momento d'uso dell'Editto restano da convalidare con giocatori.

## Direzione della 0.0.6

La 0.0.6 è un aggiornamento di **chiarezza e convalida**. Non introduce nuove carte, campi o regole. Il catalogo è già cresciuto rapidamente e aggiungere altre carte prima di capire come vengono percepite le venti attuali renderebbe più difficile attribuire i problemi e ridurrebbe la probabilità di pescare ogni bestia.

### 1. Partite guidate e raccolta dei riscontri

- Preparare una breve scheda di feedback, accessibile dal menu o da un collegamento nel riepilogo: formato giocato, chiarezza delle abilità, leggibilità del risultato, difficoltà percepita dell'AI e momento in cui è stato usato l'Editto.
- Rendere disponibile un identificatore di partita basato sul seed, così chi segnala un problema può riferirsi alla stessa distribuzione di campi e carte. Il seed deve poter essere copiato senza esporre dati personali.
- Non raccogliere o inviare dati in rete senza una scelta esplicita dell'utente. Per la prima iterazione usare una scheda copiabile/esportabile manualmente o un breve modulo locale di feedback.
- Organizzare almeno 20 partite umane: includere nuovi giocatori, entrambi i formati e partite con Editto attivo e disattivo. Annotare i problemi osservati, non solo l'esito vittoria/sconfitta.

**Criterio di accettazione:** i partecipanti riescono a riportare una partita riproducibile e a indicare quali regole o modificatori hanno influenzato la loro decisione; il flusso di feedback non invia dati senza consenso esplicito.

### 2. Spiegazione del risultato e cronaca

- Nel riepilogo finale, rendere selezionabile ogni quarto per consultare le carte, i totali, il campo e il motivo della conquista.
- Mostrare separatamente le corone base e i contributi di Torre, Pavone ed Editto, indicando a chi spettano.
- Nella cronaca dei turni, rendere chiaro che le due mosse sono state rivelate insieme e riportare le carte/quarti giocati da entrambi.
- Fornire testi esplicativi anche a chi usa tastiera o lettore di schermo; non affidare la distinzione dei risultati solo al colore o alle animazioni.

**Criterio di accettazione:** dopo una partita, un giocatore può ricostruire perché sono state assegnate le corone e quale totale ha deciso ciascun quarto senza dover consultare il codice o ripetere la partita.

### 3. Bug UX: schermata di fine partita immediata

- **Problema osservato:** appena viene risolta l'ultima mossa, la schermata “partita finita” compare immediatamente e copre il tabellone. Il giocatore non ha un momento per vedere l'esito dell'ultimo turno e collegarlo ai punteggi appena aggiornati.
- **Comportamento richiesto:** dopo la rivelazione dell'ultima mossa, mantenere visibile il tabellone aggiornato per un breve intervallo e poi mostrare il riepilogo con una transizione morbida, senza scatti o copertura brusca.
- La transizione deve rispettare `prefers-reduced-motion`: in modalità movimento ridotto usare un passaggio immediato o una dissolvenza molto breve, senza animazioni spaziali.
- Il riepilogo non deve diventare interattivo prima della fine della transizione; focus e annunci accessibili devono passare al riepilogo quando questo è effettivamente aperto.

**Criterio di accettazione:** l'ultima mossa e il punteggio aggiornato restano visibili prima dell'apertura del riepilogo; il passaggio è graduale, non blocca l'interazione più del necessario e funziona anche con movimento ridotto e tastiera.

### 4. Rifiniture di accessibilità e input

- Verificare l'intero flusso con tastiera: apertura/chiusura menu, schede, filtri bestiario, selezione della carta, scelta del quarto e ritorno dal riepilogo.
- Rendere coerenti focus iniziale, focus dopo la chiusura dei pannelli e annunci delle mosse rivelate.
- Rispettare `prefers-reduced-motion` per transizioni, rivelazione delle carte e animazioni dell'esito.
- Coordinare focus e annunci con la transizione di fine partita: non spostare il focus sulla schermata conclusiva prima che sia visibile.
- Controllare contrasto, zoom 130%, orientamento verticale del telefono e bersagli touch sui quarti selezionabili.

**Criterio di accettazione:** tutte le azioni principali sono completabili da tastiera e il giocatore può ridurre o disattivare il movimento senza perdere informazioni.

### 5. Audit di sicurezza e trattamento degli input

- Fare un inventario di ogni dato controllabile dal giocatore: ricerca e filtri del bestiario, seed o parametri della partita, impostazioni salvate, contenuti del feedback e ogni valore passato da URL o controlli dell'interfaccia.
- Validare e normalizzare gli input al confine in cui entrano nell'applicazione, secondo il tipo e il formato ammessi. Rifiutare o riportare a un valore sicuro valori fuori intervallo, formati inattesi e contenuti troppo lunghi.
- Codificare i valori in base al contesto quando vengono mostrati (testo, attributi, URL); non inserirli come HTML eseguibile. Evitare `innerHTML` per dati dinamici non fidati, oppure usare una sanitizzazione mantenuta e adatta al contesto se HTML è davvero necessario.
- Verificare che input manipolati non possano eseguire script, creare markup o attributi inattesi, corrompere lo stato salvato, influenzare una partita diversa o causare errori bloccanti. Includere caratteri speciali, stringhe vuote, lunghezze estreme, Unicode e valori numerici non validi.
- Controllare che i dati persistiti siano trattati come non fidati anche al successivo caricamento e che l'eventuale esportazione del feedback non interpreti testo inserito dall'utente come formula o contenuto attivo.
- Documentare i risultati dell'audit, i problemi trovati, le correzioni e i casi provati. Non considerare sufficiente una sanificazione generica: usare validazione per il dominio e codifica contestuale all'output.

**Criterio di accettazione:** ogni input del giocatore è validato e gestito in modo sicuro prima dell'uso; nessun input non fidato può essere interpretato come codice o markup attivo, e dati non validi non compromettono partita o impostazioni. L'audit documenta i punti d'ingresso e i controlli applicati.

## Bilanciamento: metodo e soglie

In questa versione i valori delle carte restano invariati finché i riscontri non identificano un problema ripetibile. Le simulazioni sono uno strumento diagnostico; i risultati dell'AI euristica non costituiscono da soli una ragione per indebolire o rafforzare una bestia.

Per ogni partita di prova registrare manualmente formato, seed, impostazione dell'AI, Editto attivo o meno, risultato in corone e abilità percepite come decisive. Separare i dati per formato: Classico e Crepuscolo non hanno la stessa composizione del mazzo. Quando emerge un problema, riprodurlo prima con lo stesso seed e cambiare una sola variabile alla volta.

Considerare una modifica numerica solo quando:

1. lo stesso problema emerge in più partite e non dipende da una singola distribuzione;
2. è possibile collegarlo a una carta, a un campo o all'Editto;
3. una simulazione ampia e partite umane di controllo mostrano che la correzione riduce il problema senza creare un nuovo vantaggio evidente;
4. la modifica è annotata nel registro delle versioni con motivazione e confronto prima/dopo.

## Fuori ambito

- Nuove carte, campi, casate o risorse.
- Modifiche automatiche ai valori delle venti bestie.
- Partite online, account, telemetria o invio automatico dei dati.
- Nuove modalità che allungano la partita o cambiano il numero di turni.

## Sequenza proposta

1. Aggiungere la spiegazione consultabile dei quarti nel riepilogo e migliorare la cronaca.
2. Correggere la comparsa immediata della schermata di fine partita con una transizione dolce.
3. Rifinire navigazione da tastiera, annunci accessibili e movimento ridotto.
4. Fare l'audit di sicurezza e correggere i problemi di validazione, persistenza e output dinamico.
5. Aggiungere un flusso manuale per raccogliere feedback e seed riproducibili.
6. Svolgere partite umane nei due formati, con prove separate dell'Editto.
7. Decidere, sulla base dei risultati, se la 0.0.7 debba intervenire su valori/regole o esplorare altro contenuto.

## Registro versioni

| Versione | Stato | Contenuto |
|---|---|---|
| 0.0.5 | Implementata, 22 ottobre 2026 | Menu, bestiario, Classico/Crepuscolo, Orso, Salamandra, Cinghiale, Scorpione, Editto e riepilogo partita; simulazioni AI riportate nel piano precedente. |
| 0.0.6 | Implementata, 22 ottobre 2026 | Codice partita riproducibile, scheda di riscontro locale, riepilogo con quarti consultabili, cronaca "rivelate insieme", fine partita ritardata e in dissolvenza, rifiniture di tastiera e movimento ridotto, audit degli input. Nessun valore di gioco cambiato. |

## Esito dell'implementazione (0.0.6)

**1. Riscontri.** Ogni partita ha un **codice** come `418273-cns`: seed, formato (`c` Classico, `r` Crepuscolo), Editto (`e`/`n`) e stile del Conte (`p`/`s`/`v`). Stesso codice e stesse mosse danno la stessa partita, perché anche l'AI estrae dal generatore della partita. Per questo lo stile del Conte ora vale dalla partita successiva, come formato ed Editto. Il codice si copia da Menu → Partita e compare nel riepilogo; da lì si può anche rigiocare un codice. La scheda **Riscontro** (nel menu e dal riepilogo) compila da sola codice, formato, Conte, Editto ed esito, e chiede chiarezza delle abilità, leggibilità del risultato, difficoltà percepita, abilità decisive e note. Si copia o si scarica come `.txt`: niente passa dalla rete.

**2. Spiegazione del risultato.** Nel riepilogo ogni quarto si apre e mostra:
- il campo con la sua regola;
- le carte di ogni lato, con forza stampata e modificatori;
- il perché dell'assegnazione;
- l'elenco delle corone: base, Torri con il loro proprietario, Pavone ed Editto, e per ognuna se è stata assegnata.

Nella cronaca ogni turno è segnato "rivelate insieme".

**3. Fine partita.** Dopo l'ultima mossa il tabellone aggiornato resta scoperto 1,8 s, mentre l'indicazione in alto avvisa che il riepilogo si apre tra poco. Poi il riepilogo entra in dissolvenza in 0,6 s. Durante la transizione è inerte, e prende il focus solo quando è aperto. Con movimento ridotto, del sistema o del menu, l'attesa resta ma il riepilogo compare senza transizione. Esc o "Guarda lo scudo" lo chiudono, "Rivedi il riepilogo" lo riapre.

**4. Accessibilità.**
- Mentre è aperto il riepilogo o la scheda di una carta, il tavolo dietro è inerte, così il focus non ci finisce.
- Il focus torna al bottone d'origine alla chiusura.
- La riga "Mosse rivelate" è un'area live sempre presente.
- Per la scheda di riscontro, i bottoni di scelta sono alti almeno 40px.
- Verificati zoom 130% a 360px e il check responsive (224 ok). A quello zoom, su 360px, i nomi lunghi delle carte vanno a capo dentro la parola.

### Audit di sicurezza e input

| Punto d'ingresso | Rischio | Controllo applicato |
|---|---|---|
| `localStorage["blasone.prefs"]` | JSON manipolato: tipi sbagliati, `__proto__`, valori fuori lista | Letto solo se più corto di 500 caratteri. Si copiano solo le chiavi note: formato e stile del Conte se sono chiavi proprie delle liste ammesse, dimensione solo se è un numero ammesso, interruttori solo se booleani. Niente `Object.assign` sull'oggetto letto. |
| `?seed=` | testo o script nell'URL | Accettato solo se è un intero di 1–10 cifre, al massimo 4294967295; altrimenti seed casuale. |
| Codice partita (campo "Rigioca") | testo libero | `parseCode()` in `game.js`: al massimo 32 caratteri, espressione esatta `cifre-[cr][en][psv]`, seed nel range; altrimenti `null` e un messaggio d'errore in `textContent`. |
| Ricerca nel bestiario | testo libero | Usata solo per filtrare (`includes`), mai inserita nel DOM; `maxlength` 40. |
| Scheda di riscontro | testo libero, esportato | Rimossi i caratteri di controllo, lunghezze limitate (200 e 1000), ogni riga che inizia con `= + - @` riceve un apostrofo, perché un foglio di calcolo non la legga come formula. Uscita in `text/plain`, mai come HTML. Le scelte radio sono verificate contro le liste ammesse. |
| Output nel DOM | markup nei dati | Tutti i valori dinamici inseriti con `innerHTML` vengono da costanti del motore o da numeri, e i testi passano da `esc()`. Codici, messaggi e riga delle mosse usano `textContent`. |
| Rete | invio di dati | Nessuna richiesta di rete. Copia (appunti) e download (`Blob` locale) partono solo da un clic. |

**Casi provati** (`node scripts/blasone-check.js`, 27 controlli, tutti superati):
- preferenze salvate ostili (`__proto__`, formato con `<img onerror>`, dimensione come stringa, Conte `constructor`, booleano come stringa);
- `?seed=<script>…`;
- codice con markup, troppo lungo, oltre il range, cifre non ASCII, lettere sbagliate;
- note con `=HYPERLINK(…)`, carattere di controllo e `<b>`;
- campo "decisive" di 400 caratteri che inizia con `+`;
- ritardo, transizione e focus della fine partita, con movimento normale e ridotto.

Nessun markup iniettato, nessun errore bloccante, prototipi intatti.

**Ancora da fare (punto 6 della sequenza):** le venti partite umane nei due formati, con e senza Editto, raccolte con la scheda di riscontro.
