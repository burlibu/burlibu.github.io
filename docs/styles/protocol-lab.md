# Protocol Lab: guida di stile

Stile per spiegazioni tecniche interattive: passi numerati, pacchetti che viaggiano lungo i collegamenti, dati mostrati come in un analizzatore di rete. Ricavato da due siti dello stesso autore: un corso di system design (carta crema, bottoni stampati) e un esploratore di protocolli (blu inchiostro, tabella di pacchetti, tema scuro). Non copia testi né diagrammi di quei siti.

## Quando usarlo

- Spiegazioni di un processo in più passi (una richiesta web, un handshake, un algoritmo).
- Contenuti per sviluppatori o studenti, dove il rigore conta più dell'effetto.
- Non per landing page di prodotto né per giochi: quelli hanno altri stili nel sito.

## Token

Tutti i colori sono variabili su `:root`. Il tema scuro sostituisce solo le variabili.

```css
:root {
  --paper: #f4ebe0;       /* fondo */
  --ink: #1d1b18;         /* testo e bordi */
  --ink-soft: #34302b;    /* bordi secondari, bottoni */
  --sage: #cfe3b2;        /* primario: bottone, stato attivo */
  --sage-hi: #9fd28f;     /* accento: link, progresso */
  --wire: #0b3aa8;        /* dati tecnici: IP, porte, byte */
  --wire-soft: #b5c8e7;   /* bordi di tabelle dati */
  --card: #fbf7f1;        /* bottone secondario, schede */
  --radius: 8px;
  --font: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --u: 10px;              /* unità di spaziatura: multipli di 10 */
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper: #0b1020;
    --ink: #e7ecf3;
    --ink-soft: #9aa6bd;
    --card: #131a2e;
    --wire: #8fb4ff;
    --wire-soft: #2a3756;
  }
}
:root[data-theme="dark"] { /* stessi valori del blocco sopra */ }
```

## Tipografia

Un solo font per tutto: JetBrains Mono, anche per titoli, etichette e dati.

| Ruolo | Dimensione | Note |
|---|---|---|
| H1 | 27–30px | peso 600, interlinea 1.1 |
| H2 | 19–20px | peso 600 |
| Corpo | 13–14px | interlinea 1.6 |
| Etichetta | 11px | maiuscolo, spaziatura 0.08em, colore attenuato |

Le etichette in maiuscolo hanno il formato `STEP 1 OF 5`, `LAYER`, `DEFAULT PORT`.

## Forma

- Raggio 2px per schede tecniche e tabelle, 8px per bottoni e pannelli.
- Bordi di 1px in `--ink` o `--wire-soft`. Niente bordi spessi tranne l'evidenziazione attiva.
- Ombra solo sul bottone primario, sfalsata e senza sfumatura: `box-shadow: 1.5px 2.5px 0 var(--ink)`. Nessuna ombra blur.
- Niente gradienti, niente vetro, niente bagliori.

## Componenti

### Scheda metadati

Coppie chiave/valore in una griglia, la chiave in etichetta, il valore in corpo.

```html
<dl class="pl-meta">
  <div><dt>LAYER</dt><dd>Application (7)</dd></div>
  <div><dt>DEFAULT PORT</dt><dd class="pl-wire">80 (HTTPS: 443)</dd></div>
</dl>
```

### Timeline di passi

Una lista numerata con il passo attivo evidenziato in `--sage`, e i controlli sotto.

Controlli: Play / Pausa, Reset, velocità `0.5× 1× 1.5× 2×`. Etichetta `Step N of M`.

### Tabella di pacchetti

Colonne fisse: `NO. | TIME | SOURCE | DESTINATION | PROTOCOL | INFO | SIZE`. Gli indirizzi e le porte in `--wire`. Le righe compaiono una alla volta. Su telefono ogni riga diventa una scheda.

### Diagramma di nodi

Nodi quadrati con l'etichetta IP sotto in `--wire`. Collegamenti in linea sottile. Il pacchetto è un punto con una scia breve, che avanza lungo il collegamento attivo.

### Pannello scorciatoie

Una lista di tasti (`↑ ↓` per muovere, `↵` per aprire, `esc` per chiudere), ciascuno in un riquadro di 1px.

## Movimento

- Il pacchetto avanza con `ease: linear` e tempo proporzionale alla distanza.
- Le righe e le schede entrano con un leggero spostamento verticale, uno alla volta.
- Nessun effetto decorativo che non segua un passo del processo.
- Tutto si ferma con `prefers-reduced-motion`: il passo cambia subito, senza animazione.

## Da evitare

- Più di un font.
- Gradienti, vetro o bagliori (sono dello stile Cleanroom, non di questo).
- Ombre sfumate.
- Testi copiati dai siti di origine.
- Colori diversi dal blu dati e dal salvia primario.

## Esempio minimo

```html
<section class="pl">
  <p class="pl-label">STEP 1 OF 3</p>
  <h2>Hit Enter</h2>
  <p>Il browser prepara la richiesta.</p>
  <button class="pl-primary">Play</button>
</section>
```

```css
.pl { font: 14px/1.6 var(--font); background: var(--paper); color: var(--ink); }
.pl-label { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-soft); }
.pl-primary { background: var(--sage); color: var(--ink); border: 1px solid var(--ink);
  border-radius: var(--radius); padding: 8px 14px; box-shadow: 1.5px 2.5px 0 var(--ink); }
.pl-wire { color: var(--wire); }
```

## Verifica di una pagina nuova

Una pagina che segue questa guida deve superare questi controlli:
- un solo font;
- colori presi solo dai token;
- nessuna ombra sfumata;
- passo attivo visibile senza animazione;
- `prefers-reduced-motion` rispettato.

L'implementazione di riferimento è `public/designs/protocol-lab/`.
