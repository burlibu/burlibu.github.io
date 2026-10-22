// The page's text: six short sections around the two figures. Formulas are rendered to
// HTML with KaTeX at build time, so the page only needs KaTeX's stylesheet.
import katex from "katex";

const tex = (source) => katex.renderToString(source, { throwOnError: true, output: "html" });
const show = (source) => `<div class="fx-math">${katex.renderToString(source, { throwOnError: true, displayMode: true, output: "html" })}</div>`;
// inline maths written as $…$ inside a paragraph
const p = (text) => `<p>${text.replace(/\$([^$]+)\$/g, (_, s) => tex(s))}</p>`;
const h = (n, title) => `<h2><span>${n}</span>${title}</h2>`;

export function prose({ fig1, fig2 }) {
  return `<article class="fx-prose">
<header class="fx-head">
<p class="fx-kicker">Analisi armonica · due macchine e sei formule</p>
<h1>La trasformata di Fourier</h1>
${p("Un suono, la marea, il segnale di un'antenna, la riga di pixel di una foto: sono tutte funzioni che salgono e scendono. Nel 1807 Joseph Fourier sostenne che ognuna si può scrivere come somma di onde semplici, seni e coseni di frequenze diverse, e che basta conoscere quanto pesa ciascuna onda per ricostruire tutto il resto. La trasformata di Fourier è la regola che, dato il segnale, trova quei pesi.")}
${p("Questa pagina la costruisce in due passi, ciascuno con una macchina che si può toccare: prima la <em>sintesi</em> (dalle onde al segnale), poi l'<em>analisi</em> (dal segnale alle onde).")}
</header>

<section>
${h("1", "Un segnale periodico è una somma di onde")}
${p("Prendiamo un segnale che si ripete ogni $2\\pi$, per esempio un'onda quadra che vale $+1$ per metà periodo e $-1$ per l'altra metà. La serie di Fourier afferma che")}
${show("f(\\theta) = \\frac{a_0}{2} + \\sum_{n=1}^{\\infty} \\bigl( a_n \\cos n\\theta + b_n \\sin n\\theta \\bigr)")}
${p("cioè che il segnale è una media $a_0/2$ più infinite oscillazioni pure: una alla frequenza del segnale ($n = 1$, la <em>fondamentale</em>), una al doppio, una al triplo, e così via (le <em>armoniche</em>). Per l'onda quadra i coseni mancano e restano solo i seni dispari:")}
${show("\\operatorname{sq}(\\theta) = \\frac{4}{\\pi}\\left( \\sin\\theta + \\frac{\\sin 3\\theta}{3} + \\frac{\\sin 5\\theta}{5} + \\frac{\\sin 7\\theta}{7} + \\cdots \\right)")}
${p("La macchina qui sotto calcola esattamente questa somma, troncata a sette termini. È la stessa idea delle macchine per prevedere le maree dell'Ottocento: ogni manovella gira $n$ volte per ogni giro della prima e, con un giogo scorrevole, trasforma il giro in un'oscillazione verticale $b_n \\sin n\\theta$ di ampiezza pari al raggio del suo perno. Un filo che passa su tutte le pulegge somma le sette altezze e muove la penna.")}
<div class="fx-fig1">${fig1}</div>
${p("Con una sola armonica la penna disegna una sinusoide; aggiungendone, gli spigoli si fanno più netti. L'errore si misura con l'<em>identità di Parseval</em>: l'energia media del segnale è la somma delle energie delle sue armoniche,")}
${show("\\frac{1}{2\\pi}\\int_{-\\pi}^{\\pi} f(\\theta)^2 \\, d\\theta = \\frac{a_0^2}{4} + \\frac{1}{2}\\sum_{n=1}^{\\infty} \\left(a_n^2 + b_n^2\\right)")}
${p("quindi l'energia che manca alla somma troncata $S_N$ è esattamente quella dei termini tolti: è lo <em>scarto RMS</em> che la Fig 1 mostra in basso a destra. Per l'onda quadra scende dal 44% con un termine al 23% con quattro: lentamente, perché i coefficienti calano solo come $1/n$. L'onda triangolare, che non ha salti, ha coefficienti che calano come $1/n^2$, e con due soli termini sbaglia già meno del 5%.")}
${p("Dove il segnale salta, la somma oscilla e supera il salto: è il <em>fenomeno di Gibbs</em>. Aggiungendo termini l'oscillazione si stringe verso il salto ma il picco non cala: resta intorno al 9% dell'altezza del salto, per qualsiasi $N$.")}
</section>

<section>
${h("2", "Trovare i coefficienti: seni e coseni sono ortogonali")}
${p("Se il segnale è la somma, come si ricavano i pesi? Il trucco è che due armoniche diverse, moltiplicate tra loro e mediate su un periodo, danno zero:")}
${show("\\int_{-\\pi}^{\\pi} \\sin m\\theta \\, \\sin n\\theta \\, d\\theta = \\begin{cases} \\pi & m = n \\\\ 0 & m \\neq n \\end{cases} \\qquad \\int_{-\\pi}^{\\pi} \\sin m\\theta \\, \\cos n\\theta \\, d\\theta = 0")}
${p("Moltiplicando $f$ per $\\sin n\\theta$ e integrando, tutti i termini della serie si annullano tranne quello che ha proprio frequenza $n$. Restano le formule di Eulero–Fourier:")}
${show("a_n = \\frac{1}{\\pi}\\int_{-\\pi}^{\\pi} f(\\theta)\\cos n\\theta \\, d\\theta \\qquad b_n = \\frac{1}{\\pi}\\int_{-\\pi}^{\\pi} f(\\theta)\\sin n\\theta \\, d\\theta")}
${p("È una proiezione, come trovare le componenti di un vettore facendo il prodotto scalare con gli assi: le armoniche sono gli assi, infiniti e perpendicolari tra loro. I quattro segnali della Fig 1 danno:")}
<div class="fx-table" role="region" aria-label="Coefficienti dei quattro segnali" tabindex="0"><table>
<thead><tr><th>Segnale</th><th>Coefficienti</th><th>Calano come</th></tr></thead>
<tbody>
<tr><td>Onda quadra</td><td>${tex("b_n = \\dfrac{4}{n\\pi}")} per ${tex("n")} dispari</td><td>${tex("1/n")}</td></tr>
<tr><td>Dente di sega, ${tex("\\theta/\\pi")}</td><td>${tex("b_n = (-1)^{n+1}\\dfrac{2}{n\\pi}")}</td><td>${tex("1/n")}</td></tr>
<tr><td>Onda triangolare</td><td>${tex("b_n = (-1)^{\\frac{n-1}{2}}\\dfrac{8}{n^2\\pi^2}")} per ${tex("n")} dispari</td><td>${tex("1/n^2")}</td></tr>
<tr><td>Impulsi larghi ${tex("\\tfrac14")}, senza media</td><td>${tex("a_n = \\dfrac{2}{n\\pi}\\sin\\dfrac{n\\pi}{4}")}</td><td>${tex("1/n")}</td></tr>
</tbody></table></div>
${p("Gli impulsi sono pari, simmetrici attorno a $\\theta = 0$, quindi hanno solo coseni: nella macchina i loro perni partono ruotati di un quarto di giro. La regola generale è che più il segnale è liscio, più in fretta calano i coefficienti: un salto dà $1/n$, uno spigolo $1/n^2$, una derivata seconda che salta $1/n^3$.")}
</section>

<section>
${h("3", "Avvolgere il segnale attorno a un cerchio")}
${p("Seni e coseni stanno meglio insieme. Con la formula di Eulero, $e^{i\\varphi} = \\cos\\varphi + i\\sin\\varphi$, un'armonica diventa un punto che gira su un cerchio, e la serie si scrive")}
${show("f(\\theta) = \\sum_{n=-\\infty}^{\\infty} c_n \\, e^{in\\theta} \\qquad c_n = \\frac{1}{2\\pi}\\int_{-\\pi}^{\\pi} f(\\theta)\\, e^{-in\\theta}\\, d\\theta")}
${p("con $c_{\\pm n} = (a_n \\mp i\\, b_n)/2$. Le frequenze negative non sono un artificio: un coseno è la somma di due cerchi che girano in versi opposti, e le loro parti immaginarie si cancellano.")}
${p("La formula per $c_n$ ha una lettura geometrica che conviene vedere. Il fattore $e^{-in\\theta}$ fa girare un punto attorno all'origine; moltiplicarlo per $f$ significa usare il segnale come raggio. Al variare di $\\theta$ il punto disegna il segnale <em>avvolto</em> attorno a un cerchio, e l'integrale diviso per la lunghezza è il suo <em>baricentro</em>.")}
<div class="fx-fig2">${fig2}</div>
${p("Se la velocità di avvolgimento non corrisponde a nessuna frequenza del segnale, i lobi della curva si distribuiscono tutt'intorno e si compensano: il baricentro resta vicino al perno. Quando la velocità coincide con una frequenza presente, ogni lobo cade dalla stessa parte e il baricentro si sposta. Per un segnale qualsiasi $g(t)$ osservato per un tempo $T$, il baricentro alla frequenza $f$ è")}
${show("\\hat g(f) = \\frac{1}{T}\\int_0^T g(t)\\, e^{-2\\pi i f t}\\, dt")}
${p("Un numero complesso: la sua distanza dal perno dice quanto il segnale contiene di quella frequenza, il suo angolo dice con che fase. Il segnale della Fig 2 ha una componente da $0{,}6$ a 2 Hz e una da $0{,}4$ a 3 Hz; il baricentro arriva a metà di ciascuna, perché l'altra metà sta nella frequenza negativa.")}
</section>

<section>
${h("4", "Dalla serie alla trasformata")}
${p("Le serie servono per i segnali periodici. Per uno che non si ripete, si allunga il periodo $T$ all'infinito. Le armoniche $n/T$ si fanno sempre più fitte, la somma diventa un integrale e i coefficienti, moltiplicati per $T$, diventano una funzione continua della frequenza:")}
${show("\\hat f(\\xi) = \\int_{-\\infty}^{\\infty} f(x)\\, e^{-2\\pi i x \\xi}\\, dx \\qquad f(x) = \\int_{-\\infty}^{\\infty} \\hat f(\\xi)\\, e^{2\\pi i x \\xi}\\, d\\xi")}
${p("La prima è la trasformata, la seconda l'antitrasformata: la stessa operazione con il verso di rotazione invertito. Con la frequenza $\\xi$ misurata in giri (hertz, se $x$ è un tempo in secondi) non serve nessun fattore $2\\pi$ davanti agli integrali.")}
${p("Due coppie da ricordare. Un impulso rettangolare di larghezza 1 ha come trasformata il seno cardinale, che oscilla e si smorza lentamente; la gaussiana è la trasformata di sé stessa:")}
${show("\\operatorname{rect}(x) \\;\\longmapsto\\; \\operatorname{sinc}(\\xi) = \\frac{\\sin \\pi\\xi}{\\pi\\xi} \\qquad\\qquad e^{-\\pi x^2} \\;\\longmapsto\\; e^{-\\pi \\xi^2}")}
${p("Stringere un segnale allarga il suo spettro, e viceversa: $f(ax) \\mapsto \\frac{1}{|a|}\\hat f(\\xi/a)$. Il prodotto delle due larghezze non può scendere sotto un minimo, che la gaussiana raggiunge: è il <em>principio di indeterminazione</em>, lo stesso della meccanica quantistica, dove posizione e quantità di moto sono una coppia di Fourier.")}
</section>

<section>
${h("5", "Le proprietà che fanno il lavoro")}
${p("La trasformata è utile perché trasforma operazioni difficili in operazioni facili. Con $f \\mapsto \\hat f$ e $g \\mapsto \\hat g$:")}
<div class="fx-table" role="region" aria-label="Proprietà della trasformata" tabindex="0"><table>
<thead><tr><th>Nel tempo</th><th>In frequenza</th><th>Che cosa significa</th></tr></thead>
<tbody>
<tr><td>${tex("\\alpha f + \\beta g")}</td><td>${tex("\\alpha \\hat f + \\beta \\hat g")}</td><td>Linearità: si trasforma pezzo per pezzo</td></tr>
<tr><td>${tex("f(x - x_0)")}</td><td>${tex("e^{-2\\pi i x_0 \\xi}\\,\\hat f(\\xi)")}</td><td>Un ritardo cambia solo le fasi</td></tr>
<tr><td>${tex("e^{2\\pi i \\xi_0 x} f(x)")}</td><td>${tex("\\hat f(\\xi - \\xi_0)")}</td><td>Modulare sposta lo spettro: la radio AM</td></tr>
<tr><td>${tex("f'(x)")}</td><td>${tex("2\\pi i \\xi\\,\\hat f(\\xi)")}</td><td>Derivare diventa moltiplicare</td></tr>
<tr><td>${tex("(f * g)(x)")}</td><td>${tex("\\hat f(\\xi)\\,\\hat g(\\xi)")}</td><td>La convoluzione diventa un prodotto: filtri, sfocature, eco</td></tr>
<tr><td>${tex("\\int |f|^2 \\, dx")}</td><td>${tex("\\int |\\hat f|^2 \\, d\\xi")}</td><td>Plancherel: l'energia si conserva</td></tr>
</tbody></table></div>
${p("La riga della derivata è quella che serviva a Fourier: un'equazione differenziale, come quella del calore, diventa un'equazione algebrica per ogni frequenza. Quella della convoluzione è quella che usano i telefoni: un filtro audio, un'equalizzazione o una sfocatura sono moltiplicazioni dello spettro.")}
</section>

<section>
${h("6", "Nel calcolatore: la DFT e la FFT")}
${p("Un calcolatore non vede funzioni continue ma $N$ campioni $x_0, \\ldots, x_{N-1}$. La versione discreta della trasformata è una somma finita, e si inverte esattamente:")}
${show("X_k = \\sum_{n=0}^{N-1} x_n\\, e^{-2\\pi i k n / N} \\qquad x_n = \\frac{1}{N}\\sum_{k=0}^{N-1} X_k\\, e^{2\\pi i k n / N}")}
${p("È di nuovo l'avvolgimento della Fig 2, fatto su $N$ punti e solo alle $N$ frequenze che compiono un numero intero di giri nella finestra: per quelle, come mostra il plotter a 1, 1,5 o 2,5 Hz, le componenti che non c'entrano si annullano esattamente. Calcolata così costa $N^2$ moltiplicazioni. La <em>FFT</em> (Cooley e Tukey, 1965, ma Gauss la conosceva già) divide i campioni in pari e dispari e riusa i conti:")}
${show("X_k = E_k + e^{-2\\pi i k/N}\\, O_k \\qquad X_{k + N/2} = E_k - e^{-2\\pi i k/N}\\, O_k")}
${p("dove $E$ e $O$ sono le DFT dei campioni pari e dispari, lunghe $N/2$. Ripetendo la divisione si scende a $N \\log_2 N$ operazioni: per un milione di campioni, venti milioni invece di mille miliardi. Una regola sola va rispettata: campionare almeno al doppio della frequenza più alta presente (<em>Nyquist</em>), altrimenti le frequenze alte si travestono da basse.")}
${p("Con la FFT la trasformata è dappertutto: nella compressione JPEG e MP3, nel Wi-Fi e nel 5G, nella risonanza magnetica, nell'accordatore del telefono, nella moltiplicazione di numeri enormi. Le due macchine di questa pagina fanno, con ingranaggi e un filo, la stessa cosa.")}
</section>
</article>`;
}
