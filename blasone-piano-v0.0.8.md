# Blasone — piano espansione versione 0.0.8

**Versione di partenza:** 0.0.7  
**Stato:** implementata (vedi «Esito dell'implementazione» in fondo)  
**Tema:** *Le Casate in Guerra* — una nuova casata e rivalità che cambiano il valore dei quarti contesi.

## Prerequisiti

La 0.0.8 va avviata dopo aver concluso la 0.0.7 o averne deciso esplicitamente lo slittamento. Prima di fissare valori o includere nuove carte nel formato Crepuscolo:

- completare i test umani previsti nella 0.0.6 e registrare i problemi emersi;
- chiudere le verifiche di compatibilità dei formati, del draft e delle prove introdotti in 0.0.7;
- mantenere l'audit degli input come requisito di rilascio.

Se la 0.0.7 cambia il numero di carte, i formati o il modo in cui le casate vengono selezionate, aggiornare questo piano prima dell'implementazione. La 0.0.8 non deve cambiare il comportamento di Classico, Crepuscolo o delle Prove dell'Araldo senza una decisione di progetto separata.

## Nuova meccanica: Rivalità di Casata

Quando entrambe le parti hanno almeno una carta della **stessa casata** in un quarto, nasce una **Rivalità di Casata**. Quel quarto vale **una corona personale aggiuntiva** per chi lo conquista. Un quarto può assegnare al massimo una corona Rivalità, anche se vi sono più coppie o più casate abbinate.

- La rivalità si ricalcola dal tabellone a ogni valutazione; non è un segnalino e non richiede una fase aggiuntiva.
- Si applica anche se la carta che completa la rivalità è giocata nello stesso turno dall'altro lato: le mosse sono simultanee e la condizione si verifica dopo la rivelazione di entrambe.
- La corona va al vincitore del quarto. Sul Campo rovesciato, la conquista segue la regola del totale più basso; la rivalità non cambia chi conquista.
- Torre continua ad aumentare il premio comune del quarto; Pavone ed Editto restano corone personali. La Rivalità è conteggiata separatamente nel riepilogo.
- Nessuna carta viene considerata una casata diversa in base alla modalità: si usano gli identificativi di casata definiti nel catalogo.

**Motivo:** incentiva a sfidare la composizione dell'avversario invece di accumulare carte solo nei quarti vuoti. Crea una scelta leggibile: contendersi una corona in più oppure evitare una rivalità favorevole al Conte.

## Nuova casata: Compagnia dei Confini

Quattro carte candidate, disponibili inizialmente nel formato Draft della 0.0.7 e, dopo la taratura, nel pool del Crepuscolo. Non entrano nel Classico.

| Bestia | Forza iniziale | Tintura | Abilità proposta |
|---|---:|---|---|
| **Pantera** | 4 | Nero | **Duellante:** +2 se nel suo quarto è attiva una Rivalità di Casata. |
| **Stambecco** | 3 | Oro | **Balzo:** +2 nei quarti di punta (III e IV). |
| **Lontra** | 3 | Azzurro | **Compagnia:** +1 per ogni tua carta di una casata diversa dalla sua nello stesso quarto, massimo +2. |
| **Tartaruga** | 4 | Argento | **Pazienza:** +2 se il quarto contiene carte di entrambi i lati e nessuna carta è stata giocata lì nel turno corrente. |

Forze e poteri sono valori iniziali da provare. In particolare, Tartaruga premia i quarti che si stabilizzano: la sua condizione usa il turno registrato sulle carte, non un timer o un ordine d'animazione. La sua abilità si attiva dal turno successivo alla più recente posa nel quarto.

### Regole di progettazione per le carte

- Ogni carta deve avere un testo breve nel bestiario e una spiegazione del modificatore nel tabellone e nel riepilogo.
- Le condizioni dipendenti dal turno devono leggere un dato deterministico salvato sulla carta quando viene posata.
- La forza non può scendere sotto zero; i bonus con conteggio hanno un limite indicato nel testo.
- Non introdurre effetti che estraggono carte, cambiano la mano avversaria o modificano retroattivamente le mosse già rivelate.

## Formati e disponibilità

- **Classico:** invariato, senza la nuova casata.
- **Crepuscolo:** il pool può salire da 24 a 28 carte solo dopo la taratura. Si estraggono ancora 16 carte condivise dai due lati; durata e mano restano invariate.
- **Draft delle Casate:** aggiungere le quattro nuove carte alla selezione soltanto dopo aver verificato che le regole di composizione della 0.0.7 funzionino con quattro casate e non producano draft bloccati.
- **Prove dell'Araldo:** aggiungere al massimo due scenari sulla Rivalità, come contenuto facoltativo e non come requisito per finire il set iniziale.

Non creare un ulteriore formato permanente in questa versione: il contenuto deve essere provato dentro modalità esistenti per contenere l'aumento di complessità.

## Piano di bilanciamento

1. Testare prima la sola Rivalità con le carte esistenti, confrontando partite con e senza regola. In questa fase la nuova regola è un interruttore sperimentale e non entra nei formati pubblici.
2. Se la regola è leggibile e non domina il punteggio, aggiungere le quattro carte nel Draft sperimentale.
3. Eseguire simulazioni per seed, separando Draft e Crepuscolo; registrare frequenza di pesca, frequenza di gioco, corone generate dalla Rivalità, vittorie dei quarti, abilità attivate e risultato complessivo.
4. Fare almeno 20 partite umane con la regola, verificando che i giocatori capiscano quando la Rivalità si attiva e a chi va la corona.
5. Modificare una sola variabile per iterazione. Se la Rivalità altera troppo il valore dei quarti o rende obbligatorio il confronto tra casate, abbassare la corona bonus o lasciare la regola solo in Draft.

Le vittorie per singola carta non vanno interpretate senza correggere per la frequenza con cui appare e per la distribuzione delle casate. I risultati dell'AI restano indicativi e devono essere confrontati con partite umane.

## Sicurezza e accessibilità

- Riutilizzare l'audit della 0.0.6 e aggiungere le nuove scelte di formato, composizione draft, casate e scenari ai controlli d'ingresso.
- Accettare dal draft solo identificativi presenti nell'offerta corrente, senza duplicati e nel limite previsto; verificare la composizione nell'engine, non solo nell'interfaccia.
- I dati delle carte e delle abilità devono provenire dal catalogo interno. Nomi e note non vanno interpolati come HTML non fidato.
- Rendere visibile la Rivalità con testo e simbolo, non soltanto con il colore; il riepilogo deve spiegare la corona personale aggiunta.
- Conservare navigazione da tastiera, supporto touch, movimento ridotto e transizione di fine partita.

## Criteri di accettazione

- La Rivalità è spiegata prima della partita, si attiva in modo deterministico dopo le mosse simultanee e viene conteggiata una sola volta per quarto.
- Il riepilogo separa corone base, Torri, Pavone, Editto e Rivalità senza doppio conteggio.
- Classico resta invariato; gli altri formati non includono le nuove carte finché non superano la taratura.
- Ogni carta è consultabile e la sua abilità è comprensibile nel bestiario, sulla carta e nel riepilogo.
- La versione supera i controlli automatici e le prove umane previste; non restano problemi di sicurezza ad alta priorità negli input introdotti.

## Fuori ambito

- Nuove risorse o fasi per turno.
- Carte oltre le quattro della Compagnia dei Confini.
- Cambi di bilanciamento alle carte precedenti senza evidenze raccolte.
- Rete, account o invio automatico di dati.
- Modifiche alle partite salvate o ai codici riproducibili della 0.0.6.

## Registro versioni

| Versione | Stato | Contenuto |
|---|---|---|
| 0.0.5 | Implementata | Menu, bestiario, formati, Fiere ed Editto. |
| 0.0.6 | Implementata | Feedback locale, riepilogo consultabile, fine partita graduale, accessibilità e audit degli input. |
| 0.0.7 | Implementata | Draft delle Casate, Prove dell'Araldo, Compagnia delle Veglie e Reazione. |
| 0.0.8 | Implementata | Espansione Compagnia dei Confini, Rivalità di Casata e quattro nuove bestie. |

## Esito dell'implementazione (0.0.8)

### Decisioni

- **La Rivalità è una regola facoltativa e sperimentale**, come l'Editto: una casella nel menu, spenta di base, salvata in `blasone.prefs` e scritta nel codice partita con una `r` finale (`418273-dnsr`). Senza la `r` i codici della 0.0.6 e della 0.0.7 danno la stessa partita di prima.
- **Il Bestiario non è una casata in lotta.** Le dodici carte di base sono in ogni mazzo: contarle avrebbe acceso una Rivalità in quasi ogni quarto conteso, cioè una corona fissa in più per tutti e due. Contano Crepuscolo, Fiere, Veglie e Confini. È una deviazione dal testo del piano («si usano gli identificativi di casata del catalogo»), ed è scritta nella regola VIII, nella casella del menu e nel messaggio di inizio partita.
- **Draft sperimentale = Draft con la Rivalità.** Con la regola accesa l'offerta del Draft pesca da 16 carte (le tre casate della 0.0.7 più i Confini); spenta, resta quella della 0.0.7. Il Crepuscolo non cambia pool (24 carte): i Confini ci entreranno solo dopo i test umani.
- **Tartaruga:** il «turno in corso» è `s.turn`. Dopo la rivelazione di un turno comincia il successivo, quindi la Pazienza si accende dal turno dopo l'ultima posa; dopo il turno VI il turno resta VI, e una carta posata all'ultimo turno la spegne nel conteggio finale.
- **Lontra:** contano le tue altre carte del quarto che non sono dei Confini, Bestiario compreso, fino a +2.
- **Riepilogo:** la Rivalità è una riga a sé tra le corone del quarto (base, Torri, Rivalità, Pavone, Editto), e il totale assegnato usa `prize()`, che somma ogni voce una volta.

### Bilanciamento (AI contro AI, 1500 partite per riga)

| Configurazione | Tu / Conte | Quarti in Rivalità | Corone di Rivalità a partita | Corone a partita |
|---|---|---:|---:|---:|
| Classico | 49 / 49 | — | — | 4,92 |
| Classico + Rivalità | 48 / 51 | 26% | 0,89 | 5,76 |
| Crepuscolo | 49 / 49 | — | — | 4,65 |
| Crepuscolo + Rivalità | 49 / 49 | 30% | 1,03 | 5,53 |
| Draft | 48 / 50 | — | — | 4,82 |
| Draft + Rivalità (con Confini) | 50 / 48 | 9% | 0,31 | 4,95 |

La Rivalità vale circa una corona su sei in Classico e Crepuscolo e non sposta l'equilibrio tra i lati. Nel Draft è rara, perché ogni mazzo ha solo quattro carte fuori dal Bestiario.

Carte dei Confini nel Draft con scelte a caso (3000 partite): Tartaruga 54% dei quarti vinti, Pantera 54%, Stambecco 52%, Lontra 49%, dentro la fascia delle altre casate (36-60%). Forze invariate; i valori sono in `RATE` per le scelte del Conte. La Pantera è la più legata alla Rivalità, che nel Draft si accende poco: da riguardare dopo i test umani.

### Prove facoltative

| Prova | Turni | Obiettivo | Linee vincenti |
|---|---|---|---|
| 7 · Corona contesa | 1 | almeno 2 corone | 1/9 (Tasso nel I, contro la Volpe) |
| 8 · Il duello | 2 | almeno 4 corone | 15/90 (una carta dei Confini nel I, contro la Tartaruga) |

Sono fuori dal set iniziale (`TRIALS_SET = 6`): l'intestazione mostra «Prova dell'Araldo 7 · Facoltativa» invece di «di 6».

### Sicurezza e accessibilità

- `rivalita` nelle preferenze salvate è accettata solo come booleano; nei codici solo come `r` finale; nelle prove solo come booleano (`validTrial`).
- Il Draft continua ad accettare solo id offerti e liberi, controllati nell'engine.
- La Rivalità sullo scudo è testo e simbolo («⚔ Rivalità»), con il nome delle casate nel title, non solo un colore.

### Verifiche

- `node scripts/blasone-check.js`: 124 OK. Nuove verifiche: Draft senza Rivalità identico alla 0.0.7 (120 partite), Rivalità (stessa casata, regola spenta, Bestiario, due casate e una corona sola, un lato solo, Campo rovesciato, Torre e Pavone separati), codici con e senza `r`, 300 draft con Confini senza blocchi, nessun Confini in Classico e Crepuscolo, le quattro abilità, la Tartaruga a fine partita, preferenza `rivalita` non booleana ignorata.
- `node scripts/blasone-prove.js`: 8 prove risolvibili.
- `CI=true npm run build` e `node scripts/check-responsive.js` (224 ok).

### Ancora da fare

- I test umani (almeno 20 partite con la Rivalità) e quelli rimasti dalla 0.0.6 e 0.0.7: chiarezza della regola, a chi va la corona, difficoltà percepita.
- Dopo i test: decidere se i Confini entrano nel Crepuscolo (24 → 28) e se la Rivalità resta solo nel Draft.
