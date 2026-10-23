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

---

## Nuove proposte: sinergie di tintura e condizioni sull'avversario

Queste idee ampliano il modo in cui le carte leggono il proprio quarto. Per il calcolo, “stesso colore” dovrebbe significare **stessa tintura esatta** (oro, argento, rosso, azzurro, verde o nero), a meno che una carta non specifichi “stesso colore” escludendo i metalli.

### 18. Compagnia cromatica

**Esempio:** “+2 forza per ogni altra tua carta della stessa tintura in questo quarto.”

È una sinergia forte e facile da capire. Il numero può crescere rapidamente se più carte si potenziano a vicenda: quattro carte dello stesso colore potrebbero guadagnare +6 ciascuna se la regola fosse generale. Meglio introdurla come abilità di una singola carta e provare una di queste versioni:

- +2 per ogni altra carta alleata della stessa tintura, **massimo +4**;
- +2 se hai almeno un'altra carta della stessa tintura;
- +1 per ogni altra carta della stessa tintura, senza limite, solo in una modalità sperimentale.

Il bonus va calcolato una volta dal conteggio delle altre carte, senza catene ricorsive. La prima versione è quella più esplosiva e richiede un cap visibile.

### 19. Assenza di un colore avversario

**Esempio:** “+2 se l'avversario non possiede carte verdi in questo quarto.”

La condizione si verifica sul quarto corrente dopo la rivelazione simultanea. Va specificato se il bonus è +2 una sola volta o per ogni carta verde mancante: la proposta consigliata è **+2 una sola volta se il numero è zero**. La condizione si ricalcola quando arrivano nuove carte o quando una carta si sposta.

Varianti possibili:

- +2 se l'avversario non ha carte della tintura indicata;
- +1 per ogni tintura diversa rappresentata tra le tue carte, massimo +3;
- −1 alla carta avversaria più forte se in quel quarto non ha alleati della stessa tintura.

Evitare carte che controllano “nessuna carta verde nell'intera partita”: una condizione locale è leggibile e più controllabile.

### 20. Repertorio di carte cromatiche

| Carta candidata | Forza/tintura | Abilità da provare |
|---|---|---|
| **Cardellino** | 2, oro | **Stormo:** +2 per ogni altra tua carta d'oro nel quarto, massimo +4. |
| **Salamandra pallida** | 2, argento | **Campo netto:** +2 se l'avversario non ha carte rosse nel quarto. |
| **Gambero** | 3, rosso | **Specchio:** +2 se l'avversario non ha carte della sua tintura nel quarto. |
| **Tessitore** | 2, verde | **Trama:** +1 a ciascuna delle tue carte verdi nel quarto; il modificatore totale per carta è limitato a +2. |

I nomi sono provvisori e vanno controllati contro il catalogo effettivo prima di usarli. Tessitore è un effetto ad area: per non creare loop, il bonus dipende soltanto dal numero di carte verdi, non dalla loro forza.

## Nuove categorie di creature

Oltre alla casata, ogni bestia potrebbe avere una **famiglia** o **ambito**: Volante, Marino, Terrestre, Mitico, Costrutto. La casata risponde a “chi appartiene insieme”; la categoria risponde a “che tipo di creatura è”. Sono due dimensioni diverse e devono essere mostrate separatamente nella carta.

### 21. Famiglie possibili

- **Volante:** aquila, gallo, cigno, gufo e future creature alate.
- **Marino:** delfino, lontra, balena, foca e altre creature acquatiche.
- **Terrestre:** leone, cervo, lupo, tasso, orso e quadrupedi.
- **Draconico:** drago, serpe, salamandra e creature affini; valutare se sia una categoria utile o solo estetica.
- **Arcano:** unicorno, fenice, chimere e bestie magiche.
- **Costrutto:** torre e nuove sentinelle artificiali.

Meglio avere una categoria principale per carta nella prima versione. Le etichette multiple creano più combinazioni, ma moltiplicano i casi da spiegare e bilanciare.

### 22. Triade di vantaggi e vulnerabilità

Ispirazione generale ai giochi con affinità elementali e debolezze, adattata al combattimento sul territorio. Possibile ciclo di prova:

**Volante prevale su Terrestre → Terrestre prevale su Marino → Marino prevale su Volante.**

Quando nel quarto è presente almeno una carta avversaria vulnerabile alla famiglia della bestia, la bestia ottiene **+1 forza**. Se invece è la bestia a essere vulnerabile a una famiglia avversaria presente, perde **−1 forza**. L'effetto si applica una sola volta per bestia, anche con più bersagli. Non usare raddoppi, immunità o catene di debolezze nella prima prova.

Varianti più semplici:

- soltanto vantaggi, senza vulnerabilità;
- +1 al totale del quarto se la tua famiglia prevale sulla famiglia più numerosa avversaria;
- interazioni simboliche tra due sole famiglie, senza un ciclo universale.

La versione vantaggio **e** vulnerabilità è tematica ma rende una carta più dipendente dalla composizione della mano avversaria. La versione solo vantaggio è la più sicura per un primo prototipo.

### 23. Carte che introducono le famiglie

- **Albatros (Volante):** +1 se nel quarto è presente almeno una carta Terrestre avversaria.
- **Squalo (Marino):** +1 se una carta Volante avversaria è presente nel quarto.
- **Bufalo (Terrestre):** +1 se nel quarto è presente una carta Marino avversaria.
- **Araldo delle Bestie:** non combatte; riduce di uno il bonus di vantaggio dell'avversario nel suo quarto.

Usare prima le icone di famiglia nel bestiario e i testi espliciti; solo dopo un playtest riuscito introdurre una matrice riassuntiva permanente.

## Nuova meccanica: scudo del quarto

### 24. Guardia contro i malus

Una carta protettrice conferisce uno scudo al proprio quarto. Per una prima versione:

- lo scudo annulla **il primo punto di malus da abilità avversaria** applicato a ciascuna carta alleata nel quarto;
- non annulla malus di campo, regole di vittoria o modifiche al valore delle corone;
- non si accumula con un secondo scudo: il quarto può avere al massimo un livello di protezione;
- i malus annullati vengono mostrati nel dettaglio della forza (es. “Gufo −1, annullato dallo Scudo”);
- lo scudo dura finché la carta protettrice rimane nel quarto; se la carta si muove o viene rimossa, la protezione cessa.

**Rischio:** un'aura permanente può neutralizzare Serpe, Gufo e Scorpione insieme. Variante più contenuta: proteggere solo la carta protettrice, oppure annullare un solo malus complessivo per turno/quarto.

### 25. Carta candidata: Pellicano Custode

**Forza 2, argento — “Riparo”:** le tue carte in questo quarto ignorano il primo malus da abilità avversaria, massimo un punto per carta. Non protegge dal Campo di nero. È una carta di supporto; provarla contro Serpe, Gufo e Scorpione e verificare che la spiegazione dei modificatori resti comprensibile.

## Nuove modalità: durata, geometria e controllo

### 26. Grande torneo in dodici turni

La partita si divide in due tempi di sei turni. Alla fine del primo tempo si assegnano e **si conservano** le corone ottenute; poi il tabellone e i campi vengono azzerati per un secondo tempo, mantenendo il punteggio cumulativo. Vince il totale dei due tempi.

Regole da fissare nel prototipo:

- usare mazzi senza doppioni e non rimescolare nel secondo tempo;
- dopo il primo tempo distribuire una carta per riportare entrambe le mani allo stesso numero;
- generare nuovi campi per il secondo tempo;
- azzerare carte sul tabellone, conteggi di controllo e bonus del tempo precedente;
- decidere se l'Editto è uno per l'intera partita o uno per tempo. Proposta: uno per partita, così la seconda metà non raddoppia automaticamente gli effetti personali;
- in parità sulle corone cumulative, confrontare prima la forza totale del secondo tempo, poi la forza totale complessiva.

È una modalità distinta, non un semplice allungamento: il primo tempo costruisce un vantaggio bancato e il secondo offre una nuova arena per inseguire il risultato.

### 27. Presidio: premiare quanto a lungo si controlla

Non limitarsi al controllo finale: ogni volta che un giocatore guida un quarto al termine di un turno, riceve un **segnale di presidio** per quel quarto. A fine tempo:

- 1 segnale per ogni turno controllato;
- ogni 3 segnali valgono una corona aggiuntiva, massimo 2 corone per quarto;
- in caso di parità di segnali nessuno riceve il bonus di presidio;
- sui Campi rovesciati il segnale va a chi conduce secondo la regola invertita.

Versione più leggera da provare per prima: **+1 corona se hai controllato il quarto per almeno 4 turni su 6** (o 8 su 12). La soglia è più facile da leggere e limita il vantaggio valanga. Tenere distinta la corona di Presidio dalle corone per la conquista alla fine.

### 28. Arena a sei quarti

Un tabellone alternativo a **2 righe × 3 colonne**: sei quarti con quattro vicini per quelli centrali e due/tre per quelli sul bordo. La partita resta di sei turni per lato, ma ogni quarto ha limite di due carte per parte e vale una corona.

- Le abilità di capo/punta vanno sostituite da regole per riga o colonna, oppure non usate in questa modalità.
- Cigno, Gufo e Orso usano una nuova mappa di adiacenza verificata per i sei quarti.
- I campi vengono distribuiti su sei spazi; ridurre la frequenza dei campi con effetti più forti o ripetuti.
- Il maggior numero di quarti riduce la possibilità di presidiare tutto, ma può rendere i quarti isolati troppo casuali.

Partire con **sei quarti e sei turni**, non aumentare insieme dimensione e durata.

### 29. Arcipelago: quarti separati

Modalità a quattro o sei quarti con connessioni limitate: ciascun quarto è adiacente a uno o due altri, come isole unite da rotte. I supporti confinanti e le carte mobili dipendono dalla mappa scelta.

- La mappa e i collegamenti sono visibili prima della partita.
- Un obiettivo comune può premiare una coppia di quarti collegati, non solo un singolo territorio.
- La vittoria continua a dipendere dalle corone; non introdurre un nuovo obiettivo nascosto.

È un modo per dare peso alle famiglie Volante e Marino, ma non attribuire loro movimento gratuito nella prima versione.

## Ispirazioni da altri generi, tradotte in regole originali

- **Giochi di controllo del territorio:** il Presidio premia mantenere una zona, non soltanto conquistarla all'ultimo istante.
- **Giochi di corsie e obiettivi:** l'arena a sei quarti crea più fronti e quarti con valori o regole diversi.
- **Giochi di carte collezionabili:** le affinità tra famiglie creano vantaggi e vulnerabilità; mantenere bonus piccoli, visibili e senza immunità assolute.
- **Deck-builder e draft:** il Draft delle Casate permette di costruire un piano prima della partita e di leggere le scelte avversarie.
- **Giochi tattici con unità mobili:** Nomade e Migrazione aprono il riposizionamento, ma ogni spostamento deve consumare una scelta e rispettare adiacenze e capienza.
- **Giochi con obiettivi a rotazione:** un obiettivo pubblico per tempo può valorizzare una zona; per ora è un modulo separato dal Presidio, così si capisce quale dei due cambia la strategia.
- **Push-your-luck:** una carta può scommettere su un quarto con ricompensa in corone e rischio di perdere forza. L'Editto esiste già, quindi questa variante deve differenziarsi legandosi alla carta.

Le ispirazioni indicano famiglie di decisioni (controllo, costruzione, movimento, rischio), non regole da copiare da un gioco specifico.

## Ordine di prova aggiornato

1. Provare **una sinergia di tintura** con limite massimo e una condizione “avversario senza tintura X”.
2. Aggiungere categorie Volante/Marino/Terrestre solo come etichette del bestiario, quindi testare un vantaggio morbido di +1.
3. Testare **Scudo** contro un solo tipo di malus, quindi contro tutti i malus ammessi.
4. Provare il **Presidio** nella versione a soglia (4 turni su 6).
5. Prototipare la partita in due tempi; solo dopo un esito positivo valutare 12 turni con conteggi di Presidio cumulativi.
6. Testare arena a sei quarti senza cambiare nello stesso prototipo anche la durata.
7. Provare Nomade e movimento come esperimento indipendente.

Non combinare nella stessa prima prova: arena a sei quarti, dodici turni, vantaggi tra famiglie, scudi cumulativi e movimento. Ognuna cambia abbastanza il valore delle carte da rendere difficile capire quale regola abbia creato un problema.
