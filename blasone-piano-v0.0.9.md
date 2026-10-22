# Blasone — piano versione 0.0.9

**Versione di partenza:** 0.0.8  
**Stato:** proposta  
**Modalità proposta:** *Duello tra Araldi*, partita locale per due persone sullo stesso dispositivo.

## Obiettivo

Permettere a due persone di giocare una partita completa senza il Conte, mantenendo la regola centrale delle mosse simultanee e senza aggiungere carte o modificare i valori esistenti. La nuova modalità riusa campi, casate, Rivalità, Editto e regole del formato scelto, purché siano stati implementati e stabilizzati nelle versioni precedenti.

## Flusso di partita

1. Nel menu partita si sceglie **Duello tra Araldi** e il formato disponibile: Classico, Crepuscolo oppure Draft se il draft è già stato rilasciato.
2. Ogni giocatore riceve la propria mano privata di quattro carte e gioca sei turni, con le pescate previste dalle regole del formato.
3. Al proprio turno, il primo giocatore sceglie carta e quarto. La selezione viene conservata senza mostrarla sul tabellone.
4. Compare una schermata di passaggio che invita a cedere il dispositivo. L'altro giocatore conferma di essere pronto e seleziona la propria mossa senza poter vedere la prima.
5. Solo dopo entrambe le conferme le carte vengono rivelate insieme, posate e valutate. La cronaca registra entrambe le mosse nello stesso turno.
6. Al termine del sesto turno si mostra il riepilogo già previsto, con l'ultima mossa visibile prima della transizione graduale.

Le mani sono private durante la selezione dell'avversario. Le regole di vittoria e i punteggi restano identici al formato scelto.

## Requisiti di interfaccia

- La schermata di passaggio copre completamente mano, carta selezionata, quarto scelto e ogni indicatore che possa rivelare la mossa nascosta.
- Il giocatore che ha concluso la selezione non può correggerla dopo averla confermata; prima della conferma deve poter annullare e scegliere di nuovo.
- La selezione dell'altro giocatore non modifica né rivela lo stato visibile al primo fino alla rivelazione simultanea.
- Ogni lato è identificato chiaramente come **Araldo I** e **Araldo II**; nessun nome libero è necessario nella prima versione.
- Le mani devono essere leggibili da tastiera e touch. Il flusso di passaggio deve avere focus coerente e istruzioni accessibili.
- La cronaca e il riepilogo indicano quale araldo ha giocato ogni carta, senza esporre la mano residua dell'altro giocatore durante la partita.

## Sicurezza e limiti della modalità locale

- La modalità è pensata per passare il dispositivo tra giocatori fidati; non è una modalità online né una garanzia contro chi ispeziona strumenti di sviluppo o memoria locale.
- Evitare di inserire nel DOM visibile i dettagli della mossa nascosta fino alla rivelazione. Quando si passa il dispositivo, la schermata di copertura deve nascondere anche contenuti accessibili e tooltip, non solo elementi visivi.
- Ogni azione deve essere validata nell'engine: carta effettivamente in mano al lato attivo, quarto legale, turno corretto e nessuna seconda conferma della stessa mossa.
- Trattare codice partita, impostazioni salvate e scelte di formato come input non fidati, secondo l'audit introdotto in 0.0.6.
- Non salvare in chiaro le mani o le mosse non ancora rivelate nella cronologia esportabile o nella scheda di feedback.

## Bilanciamento e compatibilità

- Nessun cambiamento di forza, abilità, campo o condizione di vittoria è previsto.
- Il Conte e le modalità esistenti restano invariate.
- La scelta del formato avviene prima della partita; i due lati condividono l'insieme di carte ammesso, ma ricevono mani e mazzi separati come previsto dal motore.
- Se la Rivalità di Casata o altre regole introdotte in 0.0.8 non risultano ancora stabili, il Duello tra Araldi può essere rilasciato prima senza quelle regole solo come modalità Classica/Crepuscolo, dichiarando la compatibilità nel menu.

## Piano di verifica

1. Provare il passaggio del dispositivo su schermi piccoli, grandi e con zoom; verificare che non resti visibile alcun dettaglio della prima mossa.
2. Provare annullamento prima della conferma, doppio clic, tasto Invio ripetuto, Esc e quarti pieni; nessuna mossa deve essere accettata due volte o fuori turno.
3. Confrontare partite con seed e mosse prefissate rispetto al motore corrente: stesso tabellone, stessi modificatori, stessi vincitori e stesse corone.
4. Provare tastiera, screen reader, movimento ridotto e ripristino del focus tra le due mani e il riepilogo.
5. Verificare che feedback, esportazione e codice partita non contengano la mossa di un giocatore prima della rivelazione.
6. Aggiornare l'audit di sicurezza con i nuovi stati temporanei e le transizioni di turno.

## Criteri di accettazione

- Due persone possono completare sei turni sullo stesso dispositivo senza che la prima mossa sia rivelata all'altro prima della conferma.
- Le mosse vengono rivelate insieme e producono risultati identici all'engine per la medesima configurazione.
- Nessuna mano o mossa nascosta appare nella schermata di passaggio, nell'albero accessibile, nei tooltip o negli export prima della rivelazione.
- Le partite contro il Conte e gli altri formati mantengono il comportamento precedente.
- L'ultima mossa è mostrata prima del riepilogo, con la transizione morbida e il comportamento per movimento ridotto già definiti.

## Fuori ambito

- Gioco online, matchmaking, account o sincronizzazione tra dispositivi.
- Chat, profili, classifiche o statistiche condivise.
- Nuove carte o nuove abilità.
- Modifiche al bilanciamento delle modalità esistenti.

## Registro versioni

| Versione | Stato | Ambito |
|---|---|---|
| 0.0.5 | Implementata | Menu, bestiario, formati, Fiere ed Editto. |
| 0.0.6 | Implementata | Feedback locale, riepilogo consultabile, fine partita graduale, accessibilità e audit degli input. |
| 0.0.7 | Pianificata | Draft delle Casate, Prove dell'Araldo, Compagnia delle Veglie e Reazione. |
| 0.0.8 | Pianificata | Compagnia dei Confini, Rivalità di Casata e quattro bestie. |
| 0.0.9 | Pianificata | Duello locale per due persone con mosse nascoste e rivelazione simultanea. |
