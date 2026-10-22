# Blasone — regole, bilanciamento ed espansione proposta

Documento di progetto basato sull'implementazione presente in `public/designs/blasone/game.js`, `index.html` e `script.js`. Le carte e le regole qui descritte riflettono il codice attuale; la sezione di espansione è una proposta da provare al tavolo prima di integrarla.

## Regole attuali

### Preparazione e partita

- Duello tra un giocatore e il Conte di Sable, in **sei turni**.
- Lo scudo ha quattro quarti: I e II sono di capo; III e IV di punta. I quarti confinanti sono I↔II, I↔III, II↔IV, III↔IV.
- All'inizio si scelgono casualmente quattro campi distinti tra gli otto disponibili, uno per quarto.
- Ogni lato ha un mazzo contenente una copia di ciascuna delle dodici bestie e pesca quattro carte iniziali. Nei turni I–V pesca una carta dopo aver giocato; al VI non si pesca. Entrambi scelgono carta e quarto simultaneamente; le scelte avversarie non sono visibili.
- Si gioca una carta per lato per turno, se esiste un quarto legale. Ogni carta può essere giocata una sola volta per partita.

### Contesa dei quarti e vittoria

- Vince un quarto chi ha il totale di forza maggiore. Se solo un lato vi ha carte, quel lato lo conquista automaticamente.
- Ogni quarto vale una corona, oppure due se è **Campo d'argento**. Ogni Torre presente aggiunge una corona al valore del quarto, per entrambi i contendenti: il premio vale quindi `1 (o 2) + Torri sul quarto`.
- Vince chi raccoglie più corone. A parità, si confronta la somma della forza dei propri quattro quarti; se anche quella è pari, la partita finisce in pareggio.
- **Campo rovesciato** assegna il quarto al totale più basso. Se un solo lato ha carte, la regola generale assegna comunque il quarto a quel lato.

### Legge delle tinture

Metalli: **oro** e **argento**. Colori: **rosso, azzurro, verde, nero**. Ogni carta, tranne la prima del proprio lato in quel quarto, prende **+1** se la propria tintura è di classe opposta a quella della carta propria giocata immediatamente prima nello stesso quarto. L'ordine è l'ordine di posa. La prima carta non riceve bonus.

### Campi

| Campo | Effetto |
|---|---|
| Campo d'oro | Carte d'oro +1 |
| Campo di rosso | Carte rosse +1 |
| Campo d'azzurro | Carte azzurre +2 |
| Campo di verde | Carte verdi +2 |
| Campo di nero | Carte nere +1; carte d'argento −1 |
| Campo d'argento | Il quarto vale 2 corone |
| Campo stretto | Massimo 2 carte per lato nel quarto |
| Campo rovesciato | Vince il totale più basso |

### Carte attuali

| Bestia | Forza | Tintura | Abilità |
|---|---:|---|---|
| Leone | 6 | Oro | **Solitario:** +2 se è l'unica tua carta nel suo quarto |
| Aquila | 4 | Nero | **Rapace:** +1 per ogni carta avversaria nel suo quarto |
| Serpe | 2 | Verde | **Veleno:** −1 a ogni carta avversaria nel suo quarto |
| Drago | 8 | Rosso | **Tiranno:** −2 a ogni altra tua carta nel suo quarto |
| Cervo | 3 | Verde | **Concordia:** +1 a ogni altra tua carta nel suo quarto |
| Unicorno | 3 | Argento | **Purezza:** +3 se il lato avversario del quarto è vuoto |
| Lupo | 3 | Nero | **Assedio:** +3 se l'avversario ha più carte di te nel quarto |
| Delfino | 3 | Azzurro | **Marea:** +2 nei quarti III e IV |
| Gallo | 2 | Rosso | **Vigilia:** +2 nei quarti I e II |
| Cigno | 1 | Argento | **Grazia:** +1 a ogni tua carta nei quarti confinanti |
| Gufo | 2 | Azzurro | **Presagio:** −1 a ogni carta avversaria nei quarti confinanti |
| Torre | 1 | Oro | **Bastione:** il suo quarto vale una corona in più |

La forza delle carte è ricalcolata dal tabellone ogni volta: abilità, campo e tinture possono quindi modificare anche carte posate in precedenza. La forza individuale non scende sotto zero.

## Lettura del bilanciamento attuale

- **Drago è un picco molto alto:** forza 8 più potenziale bonus di campo e tintura. Il malus alle proprie compagne lo rende situazionale, ma spesso il valore base basta a vincere da solo. La sua potenza può inoltre scoraggiare la costruzione di un quarto.
- **Torre somma punti di vittoria senza dover vincere il quarto:** ogni Torre alza di uno il premio per entrambi, ma chi conquista il quarto raccoglie tutte quelle corone. È un moltiplicatore ad alto impatto, specialmente sul Campo d'argento.
- **Cigno e Gufo influenzano quarti vicini** e possono cambiare un risultato lontano; il testo delle carte dice “ogni carta”, ma chiarirei che si tratta rispettivamente delle proprie e delle avversarie. Il motore applica il bonus/malus una volta per ogni carta di supporto adiacente.
- **Serpe** abbassa tutte le carte nemiche dello stesso quarto, mentre **Cervo** e **Drago** scalano con il numero di compagni. Questo rende la densità delle carte una scelta di rischio/ricompensa.
- **Il campo rovesciato** è una regola controintuitiva: la conquista automatica quando il lato avversario è vuoto prevale sull'inversione. Va dichiarata esplicitamente nell'interfaccia.
- La legge delle tinture favorisce pianificare una sequenza: il bonus dipende dalla carta propria immediatamente precedente, non da tutte le carte presenti. Questo dettaglio è strategico ma non è esplicito nelle regole a schermo.
- Ogni bestia è unica nel mazzo e sei delle dodici carte vengono giocate; la varianza di mano è significativa. Non aggiungerei nuove carte senza un formato che mantenga partite brevi e riconoscibili.

## Ritocchi consigliati al regolamento

1. Esplicitare nel testo della legge delle tinture “rispetto alla tua carta giocata più di recente in quel quarto”.
2. Scrivere sul Campo rovesciato: “vince il totale minore; se un solo lato ha carte, quel lato conquista il quarto”.
3. Chiarire la Torre come “+1 corona al premio del quarto; la corona aggiuntiva va a chi conquista il quarto”.
4. Specificare sulle abilità ad area “tue” / “avversarie” e il confine dei quarti (un lato di piega in comune).
5. Nel codice/UI sostituire l'indicazione statica `Mazzo: 8` con il conteggio derivato dal mazzo; il mazzo contiene 12 carte e all'inizio ne restano 8 dopo le quattro pescate.

## Espansione proposta: *Le Case del Crepuscolo*

### Intento e formato

Aggiungere **quattro bestie** (un terzo del catalogo attuale) che introducono controllo, scelta tattica e interazione con i campi, senza aggiungere risorse o fasi. Per preservare il ritmo: ogni mazzo contiene una copia di ciascuna bestia, si continua a pescare quattro carte e a giocare sei turni. Questo offre più varietà di pesca e abbassa la probabilità di vedere una carta specifica; va quindi trattato come modulo di prova. Se la probabilità di accesso alle carte caratterizzanti cala troppo, usare un mazzo selezionato di 12 carte per partita (8 originali + 4 espansione), senza duplicati.

### Nuove carte

| Bestia | Forza | Tintura | Abilità proposta |
|---|---:|---|---|
| **Volpe** | 3 | Rosso | **Astuzia:** quando viene posata, se nel quarto ci sono già carte avversarie, +2. Non si attiva se la Volpe è la prima carta del quarto. |
| **Tasso** | 2 | Nero | **Tenacia:** la sua forza non può essere ridotta da abilità avversarie. Campi e legge delle tinture la modificano normalmente. |
| **Fenice** | 2 | Oro | **Rinascita:** se il quarto viene conquistato dall'avversario, la Fenice ottiene +3 forza. Effetto calcolato sul risultato corrente; non cambia chi ha giocato carte. |
| **Pavone** | 2 | Argento | **Ostentazione:** se è la prima tua carta nel quarto, aggiunge +1 corona al premio se tu conquisti quel quarto. Non aumenta il premio per l'avversario. |

Le nuove abilità usano condizioni osservabili e non cambiano l'ordine di risoluzione. Pavone adotta un'eccezione alla Torre, ma la rende personale e condizionata: valutarne la leggibilità con un indicatore di corone per lato.

### Meccanica opzionale: Editto

Per una seconda iterazione, introdurre un solo **Editto** per partita: all'inizio del turno II, III o IV il giocatore può dichiararlo insieme alla carta. L'Editto non occupa un quarto né una carta.

- **Editto di concordia:** la prossima carta giocata nel quarto scelto ignora la legge delle tinture.
- **Editto di contesa:** il quarto scelto vale una corona aggiuntiva, assegnata solo se il giocatore che ha dichiarato l'Editto conquista quel quarto.

Nel prototipo partirei con un solo Editto fisso, non una scelta tra due: **Contesa**, dichiarato simultaneamente alla mossa, +1 corona personale sul quarto scelto se conquistato. Va testato separatamente dalle quattro carte, perché aggiunge una risorsa di tempismo e riduce la semplicità del gioco base.

## Piano di bilanciamento e playtest

### Prima versione da provare

Per isolare le cause, testare in quest'ordine:

1. Partita attuale con le sole correzioni di chiarezza, senza variazioni numeriche.
2. Drago a **7** forza (da 8), lasciando invariato il suo malus.
3. Torre a **2** forza (da 1), mantenendo +1 corona al premio.
4. Espansione con le quattro carte, senza Editto.
5. Solo dopo, Editto Contesa.

Non applicare i cambiamenti di forza e l'Editto tutti insieme: le partite devono poter indicare quale regola crea uno squilibrio.

### Protocollo leggero

- Registrare almeno **200 partite simulate per configurazione** con seed diversi; poi fare almeno 20 partite umane per verificare chiarezza e scelte non catturate dall'AI.
- Per ogni bestia annotare frequenza di pesca, frequenza di gioco, percentuale di vittorie dei quarti in cui è presente e corone medie generate. Separare i dati per campo.
- Per lato controllare percentuale di vittoria complessiva, corone medie, pareggi e frequenza di quarti contesi. Una differenza stabile oltre 5 punti percentuali tra le parti richiede diagnosi, tenendo conto che l'AI attuale usa una ricerca euristica semplice.
- Controllare casi limite: forza zero, quarto senza carte, campo rovesciato, campo stretto pieno, supporti su quarti adiacenti, più Torri e pareggio sulle corone.
- Non bilanciare solo sulle vittorie AI contro AI: `choose()` valuta una mossa alla volta, non la risposta simultanea e strategica dell'avversario; i dati sono indicativi, non una misura definitiva del meta umano.

### Criteri per accettare una modifica

- Le nuove abilità sono leggibili senza consultare una FAQ.
- Nessuna singola carta determina da sola una quota sproporzionata di partite o corone.
- I quattro campi speciali restano opzioni praticabili; Campo stretto e rovesciato non producono partite decise automaticamente dalla pesca.
- L'editto, se mantenuto, crea decisioni di tempismo e non diventa una scelta obbligatoria ogni turno.
- Si conserva la durata di sei turni e la valutazione deterministica dei punteggi.

## Stato dell'implementazione

Implementato in `public/designs/blasone`: le quattro carte dell'espansione, con mazzo da 16 (una copia per bestia), e i ritocchi di chiarezza 1–5. L'Editto non è implementato, come previsto dal piano.

Simulazioni AI contro AI (`node scripts/blasone-sim.js`, 400–2000 partite per configurazione):

- **Drago 7 e Torre 2 non cambiano il quadro.** Il Drago a 8 vince il 51% delle partite in cui è giocato, la Torre il 40% in entrambe le versioni. I valori restano 8 e 1. Il dato vale per l'AI attuale, che non sa proteggere un quarto con la Torre: va ricontrollato con partite umane.
- **Valori delle nuove carte ritoccati sui dati.** Il Tasso a 2 era quasi inutile (giocato 8%, partite vinte 37%) e passa a **4**. La Fenice passa a **3** (44% → 52%) e il Pavone a **3** (42% → 46%). La Volpe resta a 3 (49%).
- Con questi valori le sedici bestie stanno tra il 37% (Torre) e il 55% (Aquila, Gufo) di partite vinte quando giocate. I due lati restano al 49% ciascuno.
- **Fenice:** il +3 si applica se il quarto, calcolato senza Rinascita, andrebbe all'avversario. Sul Campo rovesciato quel +3 peggiora il totale: è voluto, e il testo della carta lo lascia leggere.
- **Volpe:** ogni carta posata ricorda il turno di posa (`at`). Le carte avversarie posate nello stesso turno, simultaneamente, non attivano l'Astuzia.

## Note d'implementazione

- Per le nuove carte aggiornare `BEASTS`, le condizioni in `evaluate()` e l'elenco di nomi/grafica. Ogni abilità deve essere calcolabile dal solo stato finale del tabellone, coerentemente con l'engine attuale.
- Le abilità che dipendono dal fatto che una carta sia stata “appena posata” o dall'esito di una contesa richiedono invece dati persistenti per turno; evitarle nella prima versione.
- Per Fenice, calcolare la condizione dopo i normali modificatori, in modo da non introdurre dipendenze circolari: prima si determina il totale senza Rinascita, poi si applica il +3 se il proprietario risulta sotto.
- Per Editto servono campi di stato nella mossa registrata e nella partita; non inserirlo nello stesso rilascio delle carte finché i test separati non ne dimostrano il valore.
