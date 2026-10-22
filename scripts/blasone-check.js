// Blasone checks in headless Chrome: hostile stored prefs, a script tag in
// ?seed, invalid game codes, formulas and control characters in the feedback
// sheet, and the timing and focus of the end sheet (normal and reduced
// motion). Each page is index.html with an extra script, served from outside
// public/. Prints every check; exits 1 on any FAIL.
// usage: node scripts/blasone-check.js
const fs = require("fs");
const os = require("os");
const path = require("path");
const { serve, chrome } = require("./chrome");

const pub = path.join(__dirname, "../public");
const index = fs.readFileSync(path.join(pub, "designs/blasone/index.html"), "utf8");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "blasone-"));
// a page = index.html + prefs written before the game loads + a check script
function page(name, prefs, check) {
  const html = index
    .replace('<script src="game.js"></script>', `<script>localStorage.setItem("blasone.prefs", ${JSON.stringify(prefs)})</script><script src="game.js"></script>`)
    .replace('<script src="script.js"></script>', `<script src="script.js"></script><script src="${check}"></script>`);
  fs.writeFileSync(path.join(tmp, name), html);
  return path.join(tmp, name);
}
// a raw "__proto__" key, which JSON.stringify of an object literal can't write
const hostile = '{"__proto__":{"polluted":1},"format":"<img src=x onerror=window.__pwned=1>","size":"1.3","conte":"constructor","editto":"si","colors":false}';

(async () => {
  const extra = {
    "/designs/blasone/_security.html": page("security.html", hostile, "_security.js"),
    "/designs/blasone/_reduced.html": page("reduced.html", '{"motion":true}', "_reduced.js"),
    "/designs/blasone/_security.js": path.join(__dirname, "blasone-check/security.js"),
    "/designs/blasone/_reduced.js": path.join(__dirname, "blasone-check/reduced.js"),
  };
  const server = await serve(pub, extra);
  const base = `http://127.0.0.1:${server.address().port}/designs/blasone/`;
  let out = "";
  for (const url of ["_security.html?seed=%3Cscript%3Ealert(1)%3C/script%3E", "_reduced.html?seed=8"]) {
    const dom = await chrome(["--virtual-time-budget=15000", "--window-size=1300,1000", "--dump-dom", base + url], 120000);
    const m = /<pre id="results">([\s\S]*?)<\/pre>/.exec(dom);
    out += (m ? m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&") : `FAIL ${url}: no results`) + "\n";
  }
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  process.stdout.write(out);
  process.exit(/^FAIL/m.test(out) ? 1 : 0);
})();
