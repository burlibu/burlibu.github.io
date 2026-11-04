// Everything the page teaches, as data. No DOM and no three.js, so scripts/vetrata-check.js
// can test it in node. scene.js reads cam, open, fx and the trips; script.js reads the text.
(function () {
  // One colour per technology: glass, chips and the summary all use these.
  const TECH = {
    http: { name: "HTTP", color: "#e9dfc4" },
    html: { name: "HTML", color: "#dd8f2c" },
    css: { name: "CSS", color: "#c2553a" },
    js: { name: "JavaScript", color: "#3a8d86" },
    apache: { name: "Apache", color: "#5f6f7c" },
    php: { name: "PHP", color: "#7d4f6b" },
    mysql: { name: "MySQL", color: "#6f8f4e" },
    cookie: { name: "Cookie", color: "#d3b13a" },
  };

  const WHERE = {
    client: "Client",
    rete: "Rete",
    server: "Server",
    database: "Database",
  };

  // Objects of the scene a chip can light up.
  const TARGETS = ["html", "css", "js", "apache", "php", "mysql", "packet", "cookie", "dns", "url", "tube", "dom"];
  // Points a trip can start from or end at.
  const ANCHORS = ["client", "dns", "apache", "php", "mysql"];
  const KINDS = ["env", "ball", "json"];

  const HOST = "saw.dibris.unige.it";
  const SID = "9f2c41d7e0";
  const IP = "203.0.113.42";

  function cleanUser(s) {
    // eslint-disable-next-line no-control-regex
    return Array.from(String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, "")).slice(0, 24).join("");
  }

  function parseHash(h) {
    if (h === "#riepilogo") return 8;
    const m = /^#fase\/([1-8])$/.exec(h || "");
    return m ? Number(m[1]) - 1 : 0;
  }

  // shortcut: progress is only a convenience, so anything unreadable just starts clean.
  function parseDone(raw) {
    let v;
    try { v = JSON.parse(raw); } catch (e) { return []; }
    if (!Array.isArray(v)) return [];
    return [...new Set(v.filter((n) => Number.isInteger(n) && n >= 0 && n < 8))];
  }

  const formBody = (user) => new URLSearchParams({ username: user, password: "pippo123!" }).toString();
  const byteLength = (s) => new TextEncoder().encode(s).length;
  const logged = (user) => user === "pippo";

  // The three sheets the GET envelope opens into: first line, headers, body.
  const sheetsGet = ["GET /login.php HTTP/1.1", `Host: ${HOST}\nAccept: text/html`, "(corpo vuoto)"];

  const PHASES = [
    {
      id: "indirizzo",
      title: "L'indirizzo",
      tint: "http",
      story: "Scrivi un indirizzo e premi Invio. Un URL è un nome, non un luogo: il browser lo scompone nelle sue parti e chiede al DNS a quale indirizzo IP corrisponde. Nessun byte è ancora arrivato al server.",
      cam: { pos: [-3.7, 1.3, 11.5], look: [-3.3, 1, 0] },
      open: { client: 0, server: 0 },
      fx: ["url"],
      chips: [
        { name: "https://", tech: "http", where: "rete", target: "url", does: "Lo schema: dice quale protocollo usare. Con https la porta implicita è la 443.", ex: "https://saw.dibris.unige.it/login.php" },
        { name: "saw.dibris.unige.it", tech: "http", where: "rete", target: "url", does: "L'host: il nome di dominio del server, che il DNS tradurrà in IP." },
        { name: "/login.php", tech: "http", where: "rete", target: "url", does: "Il percorso: quale risorsa chiedere al server. Sarà scritto nella riga iniziale della richiesta." },
        { name: "DNS", tech: "http", where: "rete", target: "dns", does: "Il servizio che traduce un nome di dominio nell'indirizzo IP del server. È un protocollo applicativo binario, diverso da HTTP.", returns: "Un indirizzo IP, o un errore se il nome non esiste" },
        { name: "window.location", tech: "js", where: "client", target: "js", extra: true, does: "Fa parte del BOM: JavaScript vi legge l'URL della pagina corrente, a pezzi.", ex: 'location.hostname  // "saw.dibris.unige.it"' },
      ],
      notes: [],
      breaks: [
        { id: "dominio", label: "Sbaglia il dominio", effect: "Il DNS non trova il nome. L'errore lo mostra il browser: nessuna richiesta HTTP parte, e il server non saprà mai che ci hai provato. Niente 404: quello può mandarlo solo un server raggiunto." },
      ],
      ask: { q: "Chi risponde a questa domanda?", code: `${HOST} → ${IP}`, answer: "rete", why: "Lo fa il DNS, un servizio di rete: né il tuo browser né il server web dell'applicazione. PHP non è ancora entrato in scena." },
    },
    {
      id: "connessione",
      title: "La connessione",
      tint: "http",
      story: "Con l'IP in mano il browser apre una connessione TCP verso la porta 443: tre messaggi, e solo dopo i due capi sanno di potersi parlare. Sopra TCP, TLS mette d'accordo le chiavi e da lì in poi tutto viaggia cifrato. Di HTTP, ancora, nemmeno una riga.",
      cam: { pos: [0, .9, 15.8], look: [0, .5, 0] },
      open: { client: 0, server: 0 },
      fx: ["tube"],
      chips: [
        { name: "SYN, SYN-ACK, ACK", tech: "http", where: "rete", target: "packet", does: "L'handshake TCP: i tre messaggi che aprono la connessione prima che venga scambiato qualsiasi dato applicativo." },
        { name: "porta 443", tech: "http", where: "rete", target: "apache", does: "La porta su cui il server ascolta HTTPS. Apache è il programma in ascolto." },
        { name: "porta 80", tech: "http", where: "rete", target: "apache", does: "La porta di HTTP non cifrato, oggi considerato insicuro." },
        { name: "TLS", tech: "http", where: "rete", target: "tube", does: "Transport Layer Security: il canale cifrato che trasforma HTTP in HTTPS. Protegge il contenuto di richieste e risposte lungo il percorso." },
      ],
      notes: [],
      breaks: [
        { id: "http", label: "Togli la S da https", effect: "Senza TLS il canale sparisce: chiunque stia sul percorso legge i byte così come sono, password compresa. Il form funziona uguale, ed è proprio questo il problema." },
      ],
      ask: { q: "Dove avviene?", code: "SYN → SYN-ACK → ACK", answer: "rete", why: "È un accordo sulla rete tra i due capi, fatto dai sistemi operativi. Né JavaScript né PHP possono vederlo: partono solo a connessione aperta." },
    },
    {
      id: "richiesta",
      title: "La richiesta",
      tint: "http",
      story: "Ora il browser scrive davvero, ed è semplice testo: una riga iniziale con metodo, percorso e versione, gli header, una riga vuota, poi l'eventuale corpo. GET chiede una risorsa senza modificare nulla. Ogni richiesta fa storia a sé: HTTP non ricorda quella prima.",
      cam: { pos: [-.3, 1.3, 15.8], look: [0, .7, 0] },
      open: { client: 0, server: 0 },
      fx: [],
      chips: [
        { name: "GET", tech: "http", where: "rete", target: "packet", does: "Metodo che chiede una risorsa e non modifica lo stato del server. Gli eventuali parametri stanno nell'URL." },
        { name: "POST, PUT, DELETE", tech: "http", where: "rete", target: "packet", does: "POST invia dati al server, PUT aggiorna o crea una risorsa, DELETE la cancella. HEAD e OPTIONS chiedono solo informazioni." },
        { name: "Host:", tech: "http", where: "rete", target: "packet", does: "Header che dice quale sito si vuole: sullo stesso IP possono vivere molti domini." },
        { name: "User-Agent:", tech: "http", where: "rete", target: "packet", does: "Header che dichiara chi fa la richiesta, di solito browser e sistema." },
        { name: "Accept:", tech: "http", where: "rete", target: "packet", does: "Header con i formati che il client accetta, in ordine di preferenza.", ex: "Accept: text/html,application/xml;q=0.9" },
        { name: "stateless", tech: "http", where: "rete", target: "apache", does: "HTTP è senza stato: il server tratta ogni richiesta indipendentemente dalle precedenti. Cookie e sessioni, alla fase 7, rimediano." },
      ],
      notes: [],
      breaks: [
        { id: "404", label: "Chiedi un percorso sbagliato", effect: "Questa volta il server è stato raggiunto, risponde e dice che la risorsa non esiste. 404 è una risposta HTTP regolare, diversa dall'errore DNS della fase 1." },
      ],
      ask: { q: "Chi scrive questa riga?", code: "Accept: text/html", answer: "client", why: "Gli header della richiesta li scrive il browser, senza che tu faccia nulla. Viaggiano poi in rete, ma nascono sul client." },
    },
    {
      id: "server",
      title: "Il server",
      tint: "php",
      story: "Apache riceve la richiesta, vede l'estensione .php e invece di spedire il file chiama l'interprete. PHP esegue lo script e scrive HTML. Il browser riceve solo quell'HTML: vede cosa produce lo script, non come ci arriva. Il codice PHP non lascia mai il server.",
      cam: { pos: [2.2, .9, 9.2], look: [2.8, .1, 0] },
      open: { client: 0, server: 1 },
      fx: ["evaporate"],
      chips: [
        { name: "DocumentRoot", tech: "apache", where: "server", target: "apache", does: "La cartella visibile dal web: Apache cerca lì i file richiesti. I dati sensibili vanno fuori da essa.", ex: 'DocumentRoot "/var/www/html"' },
        { name: ".php", tech: "apache", where: "server", target: "apache", does: "È l'estensione a far riconoscere ad Apache una pagina dinamica. Per questo i file PHP vanno sempre aperti passando dal server, mai con doppio clic." },
        { name: "<?php … ?>", tech: "php", where: "server", target: "php", does: "Delimita il codice dentro una pagina HTML. Fuori dai delimitatori, il testo passa così com'è." },
        { name: "echo", tech: "php", where: "server", target: "php", does: "Scrive sull'uscita dello script, cioè nel corpo della risposta.", ex: 'echo "<h1>Accedi</h1>";' },
        { name: "$_SERVER", tech: "php", where: "server", target: "php", does: "Superglobale con i dati del server e della richiesta in corso.", ex: "$_SERVER['REQUEST_METHOD']  // \"GET\"" },
        { name: "$_GET", tech: "php", where: "server", target: "php", does: "Superglobale con i parametri passati nell'URL." },
        { name: "200 OK", tech: "http", where: "rete", target: "packet", does: "Codice di stato. 2xx successo, 3xx reindirizzamento, 4xx errore del client, 5xx errore del server." },
        { name: "Content-Type:", tech: "http", where: "rete", target: "packet", does: "Header che dice al browser come interpretare il corpo.", ex: "Content-Type: text/html; charset=UTF-8" },
        { name: "htmlspecialchars()", tech: "php", where: "server", target: "php", extra: true, does: "Trasforma < > & e virgolette in entità prima di stamparli, così un dato dell'utente non diventa codice nella pagina.", takes: "Una stringa", returns: "La stringa con le entità" },
      ],
      notes: [],
      breaks: [
        { id: "500", label: "Inserisci un errore nello script", effect: "Lo script non si esegue e il client riceve 500 Internal Server Error, spesso con pagina vuota. Il messaggio con la riga sbagliata finisce nel log del server: anche l'errore resta sul server, se display_errors è spento." },
      ],
      ask: { q: "Dove gira questa riga?", code: 'echo "<h1>Accedi</h1>";', answer: "server", why: "PHP gira sul server. Al browser arriva solo il risultato, <h1>Accedi</h1>: con Visualizza sorgente non vedrai mai echo." },
    },
    {
      id: "browser",
      title: "Il browser",
      tint: "html",
      story: "Arriva testo HTML. Il browser lo legge dall'alto e costruisce il DOM, un albero di oggetti. I CSS ne decidono l'aspetto. Gli script partono mentre la lettura procede, o quando accade un evento. Da qui in poi il codice gira sul client, e il server non ne sa niente.",
      cam: { pos: [-2.8, .5, 10.5], look: [-2.5, .2, 0] },
      open: { client: 1, server: 0 },
      fx: ["dom"],
      chips: [
        { name: "document", tech: "js", where: "client", target: "dom", does: "La variabile globale che rappresenta la pagina come oggetto: ha proprietà, metodi ed eventi." },
        { name: "getElementById()", tech: "js", where: "client", target: "dom", does: "Trova l'elemento con quell'id.", takes: "Una stringa", returns: "L'elemento, oppure null", ex: 'let f = document.getElementById("login");' },
        { name: "querySelectorAll()", tech: "js", where: "client", target: "dom", does: "Trova tutti gli elementi che corrispondono a un selettore CSS.", takes: "Un selettore", returns: "Una lista di nodi", ex: 'document.querySelectorAll("ul.menu")' },
        { name: "addEventListener()", tech: "js", where: "client", target: "js", does: "Associa una funzione a un evento di un elemento.", takes: "Nome dell'evento e funzione", ex: 'f.addEventListener("submit", gestore);' },
        { name: "event.target", tech: "js", where: "client", target: "dom", does: "L'elemento che ha causato l'evento. Non cambia durante la risalita, mentre this è quello che sta eseguendo il gestore." },
        { name: "bubbling", tech: "js", where: "client", target: "dom", does: "Dopo il gestore del target, l'evento risale verso la radice. stopPropagation() lo ferma. Comodo per gestire molti elementi simili da un unico padre." },
        { name: "<link rel=\"stylesheet\">", tech: "css", where: "client", target: "css", does: "Collega un foglio di stile: il browser fa un'altra richiesta HTTP per scaricarlo, poi applica le regole al DOM." },
        { name: "<form>, <input>", tech: "html", where: "client", target: "html", does: "Il markup del modulo. id serve a JavaScript, name è la chiave con cui il dato viaggia verso il server." },
      ],
      notes: [],
      breaks: [
        { id: "ordine", label: "Metti lo script prima del form", effect: "Lo script gira mentre il browser legge l'HTML: il form non è ancora nell'albero, getElementById restituisce null e la riga dopo solleva un errore. Si risolve spostando lo script in fondo o con defer." },
      ],
      ask: { q: "Dove gira questa riga?", code: 'document.getElementById("login");', answer: "client", why: "Il DOM esiste solo nel browser: sul server, quando PHP scrive la pagina, non c'è ancora nessun albero." },
    },
    {
      id: "invio",
      title: "L'invio",
      tint: "mysql",
      story: "Premi Accedi. Parte l'evento submit: JavaScript può controllare i campi e fermare tutto. Se passa, il browser spedisce i campi in POST, con l'attributo name come chiave. PHP li trova in $_POST, cerca l'utente in MySQL e confronta l'hash della password. Il controllo che conta è questo: quello sul client si può aggirare.",
      cam: { pos: [.3, .6, 15.8], look: [.1, .2, 0] },
      open: { client: 0, server: .55 },
      fx: [],
      user: true,
      chips: [
        { name: "submit", tech: "js", where: "client", target: "js", does: "L'evento generato dall'invio del modulo, prima che i dati partano." },
        { name: "preventDefault()", tech: "js", where: "client", target: "js", does: "Blocca il comportamento predefinito del browser: qui, l'invio del form.", ex: "event.preventDefault();" },
        { name: ".value.trim()", tech: "js", where: "client", target: "js", does: "Legge il valore del campo e toglie gli spazi ai bordi.", returns: "Una stringa" },
        { name: "required", tech: "html", where: "client", target: "html", does: "Attributo HTML che fa la stessa validazione senza JavaScript. Anch'esso solo sul client." },
        { name: "x-www-form-urlencoded", tech: "http", where: "rete", target: "packet", does: "Il formato del corpo di un form: coppie nome=valore unite da &, con i caratteri speciali codificati. Un form HTML non può inviare JSON." },
        { name: "$_POST", tech: "php", where: "server", target: "php", does: "Superglobale con i dati ricevuti in POST, una chiave per ogni name del form. Sono dati dell'utente: non fidarti.", ex: "$_POST['username']" },
        { name: "mysqli_prepare()", tech: "php", where: "server", target: "php", extra: true, does: "Prepara una query con i segnaposto ?. Il valore viaggia separato dal testo SQL, e questo blocca la SQL injection.", takes: "Connessione e SQL", returns: "Uno statement" },
        { name: "mysqli_stmt_bind_param()", tech: "php", where: "server", target: "php", extra: true, does: "Lega i valori ai segnaposto.", ex: 'mysqli_stmt_bind_param($stmt, "s", $user);' },
        { name: "SELECT … WHERE", tech: "mysql", where: "database", target: "mysql", does: "La query cerca la riga dell'utente. Gira nel database, che è un programma separato da PHP." },
        { name: "password_verify()", tech: "php", where: "server", target: "php", extra: true, does: "Confronta la password ricevuta con l'hash salvato. Nel database non si tengono mai password in chiaro.", returns: "true o false" },
      ],
      notes: [],
      breaks: [
        { id: "vuoti", label: "Lascia i campi vuoti", effect: "Il gestore di submit chiama preventDefault: non parte niente. Nessun pacchetto, nessun carico sul server. Comodo per l'utente, ma non è sicurezza." },
        { id: "aggira", label: "Salta il browser", effect: "Con curl arrivi direttamente al server: il tuo JavaScript non è mai stato eseguito. Perciò PHP deve rifare ogni controllo, come se la validazione sul client non esistesse." },
      ],
      ask: { q: "Dove gira questa riga?", code: "$user = $_POST['username'];", answer: "server", why: "Gira sul server, ma il valore lo ha scritto l'utente sul client. Per questo è un dato da non considerare mai affidabile." },
    },
    {
      id: "memoria",
      title: "La memoria",
      tint: "cookie",
      story: "HTTP non ricorda: alla richiesta dopo, il server non saprebbe chi sei. Allora session_start() crea un identificativo, PHP tiene i dati sul server in $_SESSION e manda l'identificativo in un cookie. Il browser lo riporta da solo a ogni richiesta verso quel dominio. Nel cookie c'è solo la chiave, i dati restano sul server.",
      cam: { pos: [0, .6, 15.8], look: [0, .3, 0] },
      open: { client: 0, server: 0 },
      fx: [],
      chips: [
        { name: "session_start()", tech: "php", where: "server", target: "php", does: "Crea o riprende la sessione: se manca il cookie genera un nuovo id e prepara l'header Set-Cookie. Va chiamata prima di qualsiasi output.", extra: true },
        { name: "$_SESSION", tech: "php", where: "server", target: "php", does: "Superglobale con i dati della sessione. Vive sul server, associata all'id.", ex: "$_SESSION['user'] = 'pippo';" },
        { name: "setcookie()", tech: "php", where: "server", target: "php", extra: true, does: "Aggiunge un header Set-Cookie alla risposta. Va chiamata prima di qualsiasi output.", ex: 'setcookie("tema", "scuro", time() + 3600);' },
        { name: "session_set_cookie_params()", tech: "php", where: "server", target: "php", extra: true, does: "Imposta gli attributi del cookie di sessione. Senza configurazione, Secure e HttpOnly di norma sono spenti.", ex: "session_set_cookie_params(['secure' => true, 'httponly' => true, 'samesite' => 'Lax']);" },
        { name: "Set-Cookie:", tech: "cookie", where: "rete", target: "cookie", does: "Header di risposta: chiede al browser di conservare il cookie." },
        { name: "Cookie:", tech: "cookie", where: "rete", target: "cookie", does: "Header di richiesta: il browser lo aggiunge da solo, con la sola coppia nome=valore." },
        { name: "Expires, Max-Age", tech: "cookie", where: "client", target: "cookie", does: "La durata. Senza, è un cookie di sessione: sparisce alla chiusura del browser. Con, è permanente fino alla scadenza." },
        { name: "Secure", tech: "cookie", where: "client", target: "cookie", does: "Il cookie viaggia solo su connessioni HTTPS." },
        { name: "HttpOnly", tech: "cookie", where: "client", target: "cookie", does: "Il cookie non è leggibile da JavaScript. Limita i danni di un attacco XSS." },
        { name: "SameSite", tech: "cookie", where: "client", target: "cookie", does: "Limita l'invio del cookie su richieste che partono da altri siti: Strict, Lax (il default nei browser moderni) o None." },
        { name: "document.cookie", tech: "js", where: "client", target: "js", does: "I cookie leggibili da JavaScript per questa pagina. Quelli HttpOnly qui non compaiono.", returns: "Una stringa nome=valore; …" },
      ],
      notes: ["session_start() non aggiunge Secure e HttpOnly da solo. Vanno impostati con la configurazione di PHP o con session_set_cookie_params()."],
      breaks: [
        { id: "nocookie", label: "Disattiva i cookie", effect: "Il browser non riporta l'id. Per il server è una richiesta qualsiasi: session_start() ne crea una nuova, vuota, e ti ritrovi non autenticato. Ecco cos'è, in pratica, stateless." },
        { id: "nohttponly", label: "Togli HttpOnly", effect: "Ora document.cookie restituisce anche PHPSESSID. Uno script iniettato in pagina può leggerlo e spedirlo altrove: chi ha quell'id, per il server, sei tu." },
      ],
      ask: { q: "Dove sta questo dato?", code: "$_SESSION['user'] = 'pippo';", answer: "server", why: "I dati di sessione restano sul server. Sul client c'è solo il PHPSESSID, che da solo non contiene il nome. Mai dati sensibili nei cookie." },
    },
    {
      id: "api",
      title: "L'API",
      tint: "js",
      story: "L'ultimo passo cambia il gioco. Invece di ricaricare la pagina, JavaScript chiama il server con fetch() e chiede solo dati, in JSON. fetch restituisce subito una Promise, e la pagina resta viva mentre la risposta viaggia. Quando arriva si aggiorna un solo nodo del DOM. Sul filo non cambia niente: è ancora HTTP, cambia il tipo di dato.",
      cam: { pos: [-.2, .6, 15.8], look: [-.1, .3, 0] },
      open: { client: 0, server: 0 },
      fx: ["promise"],
      chips: [
        { name: "fetch(url, options)", tech: "js", where: "client", target: "js", does: "Fa una chiamata HTTP asincrona. In options: method, headers, body.", takes: "L'URL e, facoltative, le opzioni", returns: "Una Promise di Response" },
        { name: "Promise", tech: "js", where: "client", target: "js", does: "Rappresenta il risultato di un'operazione asincrona. Stati: pending, fulfilled, rejected." },
        { name: ".then()  .catch()", tech: "js", where: "client", target: "js", does: "then riceve il risultato e passa alla catena ciò che restituisce con return. catch riceve l'errore." },
        { name: "Response.ok", tech: "js", where: "client", target: "js", does: "true se lo stato è tra 200 e 299. Va controllato: la Promise è fulfilled anche con 404." },
        { name: "Response.status", tech: "js", where: "client", target: "js", does: "Il codice di stato numerico, per esempio 200." },
        { name: "response.json()", tech: "js", where: "client", target: "js", does: "Legge tutto il corpo e lo interpreta come JSON. Anche questa è asincrona.", returns: "Una Promise dell'oggetto" },
        { name: "JSON.stringify()", tech: "js", where: "client", target: "packet", does: "Trasforma un valore JavaScript in stringa JSON, pronta per il body.", ex: 'JSON.stringify({campo: "corsi"})' },
        { name: "JSON.parse()", tech: "js", where: "client", target: "js", does: "Trasforma una stringa JSON in un oggetto." },
        { name: ".textContent  .innerHTML", tech: "js", where: "client", target: "html", does: "Cambiano il contenuto di un nodo senza ricaricare. innerHTML interpreta l'HTML: per i dati ricevuti è più sicuro textContent." },
        { name: "php://input", tech: "php", where: "server", target: "php", extra: true, does: "Il corpo grezzo della richiesta. Un body JSON non riempie $_POST: va letto da qui.", ex: "file_get_contents('php://input')" },
        { name: "json_decode(), json_encode()", tech: "php", where: "server", target: "php", extra: true, does: "Il corrispettivo in PHP di JSON.parse e JSON.stringify." },
        { name: "REST", tech: "http", where: "rete", target: "apache", does: "Servizi invocati con i metodi di HTTP, con risultati in JSON o XML. Combinarne più d'uno è un mashup." },
        { name: "Access-Control-Allow-Origin:", tech: "http", where: "rete", target: "packet", does: "Header di risposta con cui il server autorizza un'altra origine a leggere il risultato. Origine: schema, host e porta." },
      ],
      notes: ["Una slide di JS 5 scrive .then(function(response){ response.json(); }). Senza return, il then successivo riceve undefined."],
      breaks: [
        { id: "404", label: "Chiama un endpoint inesistente", effect: "La risposta è arrivata, quindi la Promise è fulfilled, non rejected: catch non scatta. Se non controlli response.ok, provi a leggere come JSON una pagina di errore." },
        { id: "cors", label: "Chiama un altro dominio", effect: "Lo blocca il browser, per la same-origin policy. Il server può aver già risposto: è JavaScript che non può leggere il risultato, finché il server non manda Access-Control-Allow-Origin. Se non controlli quel server, serve un proxy tuo." },
      ],
      ask: { q: "Dove gira questa riga?", code: "response.json()", answer: "client", why: "Gira nel browser, dentro il then. Il suo gemello sul server è json_encode(), che ha prodotto quel testo." },
    },
  ];

  const P = {};
  PHASES.forEach((p, i) => { P[p.id] = i; });

  // The exact text on the wire for a phase. Never interpreted as HTML by the page.
  function wire(phase, ctx) {
    const user = ctx.user;
    const b = ctx.broken;
    const ok = logged(user);
    switch (phase.id) {
      case "indirizzo":
        return [
          { title: "L'URL a pezzi", text: `schema    https\nhost      ${b === "dominio" ? "saw.dibris.unige.ti" : HOST}\nporta     443 (implicita)\npercorso  /login.php` },
          b === "dominio"
            ? { title: "Il DNS", text: `? saw.dibris.unige.ti\nNXDOMAIN   // il nome non esiste\n\n// il browser: "Impossibile raggiungere il sito"` }
            : { title: "Il DNS", text: `? ${HOST}\nA  ${IP}   // IP di esempio` },
        ];
      case "connessione":
        return b === "http"
          ? [{ title: "Quello che legge chi è in mezzo", text: `POST /login.php HTTP/1.1\nHost: ${HOST}\nContent-Type: application/x-www-form-urlencoded\n\nusername=pippo&password=pippo123%21` }]
          : [
            { title: "Handshake TCP", text: `client → server   SYN\nserver → client   SYN, ACK\nclient → server   ACK\n// connessione aperta sulla porta 443` },
            { title: "Poi TLS", text: `client ⇄ server   handshake TLS\n// da qui ogni byte è cifrato\n17 03 03 00 4a 9c e1 7b 02 d6 …` },
          ];
      case "richiesta":
        return b === "404"
          ? [
            { title: "Richiesta", text: `GET /logn.php HTTP/1.1\nHost: ${HOST}` },
            { title: "Risposta", text: `HTTP/1.1 404 Not Found\nServer: Apache/2.4.52 (Ubuntu)\nContent-Type: text/html; charset=UTF-8` },
          ]
          : [{ title: "Richiesta", text: `GET /login.php HTTP/1.1\nHost: ${HOST}\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\nAccept: text/html,application/xml;q=0.9,*/*;q=0.8\nAccept-Language: it-IT;q=0.9,en-US;q=0.8\nConnection: keep-alive\n\n// corpo vuoto` }];
      case "server":
        return b === "500"
          ? [
            { title: "login.php, sul server", text: `<?php echo "Accedi" echo "!"; ?>\n// manca il punto e virgola` },
            { title: "Risposta", text: `HTTP/1.1 500 Internal Server Error\nContent-Length: 0` },
            { title: "Nel log del server", text: `PHP Parse error: syntax error, unexpected token "echo"` },
          ]
          : [
            { title: "login.php, sul server", text: `<h1><?php echo "Accedi"; ?></h1>\n<form id="login" action="login.php" method="post">…` },
            { title: "Risposta, l'unica cosa che esce", text: `HTTP/1.1 200 OK\nServer: Apache/2.4.52 (Ubuntu)\nContent-Type: text/html; charset=UTF-8\n\n<h1>Accedi</h1>\n<form id="login" action="login.php" method="post">…` },
          ];
      case "browser":
        return b === "ordine"
          ? [
            { title: "L'ordine sbagliato", text: `<script>\n  document.getElementById("login")\n    .addEventListener("submit", gestore);\n</script>\n<form id="login">…` },
            { title: "Console", text: `Uncaught TypeError: Cannot read properties of null\n(reading 'addEventListener')` },
          ]
          : [
            { title: "HTML ricevuto", text: `<form id="login" action="login.php" method="post">\n  <input id="username" name="username" required>\n  <input id="pwd" name="password" type="password">\n  <button type="submit">Accedi</button>\n</form>` },
            { title: "JavaScript nella pagina", text: `document.getElementById("login")\n  .addEventListener("submit", function (event) {\n    const u = document.getElementById("username").value.trim();\n    if (u === "") event.preventDefault();\n  });` },
          ];
      case "invio": {
        if (b === "vuoti" || !user) {
          return [{ title: "Sul client, e si ferma qui", text: `// event.type === "submit"\nif (u === "") event.preventDefault();\n\n// nessuna richiesta HTTP` }];
        }
        const body = b === "aggira" ? new URLSearchParams({ username: user, password: "x" }).toString() : formBody(user);
        const first = b === "aggira"
          ? { title: "Da terminale, nessun browser", text: `curl -d "${body}" https://${HOST}/login.php` }
          : { title: "Richiesta", text: `POST /login.php HTTP/1.1\nHost: ${HOST}\nContent-Type: application/x-www-form-urlencoded\nContent-Length: ${byteLength(body)}\n\n${body}` };
        return [
          first,
          { title: "login.php, sul server", text: `// $_POST['username'] vale ${JSON.stringify(user)}\n$stmt = mysqli_prepare($db,\n  "SELECT hash FROM utenti WHERE username = ?");\nmysqli_stmt_bind_param($stmt, "s", $_POST['username']);\nmysqli_stmt_execute($stmt);\n$row = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));\n\nif ($row && password_verify($_POST['password'], $row['hash'])) { … }` },
          { title: "Risposta", text: ok && b !== "aggira" ? `HTTP/1.1 200 OK\nContent-Type: text/html; charset=UTF-8\n\n<h1>Benvenuto, pippo</h1>` : `HTTP/1.1 401 Unauthorized\nContent-Type: text/html; charset=UTF-8\n\n<p>Credenziali non valide</p>` },
        ];
      }
      case "memoria": {
        if (!ok) {
          return [{ title: "Risposta al login", text: `HTTP/1.1 401 Unauthorized\n\n// login fallito per ${JSON.stringify(user)}: nessun dato in $_SESSION.\n// Solo pippo entra: rimettilo alla fase 6.` }];
        }
        const cookie = b === "nohttponly" ? `Set-Cookie: PHPSESSID=${SID}; Path=/; Secure` : `Set-Cookie: PHPSESSID=${SID}; Path=/; Secure; HttpOnly; SameSite=Lax`;
        const base = [
          { title: "login.php, sul server", text: `session_set_cookie_params([\n  'secure' => true,\n  'httponly' => ${b === "nohttponly" ? "false" : "true"},\n  'samesite' => 'Lax',\n]);\nsession_start();\n$_SESSION['user'] = 'pippo';` },
          { title: "Risposta", text: `HTTP/1.1 200 OK\n${cookie}` },
        ];
        if (b === "nocookie") {
          return [...base, { title: "La richiesta dopo", text: `GET /area.php HTTP/1.1\nHost: ${HOST}\n// nessun header Cookie` }, { title: "Il server non sa chi sei", text: `HTTP/1.1 401 Unauthorized\nSet-Cookie: PHPSESSID=b70de1a4c2; Path=/` }];
        }
        if (b === "nohttponly") {
          return [...base, { title: "Console del browser", text: `document.cookie\n// "PHPSESSID=${SID}"   ora JavaScript lo legge` }];
        }
        return [...base, { title: "La richiesta dopo, il browser da solo", text: `GET /area.php HTTP/1.1\nHost: ${HOST}\nCookie: PHPSESSID=${SID}` }, { title: "Console del browser", text: `document.cookie\n// ""   HttpOnly lo nasconde a JavaScript` }];
      }
      default: { // api
        if (b === "cors") {
          return [
            { title: "JavaScript, da saw.dibris.unige.it", text: `fetch("https://api.altro.it/corsi")\n  .then(response => response.json())\n  .catch(error => console.log(error));` },
            { title: "Risposta, senza l'header", text: `HTTP/1.1 200 OK\nContent-Type: application/json\n// manca Access-Control-Allow-Origin` },
            { title: "Console", text: `Access to fetch at 'https://api.altro.it/corsi' has been blocked by CORS policy\nTypeError: Failed to fetch   // finisce nel catch` },
          ];
        }
        const js = `fetch("/api/profilo.php", {\n  method: "post",\n  headers: { "Content-type": "application/json" },\n  body: JSON.stringify({ campo: "nome" })\n})\n  .then(response => {\n    if (!response.ok) throw new Error(response.status);\n    return response.json();\n  })\n  .then(data => {\n    document.getElementById("saluto").textContent = "Ciao " + data.user;\n  })\n  .catch(error => console.log(error));`;
        if (b === "404") {
          return [
            { title: "Risposta", text: `HTTP/1.1 404 Not Found\nContent-Type: text/html` },
            { title: "Cosa vede JavaScript", text: `response.ok      // false\nresponse.status  // 404\n// Promise: fulfilled, il catch non scatta da solo` },
            { title: "JavaScript nella pagina", text: js },
          ];
        }
        const name = ok ? { user } : { user: null };
        return [
          { title: "JavaScript nella pagina", text: js },
          { title: "Richiesta", text: `POST /api/profilo.php HTTP/1.1\nHost: ${HOST}\nContent-Type: application/json\n${ok ? `Cookie: PHPSESSID=${SID}\n` : ""}\n{"campo":"nome"}` },
          { title: "api/profilo.php, sul server", text: `session_start();\n$input = json_decode(file_get_contents('php://input'), true);\nheader('Content-Type: application/json');\necho json_encode(['user' => $_SESSION['user'] ?? null]);` },
          { title: "Risposta", text: `HTTP/1.1 200 OK\nContent-Type: application/json\n\n${JSON.stringify(name)}` },
        ];
      }
    }
  }

  // What the scene plays for a phase: a looping list of journeys.
  function trips(phase, ctx) {
    const b = ctx.broken;
    const user = ctx.user;
    const ok = logged(user);
    switch (phase.id) {
      case "indirizzo":
        return b === "dominio"
          ? [{ from: "client", to: "dns", kind: "ball", label: "?", tint: "http" }, { from: "dns", to: "client", kind: "ball", label: "NXDOMAIN", red: true, hold: .5 }]
          : [{ from: "client", to: "dns", kind: "ball", label: "?", tint: "http" }, { from: "dns", to: "client", kind: "ball", label: IP, tint: "http" }];
      case "connessione":
        return [
          { from: "client", to: "apache", kind: "ball", label: "SYN", tint: "http", dur: 1.5 },
          { from: "apache", to: "client", kind: "ball", label: "SYN, ACK", tint: "http", dur: 1.5 },
          { from: "client", to: "apache", kind: "ball", label: "ACK", tint: "http", dur: 1.5 },
          b === "http"
            ? { from: "client", to: "apache", kind: "env", label: "POST in chiaro", red: true, dur: 3 }
            : { from: "client", to: "apache", kind: "env", label: "cifrato", tint: "http", dur: 3, focus: "tube" },
        ];
      case "richiesta":
        return b === "404"
          ? [{ from: "client", to: "apache", kind: "env", label: "GET /logn.php", tint: "http" }, { from: "apache", to: "client", kind: "env", label: "404", red: true }]
          : [{ from: "client", to: "apache", kind: "env", label: "GET", tint: "http", hold: 4.5, sheets: sheetsGet }];
      case "server":
        return b === "500"
          ? [{ from: "apache", to: "php", kind: "ball", label: "login.php", tint: "apache", dur: 1.4, focus: "php" }, { from: "apache", to: "client", kind: "env", label: "500", red: true }]
          : [
            { from: "apache", to: "php", kind: "ball", label: "login.php", tint: "apache", dur: 1.4, focus: "php" },
            { from: "php", to: "apache", kind: "ball", label: "HTML", tint: "html", dur: 1.4, focus: "apache" },
            { from: "apache", to: "client", kind: "env", label: "200 OK", tint: "html" },
          ];
      case "browser":
        return [];
      case "invio": {
        if (b === "vuoti" || !user) return [];
        const accepted = ok && b !== "aggira";
        return [
          { from: "client", to: "apache", kind: "env", label: "POST", tint: "http", focus: "packet" },
          { from: "apache", to: "php", kind: "ball", label: "$_POST", tint: "php", dur: 1.2, focus: "php" },
          { from: "php", to: "mysql", kind: "ball", label: "SELECT", tint: "mysql", dur: 1.2, focus: "mysql" },
          { from: "mysql", to: "php", kind: "ball", label: accepted ? "hash" : "nessuna riga", tint: "mysql", dur: 1.2, focus: "php" },
          { from: "apache", to: "client", kind: "env", label: accepted ? "200 OK" : "401", red: !accepted, tint: "html" },
        ];
      }
      case "memoria":
        if (!ok) return [{ from: "apache", to: "client", kind: "env", label: "401", red: true }];
        if (b === "nocookie") {
          return [
            { from: "apache", to: "client", kind: "env", label: "Set-Cookie", tint: "cookie", cookie: true, focus: "cookie" },
            { from: "client", to: "apache", kind: "env", label: "GET, senza cookie", tint: "http" },
            { from: "apache", to: "client", kind: "env", label: "401", red: true },
          ];
        }
        if (b === "nohttponly") {
          return [
            { from: "apache", to: "client", kind: "env", label: "Set-Cookie", tint: "cookie", cookie: true, focus: "cookie" },
            { from: "client", to: "client", kind: "ball", label: "document.cookie", red: true, dur: 2.6, focus: "js" },
          ];
        }
        return [
          { from: "apache", to: "client", kind: "env", label: "Set-Cookie", tint: "cookie", cookie: true, focus: "cookie" },
          { from: "client", to: "apache", kind: "env", label: "Cookie", tint: "http", cookie: true, focus: "php" },
          { from: "apache", to: "client", kind: "env", label: "Ciao, pippo", tint: "html" },
        ];
      default:
        if (b === "cors") {
          return [
            { from: "client", to: "apache", kind: "json", label: "api.altro.it", tint: "js", promise: "pending" },
            { from: "apache", to: "client", kind: "json", label: "bloccata", red: true, promise: "rejected", hold: .6 },
          ];
        }
        if (b === "404") {
          return [
            { from: "client", to: "apache", kind: "json", label: "fetch", tint: "js", promise: "pending" },
            { from: "apache", to: "client", kind: "json", label: "404", red: true, promise: "fulfilled, ok false", hold: .6 },
          ];
        }
        return [
          { from: "client", to: "apache", kind: "json", label: "{ \"campo\" }", tint: "js", promise: "pending" },
          { from: "apache", to: "php", kind: "ball", label: "php://input", tint: "php", dur: 1.1, focus: "php", promise: "pending" },
          { from: "php", to: "apache", kind: "ball", label: "json_encode", tint: "php", dur: 1.1, promise: "pending" },
          { from: "apache", to: "client", kind: "json", label: ok ? `{ "user": "${user}" }` : "{ \"user\": null }", tint: "js", promise: "fulfilled", focus: "html", hold: 2, sets: ok ? `Ciao ${user}` : "" },
        ];
    }
  }

  const STORY = { TECH, WHERE, TARGETS, ANCHORS, KINDS, PHASES, cleanUser, parseHash, parseDone, wire, trips };
  if (typeof module !== "undefined") module.exports = STORY;
  else window.STORY = STORY;
})();
