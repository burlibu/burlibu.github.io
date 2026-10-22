# Blasone — repertorio di nuove meccaniche e carte

Raccolta di idee per possibili aggiornamenti futuri. Sono proposte da esplorare, non regole approvate né valori bilanciati. Le idee tengono conto del motore attuale: sei turni simultanei, quattro quarti, campi, tinture, casate, abilità ricalcolate dal tabellone, alcune carte con dati registrati al momento della posa e l'Editto opzionale.

## Principi per scegliere le idee

- Una carta deve avere una regola spiegabile in una frase e un risultato verificabile sul tabellone.
- Specificare sempre quando si controlla una condizione: prima delle mosse del turno, dopo la rivelazione simultanea o alla fine della partita.
- Le abilità che dipendono dal momento della posa devono conservare il turno sulla carta; non ricostruirlo dall'ordine del DOM o da animazioni.
- Se una carta può muoversi, definire quali proprietà conserva, dove può arrivare, quando si muove e se può muoversi più di una volta.
- Preferire modificatori con limiti espliciti e senza catene di attivazioni.
- Provare ogni regola nuova da sola prima di combinarla con espansioni o cambi di forza.

## Idee aritmetiche: pari e dispari

### 1. Forza stampata pari/dispari

Condizione semplice e stabile: controllare il valore stampato sulla carta, non la sua forza modificata.

- **Aritmetica:** +2 se la forza stampata è pari.
- **Contrasto:** +2 se la forza stampata è dispari.
- **Doppia lettura:** +1 se la forza stampata della carta avversaria più recente nello stesso quarto ha parità opposta.

**Pro:** immediata, non crea dipendenze circolari, dà valore a carte normalmente considerate solo in base alla forza.  
**Rischio:** la parità stampata diventa un'etichetta ulteriore da ricordare. Mostrare il bonus come icona e testo esplicito.

### 2. Parità del turno

Le carte si attivano in base al numero del turno: +2 nei turni pari, oppure +2 nei turni dispari. Il turno va letto dal dato `at` registrato alla posa.

**Pro:** premia pianificare quando giocare una carta, non solo dove.  
**Rischio:** il valore della carta dipende dalla mano pescata e la finestra di gioco è stretta. Usare bonus piccoli e non dare +2 a una carta già molto forte.

### 3. Parità del numero di carte

Una bestia ottiene +1 se il numero delle proprie carte nel quarto è pari, oppure penalizza l'avversario se il numero delle sue carte è dispari.

La regola va calcolata sul numero finale di carte nel quarto; la condizione può cambiare quando viene posata o spostata una carta. Nessuna carta deve modificare quel conteggio come effetto collaterale.

### 4. Totale pari/dispari senza circolarità

Una carta potrebbe reagire alla parità del **totale base stampato** delle proprie carte nel quarto, senza includere modificatori. Evitare la formulazione “se la forza totale è pari”: i modificatori stessi possono cambiare la parità e rendere l'ordine di calcolo poco chiaro.

## Idee sul tempo e sull'ordine di posa

### 5. Primogenitura e chiusura

- **Primogenito:** +2 se è la prima tua carta posata nel quarto.
- **Ultimo suggello:** +2 se è la tua ultima carta giocata della partita e viene posata in un quarto conteso.
- **Sentinella:** +1 se è stata posata prima di tutte le carte avversarie del quarto.

La prima carta è facile da verificare. L'ultima carta della partita può creare un momento drammatico ma rischia di diventare una scelta obbligata: testarla senza bonus di corona.

### 6. Finestra di turno

- **Alba:** bonus nei turni I–II.
- **Mezzogiorno:** bonus nei turni III–IV.
- **Crepuscolo:** bonus nei turni V–VI.
- **Scadenza:** la carta perde un punto dopo il turno in cui è stata posata.

Le carte restano sul tabellone, ma il loro valore può crescere o decadere con il torneo. L'interfaccia deve mostrare il modificatore attivo e il turno in cui cambierà.

### 7. Ritmo di posa

Premiare una sequenza, ad esempio: +1 se la carta propria più recente nello stesso quarto è stata giocata nel turno immediatamente precedente. Questa è una catena di continuità, diversa dalla legge delle tinture.

Per evitarne l'accumulo, il bonus si applica solo alla carta che verifica la sequenza; non aumenta a ogni carta successiva.

### 8. Ingresso in un quarto già occupato

Un'abilità può distinguere tra carta posata in un quarto vuoto, già presidiato da alleati o già conteso dall'avversario. Volpe e Cinghiale coprono già alcune condizioni d'ingresso: nuove versioni dovrebbero cambiare il risultato, non duplicare il semplice “avversario già presente”.

Possibili varianti: bonus se il quarto era vuoto per entrambi prima della posa; bonus se arriva per ultima in un quarto con almeno due carte avversarie; malus se entra in un quarto già pieno di alleati.

## Idee per muovere carte

Il movimento è interessante perché trasforma il tabellone da scelta di collocazione a scelta di posizionamento nel tempo. È anche la famiglia più rischiosa: può riaprire quarti pieni, cambiare tinture e modificare più risultati in una sola azione.

### 9. Migrazione: movimento come mossa del turno

Invece di giocare una carta dalla mano, una volta per partita si può spostare una propria carta già sullo scudo in un quarto confinante. Il movimento consuma la mossa del turno.

- La destinazione deve avere uno spazio legale.
- La carta conserva il turno originale di posa e i dati fissati all'ingresso (per esempio la Custodia dell'Orso).
- La posizione aggiornata cambia campo, vicinanze e legge delle tinture secondo il nuovo ordine di posa nel quarto.
- Le abilità registrate all'ingresso non si ricalcolano; quelle dinamiche si ricalcolano.

**Vantaggio:** il costo è chiaro e la mossa può salvare una carta o ribaltare un quarto.  
**Rischio:** lascia una carta in mano non giocata e richiede una UI diversa. È la prima variante di movimento da prototipare.

### 10. Movimento di una carta con parola chiave

Una carta con **Nomade** può spostarsi una sola volta, in un turno successivo a quello in cui è stata giocata. Il movimento prende il posto della carta che il giocatore avrebbe giocato dalla mano quel turno.

Questa regola limita la mobilità alla carta descritta e conserva la struttura di sei decisioni per giocatore. Non permettere movimento e posa nello stesso turno nella prima versione.

### 11. Richiamo e riposizionamento

Una carta può tornare in mano e venire rigiocata altrove. Sconsigliata per la prima prova: riapre problemi su tinture, bonus di ingresso, carte già giocate, ordine e limiti del quarto. Se testata, deve essere un potere unico, una sola volta e con costo esplicito, ad esempio rinunciare alla pesca del turno.

### 12. Spostamento dell'avversario

Forzare una carta nemica a muoversi può essere tatticamente ricco ma frustrante, soprattutto se annulla un'abilità o cambia una maggioranza già conquistata. Da evitare finché le regole di movimento volontario non sono stabili. Eventuale versione prudente: scegliere tra due quarti adiacenti, solo se entrambi hanno spazio, senza mai scegliere un quarto pieno.

## Altre meccaniche sistemiche

### 13. Scommessa sul quarto

Una carta può dichiarare un quarto “conteso”: se il suo lato lo conquista, ottiene +1 corona personale; se lo perde, la carta perde 2 forza. A differenza dell'Editto, la scommessa è associata alla carta e può essere scelta in modo leggibile prima della rivelazione.

**Attenzione:** potrebbe sovrapporsi all'Editto. Usarla solo se il feedback dice che l'Editto è chiaro ma manca una scelta legata alla mano.

### 14. Scudo o riserva

Una carta può proteggere un'altra carta dagli effetti negativi per un solo punto, oppure conservare un bonus inutilizzato fino al turno successivo. Limitare la protezione a una fonte e rendere visibile quale malus è stato annullato; altrimenti l'interazione tra Serpe, Gufo, Drago e Scorpione diventa difficile da leggere.

### 15. Dominio per maggioranza di casata

Se un giocatore ha più casate rappresentate dell'avversario nel quarto, ottiene un piccolo bonus. È diverso dalla Rivalità, che premia una casata speculare, ma può favorire chi possiede più varietà nel pool. Va limitato a +1 e attivato solo da una carta specifica, non come regola globale iniziale.

### 16. Campo che cambia a metà torneo

Un campo potrebbe cambiare regola dal turno IV: per esempio un Campo d'oro diventa Campo di rosso. Il cambiamento interessa entrambe le parti e si applica alle carte già posate. È molto leggibile se annunciato all'inizio, ma altera i calcoli già fatti; sperimentarlo come scenario o modalità, non mescolarlo subito ai campi casuali.

### 17. Obiettivo pubblico di torneo

All'inizio della partita si rivela un obiettivo comune, per esempio “il primo quarto conquistato in punta vale una corona aggiuntiva” o “la prima casata presente su entrambi i lati riceve un sigillo”. Obiettivo identico per entrambi e visibile prima della prima mossa.

Può dare una direzione alla partita senza aggiungere altre carte, ma va distinto dalle corone dell'Editto, del Pavone e della Torre nel riepilogo.

## Idee di carte candidate

Valori indicativi; nomi, tinture e numeri vanno verificati rispetto alle carte già presenti prima di inserirli nel catalogo.

| Carta | Forza/tintura proposta | Concetto | Regola esplorativa |
|---|---|---|---|
| **Gazza** | 2, nero | Parità | +2 se la forza stampata è pari; usa la forza base, non quella modificata. |
| **Cavalletta** | 2, verde | Turno | +2 nei turni pari in cui viene posata. |
| **Cicogna** | 3, argento | Primogenitura | +2 se è la prima tua carta del quarto. |
| **Lepre** | 3, rosso | Chiusura | +2 se giocata nel turno VI in un quarto conteso. |
| **Salice** | 1, verde | Ritmo | +1 se la tua carta precedente nello stesso quarto è stata posata nel turno prima. |
| **Nomade** | 3, azzurro | Movimento | Può migrare una volta, usando la mossa di un turno futuro al posto di una posa dalla mano. |
| **Ariete** | 4, oro | Scommessa | Può dichiarare il quarto; +1 corona se lo conquista, −2 forza se lo perde. |
| **Civetta delle Ore** | 2, argento | Finestra | +1 nei turni I–II, +2 in III–IV, +1 in V–VI; bonus stampato sul riepilogo. |

Non inserire tutte le carte insieme: Gazza/Cavalletta/Cicogna/Lepre coprono già quattro idee temporali o aritmetiche. Nomade e Ariete dovrebbero essere provate come moduli separati.

## Sequenza di prototipazione consigliata

1. **Prova aritmetica:** implementare solo Gazza, con forza base pari, e verificare l'interfaccia della parità.
2. **Prova temporale:** aggiungere una carta che controlla il turno di posa, confrontando turni pari/dispari e alba/crepuscolo.
3. **Prova del movimento:** prototipare Nomade come mossa sostitutiva, non come azione gratuita; verificare campi, quarti pieni, tinture e abilità fissate alla posa.
4. **Prova con giocatori:** osservare se la regola è ricordata senza consultare il bestiario e se la scelta sembra interessante anziché obbligata.
5. **Decisione di formato:** solo dopo i risultati scegliere se la meccanica entra in una casata, in una modalità sperimentale o resta esclusiva di scenari.

## Raccomandazione iniziale

Ordine di priorità: **turno pari/dispari**, poi **prima/ultima carta**, infine **movimento sostitutivo**. La parità e il momento della posa si innestano sui dati che il motore già conserva e sono relativamente semplici da spiegare. Il movimento offre più profondità, ma va trattato come prototipo separato perché cambia il flusso delle mosse e ricalcola effetti di posizione.

Per il primo rilascio sceglierei una sola nuova casata di quattro carte: due basate sul tempo/parità, una sulla primogenitura e una Nomade sperimentale. Non introdurrei contemporaneamente spostamenti forzati, campi dinamici e obiettivi pubblici.
