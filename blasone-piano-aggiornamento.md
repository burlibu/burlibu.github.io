# Blasone — piano per il prossimo aggiornamento

**Stato:** approvato e implementato il 22 ottobre 2026; l'esito è nella sezione finale.

## Stato attuale

Blasone è un duello contro il Conte di Sable: sei turni simultanei, quattro quarti con campi variabili, sedici bestie e una mano iniziale di quattro carte. Ogni lato gioca sei carte e pesca fino al quinto turno. Il punteggio ricalcola dal tabellone tinture, campi e abilità; la partita si decide sulle corone, poi sulla forza totale.

L'ultimo aggiornamento, del 22 ottobre 2026, ha aggiunto l'espansione **Le Case del Crepuscolo** (Volpe, Tasso, Fenice e Pavone), il mazzo da sedici carte e la consultazione delle carte già posate con il dettaglio dei modificatori. Il piano di bilanciamento precedente riporta simulazioni AI contro AI: Drago 8 e Torre 1 sono rimasti invariati; Tasso è salito da 2 a 4, Fenice da 2 a 3 e Pavone da 2 a 3; le sedici bestie risultano tra il 37% e il 55% di vittorie nelle partite in cui sono giocate, con vittorie complessive dei lati al 49% ciascuno. Sono dati utili per orientarsi, ma l'AI euristica non rappresenta un avversario umano.

## Valutazione

### Cosa funziona

- Le regole si appoggiano a un engine separato dall'interfaccia e i punteggi sono ricalcolabili: è una buona base per nuove carte e riepiloghi trasparenti.
- La consultazione delle carte sullo scudo e il dettaglio della forza rispondono a un problema concreto di leggibilità introdotto dalle abilità e dai modificatori.
- Le regole chiariscono già alcuni casi spigolosi, come il Campo rovesciato, il bonus delle Torri e la legge delle tinture.
- L'espansione recente non ha aggiunto fasi né risorse e mantiene la partita breve.

### Attriti UX da affrontare

- Le azioni principali sono nella testata, ma non c'è un menu compatto che raccolga impostazioni e consultazione del bestiario.
- Le regole sono un unico foglio testuale: manca un tutorial breve e contestuale per la prima partita.
- I dettagli delle carte posate sono consultabili, ma non c'è una vista completa del catalogo né un riepilogo finale che spieghi quali quarti e abilità hanno deciso la partita.
- La scelta carta-poi-quarto è intuitiva dopo averla imparata, ma l'interfaccia può rendere più evidente la selezione, i quarti legali e l'esito della mossa simultanea, soprattutto su schermi piccoli e da tastiera.

### Punto di attenzione sul bilanciamento

Il mazzo è cresciuto da 12 a 16 carte mentre mano iniziale e numero di turni sono rimasti uguali. Ogni lato vede al massimo nove carte nel corso della partita, quindi l'accesso alle bestie specifiche è meno prevedibile. La prossima espansione dovrebbe essere modulare o accompagnata da una scelta di composizione del mazzo; aggiungere carte a un unico mazzo senza compensazione ridurrebbe ancora la frequenza con cui si vedono quelle esistenti.

## Aggiornamento proposto

### 1. Menu Opzioni e miglioramenti UX

Aggiungere un pulsante **Menu** nella testata che apre un pannello accessibile da mouse, tocco e tastiera. Il pannello raccoglie:

- **Nuova partita**, con conferma solo se una partita è già in corso.
- **Regole rapide**, in schede brevi: turno, campi, tinture, corone e casi speciali.
- **Bestiario**, con tutte le sedici carte, forza, tintura e abilità; filtro per tintura e ricerca per nome.
- **Presentazione:** animazioni attive/ridotte e dimensione del testo. Rispettare anche l'impostazione di movimento ridotto del sistema.
- **Conte:** scelta tra stile prudente, standard e variabile. La difficoltà modifica solo il livello di rumore decisionale dell'AI, senza alterare regole o carte; il comportamento di ciascuna opzione sarà descritto chiaramente.

Nel tabellone, evidenziare i quarti selezionabili dopo aver scelto una carta, rendere annullabile la sola selezione prima della posa e presentare la risposta del Conte con un breve stato “Mosse rivelate”. Nel riepilogo di fine partita mostrare corone, quarti conquistati e contributi personali di Torre e Pavone. Rendere queste informazioni leggibili senza dipendere solo dal colore e mantenere focus e tastiera coerenti nei pannelli.

### 2. Formato di partita per la prossima espansione

Preparare il gioco a una terza casata senza aumentare subito la durata. Proposta: **formato a scelta**, con modalità “Classico” (le 16 carte attuali) e “Crepuscolo” (selezione casuale di 16 carte dal catalogo ampliato, senza doppioni). In entrambe restano quattro carte iniziali, sei turni e le stesse regole base. Così si possono introdurre nuove carte senza portare il mazzo oltre 16 né rendere ogni carta più rara.

Nuove carte candidate, da rifinire e simulare prima di inserirle:

| Bestia | Valore iniziale | Tintura | Abilità proposta |
|---|---:|---|---|
| Grifone | 4 | Oro | **Custodia:** +1 se controlli già un quarto adiacente. |
| Salamandra | 3 | Rosso | **Brace:** +2 sul Campo d'oro o sul Campo di rosso. |
| Cinghiale | 3 | Nero | **Impeto:** +2 se, al momento della posa, il quarto contiene già carte avversarie. Le carte posate simultaneamente non contano. |
| Manticora | 5 | Verde | **Famelica:** −1 a ogni altra tua carta nel quarto. |

I valori sono ipotesi iniziali, non un bilanciamento approvato. Custodia apre una scelta tra quarti collegati; Brace crea sinergie leggibili coi campi; Impeto premia l'ingresso in una contesa; Famelica offre un nuovo rischio/ricompensa di densità. Per Custodia e Impeto, registrare il turno di posa o determinare il controllo precedente in modo non ambiguo, mantenendo la risoluzione simultanea.

### 3. Meccanica opzionale: Editto

Solo dopo aver valutato le carte, provare un **Editto Contesa** una volta per partita: insieme alla carta, il giocatore può segnare un quarto; se lo conquista, ottiene una corona personale aggiuntiva. L'Editto non occupa una carta e non cambia il conteggio dei turni. Va introdotto come regola opzionale, con indicatore visibile del suo stato e un riepilogo del bonus. Se risulta poco leggibile o rende automatico il momento d'uso, rimane fuori dal formato principale.

## Sequenza di lavoro e criteri di accettazione

1. **UX senza modifiche alle regole:** menu, bestiario, regole rapide, selezione più chiara e riepilogo partita. Criterio: si può consultare il potere di ogni carta e capire perché si è vinto senza uscire dalla partita.
2. **Formato e carte candidate:** selezione del formato e quattro carte nuove. Criterio: nessuna carta compare due volte; la modalità Classica resta identica; i quarti legali e i modificatori sono sempre spiegati.
3. **Taratura:** simulare separatamente Classico, Crepuscolo e ciascuna variazione numerica, con seed riproducibili. Registrare frequenza di pesca/gioco, vittorie dei quarti e delle partite, corone per carta, campi e percentuale di quarti contesi. Affiancare partite umane prima di cambiare valori in modo definitivo.
4. **Editto, come esperimento separato:** confrontare partite con e senza Editto e verificare che nessun lato o turno ottenga un vantaggio stabile.

Accettare una carta solo se la sua abilità si capisce nel bestiario e nel dettaglio sul tabellone, non crea casi circolari nell'engine e non porta a un vantaggio persistente quando la si pesca. I dati AI sono indicativi: per decidere il rilascio servono anche riscontri di partite umane.

## Fuori ambito per questo aggiornamento

Partite online, campagne, nuove risorse, mazzi più lunghi e revisione dei valori delle sedici carte esistenti. Eventuali problemi numerici emersi dalle simulazioni si affrontano con modifiche isolate e motivazione registrata.

## Approvazione richiesta

Confermare o modificare il perimetro: menu e UX; formato a scelta con quattro carte candidate; Editto opzionale e separato. Dopo l'approvazione, implementazione e ribilanciamento potranno essere pianificati per fasi.

## Esito dell'implementazione

Implementate tutte e quattro le fasi in `public/designs/blasone`.

- **Menu:** finestra nativa con le schede Partita, Regole, Bestiario, Presentazione e Conte. Le scelte restano salvate nel browser. Dimensione del testo come zoom della pagina (100/115/130%), perché il foglio di stile usa misure in px.
- **Tabellone:** i quarti pieni si attenuano con la scritta "Pieno". La selezione si annulla con Esc o col bottone "Annulla scelta". Da tastiera il focus passa al primo quarto libero. Dopo ogni turno compare la riga "Mosse rivelate". Il riepilogo finale mostra quarti, corone (base, Torri, Pavone, Editto) e i tre effetti che hanno pesato di più per lato.
- **Mano su mobile:** sotto i 720px le quattro carte stanno affiancate e intere, in versione compatta.
- **Formati:** Classico (le 16 carte di prima) e Crepuscolo (16 estratte dalle 20 del catalogo, lo stesso mazzo per i due lati). Su 300 partite simulate, Classico gioca identico al motore precedente a parità di seed.
- **Carte candidate, con due sostituzioni:** Grifone e Manticora non hanno un'emoji da incidere, quindi le stesse abilità vanno all'**Orso** (Custodia) e allo **Scorpione** (Famelica). Il Cinghiale (Impeto) premia la prima carta posata nel quarto, perché la versione proposta duplicava la Volpe. La Custodia dell'Orso si fissa al momento della posa, sui quarti controllati a fine turno precedente, per evitare dipendenze circolari.
- **Taratura** (`node scripts/blasone-sim.js crepuscolo 3000`): Orso 50%, Scorpione 47%, Cinghiale 46%, Salamandra 46% di partite vinte quando giocate, nella fascia delle carte esistenti (37–58%). I valori iniziali restano invariati. I due lati vincono il 49% ciascuno.
- **Conte:** prudente (rumore 0, vince il 55% contro l'AI standard), standard (0,35, 50%), variabile (2, 40%).
- **Editto:** regola opzionale, dichiarata sul quarto in cui posi la carta, dal turno II. L'AI lo usa su un quarto conteso che tiene con margine dal turno IV, oppure all'ultimo turno. Su 1000 partite i lati restano al 49% ciascuno e gli usi si distribuiscono sui turni IV/V/VI (37/23/40%), senza un momento obbligato.

Restano da fare le partite umane, prima di considerare definitivi i valori delle quattro Fiere e il formato dell'Editto.
