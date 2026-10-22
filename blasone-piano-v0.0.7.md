# Blasone — piano versione 0.0.7

**Versione di partenza:** 0.0.6  
**Stato:** implementata (vedi «Esito dell'implementazione» in fondo)  
**Obiettivo:** aggiungere due modalità con struttura di partita diversa, una nuova casata di quattro carte e una meccanica di draft, mantenendo intatti i formati Classico e Crepuscolo.

## Punto di partenza

La 0.0.6 ha aggiunto il codice partita riproducibile, il feedback locale, il riepilogo per quarto, la transizione di fine partita, le rifiniture di accessibilità e l'audit degli input. Resta da raccogliere il feedback umano previsto per verificare le venti carte e l'Editto. La 0.0.7 non deve nascondere o aggirare questo lavoro: le modalità nuove saranno isolate e i valori delle carte esistenti resteranno invariati salvo evidenze ripetibili.

## Contenuto proposto

### Modalità nuova: Draft delle Casate

Una partita competitiva in cui i giocatori compongono una parte del proprio mazzo prima del duello.

- Ogni partecipante riceve otto carte scoperte e sceglie una carta per volta, alternandosi con il Conte finché entrambi hanno quattro scelte.
- Le quattro carte scelte entrano nel mazzo insieme a dodici carte di base distribuite secondo regole fisse, per un totale di sedici senza doppioni.
- Seguono le regole normali: quattro carte iniziali, sei turni, campi casuali e scelte simultanee.
- L'interfaccia mostra quali carte sono ancora selezionabili e spiega la scelta dell'AI dopo il draft. Il draft deve avere seed riproducibile.
- Editto attivo o disattivo resta una preferenza indipendente, come nelle modalità esistenti.

**Scopo di design:** dare controllo sulla composizione del mazzo e rendere le nuove carte accessibili senza aumentare il catalogo pescabile in ogni singola partita.

**Criteri di accettazione:** draft completabile da tastiera e tocco; mai più di una copia per bestia; stessa sequenza riprodotta con lo stesso codice partita; Classico e Crepuscolo continuano a creare esattamente le partite attuali.

### Modalità nuova: Prove dell'Araldo

Modalità a scenari brevi contro il Conte, senza pesca casuale. Ogni prova presenta una situazione preparata e un obiettivo specifico.

- Ogni scenario definisce campi, carte già sullo scudo, mani, turno e obiettivo.
- Gli obiettivi possono essere “conquista il Campo d'argento”, “termina con almeno 4 corone”, “difendi due quarti di capo” o “vinci il Campo rovesciato”.
- Una prova dura da uno a tre turni e si completa quando l'obiettivo viene verificato dall'engine.
- Ogni prova include un suggerimento facoltativo e una spiegazione finale delle mosse decisive.
- Il primo pacchetto contiene sei prove: due introduttive, due intermedie e due avanzate. Le prove insegnano, tra gli altri, tinture, quarti confinanti, Editto e campi speciali.

**Scopo di design:** offrire partite brevi e didattiche che facciano capire le interazioni del gioco, non un'altra campagna narrativa.

**Criteri di accettazione:** scenari deterministici e ripetibili; il completamento dell'obiettivo non dipende da una valutazione testuale; ogni prova ha almeno una soluzione valida e non richiede una carta non presente nella mano.

## Nuova meccanica: Draft e carte con Reazione

Il draft è la meccanica distintiva della modalità omonima. In aggiunta, la nuova casata introduce **Reazione**: l'abilità si attiva quando l'avversario posa una carta in un quarto che contiene già la bestia con Reazione. Per evitare ambiguità, la reazione si risolve dopo la rivelazione simultanea e una sola volta per carta e turno; non può innescare altre reazioni.

Regole comuni per Reazione:

- si controlla dopo aver posato entrambe le carte del turno;
- i requisiti si valutano sullo stato risultante dalla posa simultanea;
- l'effetto è immediato e il suo modificatore resta visibile nel riepilogo;
- ogni abilità deve avere un bersaglio e un limite numerico espliciti.

## Nuova casata: Compagnia delle Veglie

Quattro candidate per la modalità Draft e per il formato Crepuscolo. I valori sono ipotesi di playtest, non bilanciamento definitivo.

| Bestia | Forza | Tintura | Abilità proposta |
|---|---:|---|---|
| **Grifone** | 4 | Oro | **Custode:** +1 se, all'inizio del turno in cui è posato, controlli un quarto confinante. Il controllo si fotografa prima delle mosse simultanee. |
| **Basilisco** | 3 | Verde | **Sguardo:** Reazione. Se l'avversario posa nel suo quarto, la nuova carta avversaria perde 2 forza per questo quarto. Una sola attivazione per turno. |
| **Balena** | 4 | Azzurro | **Corrente:** +1 per ogni quarto confinante in cui hai almeno una carta; massimo +2. Il bonus si ricalcola dal tabellone. |
| **Arpia** | 3 | Nero | **Rimprovero:** Reazione. Quando l'avversario posa nel suo quarto, la sua carta non riceve il bonus della legge delle tinture in quel turno. Non rimuove bonus di campo o altre abilità. |

Il Basilisco e l'Arpia sperimentano Reazione con effetti circoscritti alla carta appena posata, così non riscrivono retroattivamente tutto il tabellone. Se i test mostrano che la finestra di attivazione è difficile da spiegare, sostituire Reazione con un effetto statico prima di ampliare il catalogo.

## Proposta di composizione dei mazzi

- **Classico:** resta invariato e non contiene la nuova casata.
- **Crepuscolo:** resta la selezione casuale di sedici carte dal catalogo; le quattro nuove entrano nel pool solo dopo la fase di test.
- **Draft delle Casate:** sceglie esplicitamente quattro carte; il resto del mazzo è formato da dodici carte fisse e comuni ai due lati. Definire la lista comune e i criteri di selezione prima di implementare, per non favorire una casata.
- **Prove dell'Araldo:** usa solo carte e configurazioni esplicitamente dichiarate nello scenario.

## Sicurezza, accessibilità e compatibilità

- Conservare i controlli della 0.0.6: validare input, seed e configurazioni ai confini; trattare preferenze e dati caricati come non fidati; codificare l'output nel contesto; non inserire input come HTML eseguibile.
- Il draft accetta solo identificativi di bestie appartenenti alla lista offerta, senza duplicati e con numero massimo di scelte fissato dall'engine. Il client non è la fonte autorevole per validare la composizione.
- Gli scenari sono dati interni versionati, non markup fornito dal giocatore. Validare comunque al caricamento campi, carte, turni e obiettivi.
- Tutte le azioni sono utilizzabili da tastiera e touch; focus, annunci e movimento ridotto restano coerenti con le modalità esistenti.
- La partita conclusa mantiene la transizione dolce della 0.0.6; gli scenari conclusi aprono il risultato dopo aver mostrato l'ultima mossa.

## Piano di lavoro e verifiche

1. **Prove dell'Araldo:** definire e verificare i sei scenari; convalidare obiettivi e almeno una soluzione per scenario.
2. **Draft:** finalizzare il pool e il formato da sedici carte; poi aggiungere selezione AI, seed riproducibile e riepilogo delle scelte.
3. **Casata e Reazione:** implementare le quattro candidate solo dopo aver fissato l'ordine di risoluzione; mostrare ogni attivazione nel dettaglio della carta.
4. **Bilanciamento:** simulare separatamente Draft e Crepuscolo con seed diversi; misurare frequenza di pesca/uso, vittorie dei quarti, corone e partite. Aggiungere partite umane e confrontare le percezioni sulle abilità reattive.
5. **Regressione:** verificare che Classico resti invariato a parità di seed e che i codici delle partite 0.0.6 non cambino semantica. I codici precedenti devono continuare a rigiocare la stessa modalità e le stesse mosse.
6. **Audit sicurezza:** aggiungere alla matrice 0.0.6 input del draft e dati degli scenari; provare identificativi sconosciuti, liste duplicate, liste troppo lunghe, obiettivi invalidi e preferenze/manipolazioni URL.

## Cosa non fare nella 0.0.7

- Non aggiungere una quinta casata o nuove carte oltre alle quattro candidate.
- Non cambiare i valori delle venti carte attuali senza i riscontri umani e una motivazione registrata.
- Non aggiungere rete, account, telemetria o contenuti scenario modificabili dall'utente.
- Non mescolare nel formato Classico le carte nuove.

## Registro versioni

| Versione | Stato | Ambito |
|---|---|---|
| 0.0.5 | Implementata | Menu, bestiario, formati, espansione delle Fiere ed Editto. |
| 0.0.6 | Implementata | Riepilogo, transizione di fine partita, feedback locale, accessibilità e audit degli input. |
| 0.0.7 | Implementata | Draft delle Casate, Prove dell'Araldo, quattro carte della Compagnia delle Veglie e meccanica Reazione. |

## Esito dell'implementazione (0.0.7)

### Decisioni prese dove il piano lasciava aperto

| Punto | Decisione | Perché |
|---|---|---|
| Lista comune del Draft | Le dodici carte del Bestiario, uguali per i due lati. Le otto offerte vengono dalle altre tre casate (Crepuscolo, Fiere, Veglie), estratte a sorte dal seed. | Il Bestiario è la base che tutti conoscono; il draft si fa solo sulle espansioni, quattro carte per casata, e nessuna casata è favorita nella lista fissa. |
| Ordine delle scelte | Tu, Conte, Conte, Tu, Tu, Conte, Conte, Tu (ABBAABBA). | Il vantaggio della prima scelta è compensato dalle due che seguono. In simulazione: 49% a 49%. |
| Scelta del Conte | Sceglie la bestia rimasta con la quota più alta di quarti vinti (`RATE`, misurata su 6000 partite Draft con scelte a caso), con lo stesso rumore dello stile del Conte. | La spiegazione si può dire in una riga e si verifica: «la più forte rimasta: vince il 58% dei quarti in cui è giocata», oppure «una scelta d'istinto». |
| Crepuscolo | Resta sulle venti carte delle prime tre casate, con una lista fissa. | Il piano tiene le Veglie fuori dal Crepuscolo fino ai test. La lista fissa garantisce anche che i codici 0.0.6 del Crepuscolo restino identici. |
| Prove: durata | Ogni prova comincia al turno IV, V o VI e finisce dopo il VI: da uno a tre turni. | La partita finisce come sempre e non serve un contatore di turni diverso. |
| Prove: Conte | Gioca senza rumore e con la mano scoperta. | Scenari deterministici: una prova risponde sempre allo stesso modo alle stesse mosse. Vederne la mano la rende un problema da risolvere, non una scommessa. |
| Prove: obiettivi | Tre tipi verificati dall'engine (`goalMet()`): quarti da conquistare, corone minime, vittoria. | Il completamento non dipende da testo. |
| Codici | `d` per il Draft (`77-dnp`), `prova-N` per le prove. `?codice=` nell'URL apre un codice. | I codici 0.0.6 (`c`, `r`) non cambiano significato. Il parametro rende una partita condivisibile con un link. |

### Scostamenti dal piano

- **Grifone: nuova abilità.** La «Custode» proposta (+1 se all'inizio del turno controlli un quarto confinante) era identica alla Custodia dell'Orso, già nelle Fiere. Diventa: **+2 se controlli entrambi i quarti confinanti**, ricalcolato dal tabellone. L'engine fa un secondo passaggio quando c'è un Grifone, ed è esatto, perché la forza in un quarto non cambia chi tiene un altro quarto.
- **Immagini.** Grifone, Basilisco e Arpia non hanno un'emoji propria. Il Grifone è composto da un'aquila 🦅 sopra un corpo felino 🐈, come nell'araldica. Il Basilisco è un gallo 🐓 con la coda di serpe 🐍, come il basilisco araldico. L'Arpia è l'uccello nero 🐦‍⬛, la Balena 🐋. L'incisione fonde le parti in un'unica silhouette.
- **Reazione permanente.** «In quel turno» (Arpia) e «per questo quarto» (Basilisco) diventano effetti permanenti sulle carte posate dopo, perché lo scudo si ricalcola sempre dal tabellone. Un effetto limitato a un turno sparirebbe dal riepilogo finale e sarebbe più difficile da spiegare. «Già nel quarto» significa posata in un turno precedente: una carta posata nello stesso turno non fa scattare la Reazione. Le reazioni non si innescano a catena, e il Tasso le ignora come le altre riduzioni avversarie.
- **Arpia a forza 4** invece di 3. A 3 vinceva il 40% delle partite in cui era giocata, a 4 il 45%, nella fascia di Pavone, Lupo e Unicorno.
- **AI e Reazione.** Il Conte valutava solo il tabellone immediato e quasi non giocava Basilisco e Arpia (5% e 4% delle partite). `watch()` ora aggiunge una piccola stima del valore futuro di una Reazione dove l'avversario ha ancora posto. Con questa stima vengono giocati nel 16-17% delle partite, quanto le altre carte delle espansioni. Classico e Crepuscolo non contengono quelle carte e restano identici.

### Bilanciamento (simulazioni, `node scripts/blasone-sim.js draft 3000`)

| Carta | Pescata | Giocata | Quarto vinto | Partita vinta |
|---|---:|---:|---:|---:|
| Grifone | 20% | 14% | 54% | 52% |
| Basilisco | 19% | 16% | 55% | 49% |
| Balena | 20% | 17% | 58% | 57% |
| Arpia | 19% | 17% | 45% | 45% |

Tu 49%, Conte 49%, pari 2%. Le altre otto carte del draft restano tra il 45% e il 51% di partite vinte. La Balena è la più forte delle quattro e va tenuta d'occhio nei riscontri umani. Nessun valore delle venti carte esistenti è cambiato.

### Prove dell'Araldo (`node scripts/blasone-prove.js`)

Il risolutore gioca ogni sequenza delle tue mosse, con e senza Editto, contro le risposte fisse del Conte.

| N. | Prova | Livello | Insegna | Turni | Linee vincenti |
|---|---|---|---|---:|---:|
| 1 | Metallo su colore | Introduttiva | legge delle tinture | 1 | 1 su 12 |
| 2 | Oltre la piega | Introduttiva | quarti confinanti, Campo stretto | 1 | 4 su 9 |
| 3 | Il mondo alla rovescia | Intermedia | Campo rovesciato, quarti con un solo lato | 2 | 10 su 180 |
| 4 | L'Editto | Intermedia | Editto, Campo d'argento | 2 | 46 su 576 |
| 5 | Lo sguardo | Avanzata | Reazione (Basilisco, Arpia), Tasso | 2 | 7 su 192 |
| 6 | Tre mosse | Avanzata | Fenice, Balena, spareggio sulla forza | 3 | 31 su 1224 |

Nella prova 4 senza Editto si arriva al massimo a 5 corone e con l'Editto a 6, che è l'obiettivo. Ogni prova usa solo carte dichiarate nello scenario. Ogni soluzione usa solo carte della tua mano.

### Audit di sicurezza (aggiunte alla matrice 0.0.6)

| Ingresso | Rischio | Difesa | Prova |
|---|---|---|---|
| Scelta del draft | id sconosciuto, `__proto__`, bestia non offerta, già presa, oggetto al posto della stringa, scelta fuori turno, quinta scelta | `pick()` accetta solo una stringa presente in `draftLeft()` e solo nel turno giusto. È l'engine a validare, non il pulsante. | 9 controlli in `blasone-check/engine.js` |
| Dati delle prove | bestia sconosciuta o doppia, troppe carte nel quarto, turno o mano fuori dai limiti, campo sconosciuto, obiettivo sconosciuto o vuoto, testo non stringa | `validTrial()` al caricamento; una prova non valida non parte (`create` restituisce `null`) e la pagina apre una partita normale. | 16 scenari manomessi rifiutati |
| `?codice=` | markup, prova inesistente (`prova-99`) | Passa per `parseCode()` come il campo del menu; un codice non valido viene ignorato. | pagina con `?codice=prova-99` e `?seed=<script>` |
| `blasone.prove` (localStorage) | valori estranei, doppioni, markup | Solo interi validi, una volta ciascuno, letti da JSON lungo meno di 100 caratteri. Il primo salvataggio riscrive l'elenco pulito. | pagina con `[1,"x",99,1,-0.5,{…},"<img …>"]` |
| Testi delle prove | markup nei dati interni | I testi sono dati versionati e passano comunque da `textContent` o `esc()`. | revisione del codice |

### Accessibilità

- Le carte del draft sono pulsanti nativi, raggiungibili con Tab e attivabili con Invio o Spazio.
- Dopo ogni scelta il focus va alla prossima carta libera. A draft concluso va su «Al duello», e poi sulla prima carta della mano.
- Le risposte del Conte sono annunciate in una riga `aria-live`.
- Nelle prove il suggerimento è un pulsante con `aria-expanded`. La mano scoperta del Conte è un elenco leggibile.
- Il risultato di una prova arriva dopo l'ultima mossa con la stessa transizione della 0.0.6, e senza movimento se è ridotto.

### Bug corretto

«Nuova partita» nel riepilogo finale passava l'evento del clic come codice partita. La nuova partita usava sempre il seed 0 e andava in errore alla prima mossa. Ora il pulsante apre una partita con le opzioni del menu, e in una prova la ricomincia.

### Verifiche eseguite

- `node scripts/blasone-check.js`: 99 controlli OK, tra engine in node e pagine in Chrome headless. Coprono:
  - Classico e Crepuscolo identici alla 0.0.6 su 240 partite (engine `b643f40` letto da git).
  - Draft e prove completi, da tastiera e da clic.
  - Riproducibilità del draft con lo stesso codice.
  - Regole delle quattro carte nuove.
  - Input manomessi.
- `node scripts/blasone-prove.js`: le sei prove sono valide, deterministiche e risolvibili.
- `npm run check:responsive`: 224 ok, 0 FAIL.
- Screenshot desktop e 390 px: foglio del draft, riepilogo del draft, prova in corso, esito di una prova, bestiario con le nuove incisioni.

### Resta da fare

- Partite umane: Draft e Reazione vanno provati da persone, con la scheda di riscontro. Le domande da fare: la finestra «posata dopo» si capisce? La Balena è troppo forte?
- Le Veglie entrano nel Crepuscolo solo dopo quei riscontri, come previsto dal piano.
