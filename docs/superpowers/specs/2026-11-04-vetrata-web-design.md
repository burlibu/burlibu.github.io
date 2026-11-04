# Vetrata: come funziona il web, dal browser al database

Design del 2026-11-04. Nuovo design per `public/designs/vetrata`, route `/vetrata`.

## Perché

Il corso SAW (UniGe, Ribaudo, a.a. 2026/27) è, parole della docente, una "cavalcata" tra tecnologie dove è facile perdersi. Ogni argomento preso da solo non è difficile. Quello che manca è vedere come stanno insieme.

Il pubblico è uno studente che deve capire PHP, JavaScript e lo stack. La domanda a cui la pagina deve rispondere sempre è **"dove gira questa riga, e quando?"**. Il momento chiave è il confine: il browser "vede cosa produce lo script ma non come arriva al risultato" (slide PHP 1).

## Obiettivi

- Seguire una sola storia dall'URL all'aggiornamento senza ricaricare: `pippo` fa login su `saw.dibris.unige.it`.
- In ogni fase mostrare anche i dettagli veri: funzioni, superglobali, header, codici di stato. **Richiesta esplicita dell'autore.**
- Scena 3D in three.js, nello **stile C "Vetrata"** scelto dall'autore tra tre prove dal vivo.
- Far provare allo studente cosa si rompe, oltre a farglielo leggere.

## Non obiettivi

- Nessun PHP o MySQL reale: il sito sta su GitHub Pages, quindi tutto è simulato in modo deterministico nel browser. Lo si dichiara nella pagina.
- Nessun corso completo di PHP o JS: niente sintassi di base, CSS in dettaglio, regex, mappe, accessibilità.
- Nessun account o salvataggio remoto.

## Anti-obiettivi (fallimento anche se funziona)

- Bello ma impreciso: una funzione o un header sbagliati valgono più di qualunque effetto.
- Schema generico "client, freccia, server" senza righe vere.
- Muri di testo che coprono la scena, o scena decorativa scollegata dal testo.
- Copia di Saltwake: da quel riferimento si prendono carta, inchiostro, onde, cornice e tipografia, non immagini, testi, marchio o composizione.

## Stile: Vetrata

Fusione decisa dall'autore tra Apple glass e il riferimento pergamena.

- **Carta e inchiostro:** fondo `#e6e0cf`, inchiostro `#16130e`, cornice nera spessa arrotondata, titoli Goudy Bookletter 1911 stretti (`-.045em`), occhiello Sorts Mill Goudy spaziato, bottoni Josefin Sans.
- **Vetro:** `MeshPhysicalMaterial` con trasmissione reale, colorato per assorbimento, con contorno a inchiostro come il piombo di una vetrata (guscio gonfiato `BackSide`, marcato `transparent` così resta fuori dal passaggio di trasmissione, tecnica già provata).
- **Pannelli:** vetro colorato DOM (`backdrop-filter`) con bordo a piombo, angoli quasi vivi.
- **La rete è il mare:** le onde a inchiostro sono una texture canvas viva dietro al vetro, quindi il vetro le deforma davvero. Stanno tra le due rive, client e server, e il pacchetto le attraversa.
- **Luce:** ogni lastra proietta il suo colore sulla carta, e la macchia segue la lastra.

Miglioramenti rispetto alla prova:

1. **Un colore per tecnologia, ovunque.** Nella prova gli stessi colori erano usati due volte, cosa didatticamente sbagliata. HTML ambra, CSS rosso, JS verde acqua, Apache ardesia, PHP prugna, MySQL verde, HTTP carta, cookie oro. Lo stesso colore appare su lastre, chip di codice, sottolineature nel testo e nel riepilogo.
2. **Ripresa unica.** La camera si muove lungo un percorso continuo tra le fasi, senza stacchi, ed entra negli oggetti: le lastre del server si aprono mentre ci passa in mezzo.
3. **La finestra che si compone.** Dietro la scena c'è una grande vetrata con 8 scomparti spenti. Ogni fase completata ne accende uno. Alla fine la camera arretra e la finestra è la mappa completa dello stack: premio e riepilogo sono la stessa immagine.
4. **Il pacchetto si apre.** In volo è una busta di vetro. Fermata, esplode in lastrine: riga iniziale, header, corpo.

## La storia: 8 fasi

Le voci segnate `+` non stanno nelle slide lette e vengono dal manuale PHP o da MDN: la pagina le marca "oltre le slide".

| # | Fase | Cosa si vede | Dettagli obbligatori | Rompilo |
|---|------|--------------|----------------------|---------|
| 1 | L'indirizzo | L'URL si scompone, il DNS risponde con un IP | schema, host, porta, percorso; DNS | Dominio inesistente: nessuna richiesta parte |
| 2 | La connessione | Handshake TCP, canale TLS come tubo di vetro | TCP, porta 443 e 80, TLS | Pagina in `http://`: tutto leggibile sul filo |
| 3 | La richiesta | Parte la `GET`, la busta si apre | `GET /login.php HTTP/1.1`, `Host:`, `User-Agent:`, `Accept:`; verbi; stateless | Percorso errato: `404 Not Found` |
| 4 | Il server | Apache riconosce `.php`, chiama PHP. **Il codice evapora, esce solo HTML** | DocumentRoot, `<?php ?>`, `echo`, `$_SERVER`, `200 OK`, `Content-Type:` | Errore nello script: `500` |
| 5 | Il browser | HTML diventa albero DOM di tesserine, CSS colora, JS parte | `document`, `getElementById`, `querySelectorAll`, `addEventListener`, bubbling, `event.target` | Script prima dell'elemento: `null` |
| 6 | L'invio | Il form parte in POST e arriva nel server, poi nel DB | `submit`, `preventDefault()`, `value`, `name`, urlencoded, `$_POST`, `+mysqli_prepare`, `+password_verify` | Campi vuoti bloccati sul client; validazione solo client aggirata da una richiesta diretta |
| 7 | La memoria | HTTP dimentica, il cookie torna da solo a ogni richiesta | `session_start()`, `$_SESSION`, `setcookie()`, `Set-Cookie:`, `Cookie:`, `Expires`, `Secure`, `HttpOnly`, `SameSite`, `document.cookie`, `+session_set_cookie_params()` | Cookie disattivati: il server non ti riconosce. Via `HttpOnly`: JS legge il cookie |
| 8 | L'API | `fetch` senza ricaricare, cambia un solo nodo del DOM | `fetch(url, options)`, Promise e i suoi 3 stati, `.then/.catch`, `Response.ok`, `.status`, `.json()`, `JSON.stringify/parse`, `innerHTML`, `+php://input`, `+json_decode/json_encode`, REST, CORS, `Access-Control-Allow-Origin` | `404`: la Promise è comunque fulfilled, `ok` è false. Altra origine senza header: il browser blocca |

**Precisione oltre le slide.** Dove le slide semplificano o inciampano, la pagina lo dice con garbo e non copia l'errore:

- L'esempio `.then(function(response){ response.json(); })` in JS 5 manca di `return`: la catena riceve `undefined`.
- `session_start()` non imposta `Secure` e `HttpOnly` da solo: servono configurazione o `session_set_cookie_params()`. La prova visiva lo sottintendeva e va corretta.
- Un body JSON non riempie `$_POST`: serve `php://input`.

## Come si impara

Ogni fase ha tre livelli, senza cambiare pagina:

1. **Storia:** due o tre frasi. Basta per seguire.
2. **Funzioni:** chip colorati. Un clic mostra cosa fa, cosa riceve, cosa ritorna, un esempio di una riga, e **illumina nella scena il pezzo dove gira**. Vale anche al contrario: clic su una lastra e si vedono le sue funzioni in quella fase.
3. **Sul filo:** il testo esatto che viaggia, HTTP grezzo o JSON.

Più tre strumenti:

- **Rompilo:** un interruttore per fase (tabella sopra) che cambia davvero scena, codici e testo. È il cuore didattico.
- **Dove gira?** Una domanda a fine fase: mostra una riga di codice, si risponde Client, Rete, Server o Database, con spiegazione se si sbaglia. Accende lo scomparto della finestra, ma si può sempre andare avanti.
- **Riepilogo:** a fine percorso, tutte le funzioni raggruppate per luogo, con filtro testuale, stampabile, ogni voce porta alla sua fase.

**Username vivo:** il campo del form si può modificare e il valore compare nei byte della POST, in `$_POST`, nella query e nel JSON. Solo `pippo` entra. Tutto inserito con `textContent`, mai come HTML.

## Controlli e layout

- **Navigazione:** bottone a pillola, frecce della tastiera, striscia delle 8 fasi a piombo, link diretti `#fase/3`. Nessun dirottamento dello scroll, perché il pannello deve poter scorrere.
- **Sopra i 900px:** scena a tutto schermo nella cornice, pannello di vetro laterale.
- **Sotto i 900px:** scena in alto, pannello a foglio in basso, trascinabile. Nessuno scroll orizzontale.
- **Senza WebGL:** tutto il testo, i livelli e le domande restano nel DOM e funzionano, con un'illustrazione statica al posto della scena.
- **Ridotta animazione:** stacchi al posto dei movimenti, onde ferme.
- **Tastiera e screen reader:** chip e lastre hanno equivalenti in bottoni DOM reali; il canvas è `aria-hidden`.

## Come è fatto

Scelte dell'autore: three.js, stile C, contenuto basato sulle slide SAW, esempio del login.

Scelte mie (correggibili):

- **Design statico in `public/designs/vetrata/`**, come gli altri, per avere iframe, tile e `preview.js` gratis.
- **three r179 copiato in `vendor/`** (build min e soli addon usati, circa 750 KB) con importmap: nessun design statico usa three oggi e non voglio dipendere da un CDN per l'unica cosa indispensabile.
- **File:** `story.js` (dati DOM-free: fasi, funzioni, domande, varianti Rompilo), `scene.js` (three), `script.js` (interfaccia), `style.css`, `index.html`.
- **Controllo:** `scripts/vetrata-check.js` verifica in node che ogni chip punti a un oggetto di scena esistente, ogni domanda abbia una risposta valida e ogni Rompilo abbia i suoi testi.
- **`mysqli`** per gli esempi con il database: le slide MySQL non sono su Drive. Da allineare appena arrivano.
- **Avanzamento** in localStorage sotto `vetrata.fasi`, validato al caricamento.
- **Prestazioni:** pixel ratio massimo 1,5, rendering solo se visibile; se per 2 secondi il frame supera 40 ms, il vetro passa a materiale trasparente semplice. La qualità scende, il contenuto no.
- **`?preview`:** un'inquadratura fissa della vetrata, una busta in volo, massimo 15 fps.
- **Nella home:** nuova voce in `more`, `<Route>`, `ROUTES` in `scripts/responsive-test.html`, paragrafo in `CLAUDE.md`.

Da verificare in tempo reale (rAF non gira con `--virtual-time-budget`), come per `fcq` e `dispatch`, più `npm run check:responsive` e `CI=true npm run build`.

## Lasciato a chi costruisce

Percorso esatto della camera, testi definitivi in italiano, disegno degli oggetti e dei dati finti, domande precise purché tocchino il confine client, rete, server.
