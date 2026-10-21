// Runs scripts/responsive-test.html against build/ in headless Chrome and prints its
// FAIL/ok lines. First checks that every <Route> in src/App.js is listed in its ROUTES.
// Exits 1 on any failure. Run `npm run build` first (or use `npm run check:responsive`).
const fs = require("fs");
const path = require("path");
const { serve, chrome } = require("./chrome");

const root = path.join(__dirname, "..");
const test = path.join(__dirname, "responsive-test.html");

const paths = [...fs.readFileSync(path.join(root, "src/App.js"), "utf8").matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
const routes = JSON.parse(fs.readFileSync(test, "utf8").match(/const ROUTES = (\[.*?\]);/)[1]);
const missing = paths.filter((p) => {
  const re = new RegExp("^" + (p === "/" ? "" : "#" + p.replace(/:\w+/g, "[^/]+")) + "$");
  return !routes.some((r) => re.test(r));
});
if (missing.length) {
  console.log(`FAIL routes missing from ROUTES in scripts/responsive-test.html: ${missing.join(", ")}`);
  process.exit(1);
}

(async () => {
  const server = await serve(path.join(root, "build"), { "/responsive-test.html": test });
  try {
    const dom = await chrome(["--virtual-time-budget=300000", "--dump-dom",
      `http://127.0.0.1:${server.address().port}/responsive-test.html`]);
    const lines = dom.replace(/<[^>]*>/g, "\n").split("\n").filter((l) => /^(FAIL|ok)/.test(l));
    const fails = lines.filter((l) => l.startsWith("FAIL"));
    if (fails.length) console.log(fails.join("\n"));
    console.log(`${lines.length - fails.length} ok, ${fails.length} FAIL`);
    if (!dom.includes("DONE")) console.log("FAIL test page did not finish (raise --virtual-time-budget)");
    process.exitCode = fails.length || !dom.includes("DONE") ? 1 : 0;
  } finally {
    server.close();
  }
})();
