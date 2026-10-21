// Small JPEG screenshot for checking a page by eye without filling the agent's context.
//   node scripts/shot.js <target> [WIDTHxHEIGHT] [out.jpg] [--scale=0.5] [--wait=4000] [--timeout=90]
// <target>: "designs/vault/index.html?seed=4" is served from public/ (no build needed),
// "resources" (or "#/resources") and "" (home) from build/, and a full http(s) URL is loaded as is.
// Gives up after --timeout seconds (default 90): the home page, with every tile's live
// preview at once, never finishes a headless screenshot.
// The layout uses the full CSS size; --scale only shrinks the pixels saved.
// The page is drawn in an iframe of exactly that size, because headless Chrome
// won't make a window narrower than about 500px and would lay out phones too wide.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { serve, chrome } = require("./chrome");

const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));
const [target = "", size = "1440x900", out] = args.filter((a) => !a.startsWith("--"));
const [w, h] = size.split("x").map(Number);

(async () => {
  const frame = path.join(os.tmpdir(), `shot-frame-${process.pid}.html`);
  const route = target.replace(/^#?\/?/, "");
  const src = /^https?:/.test(target) ? target : target.startsWith("designs/") ? "/" + target : route ? "/#/" + route : "/";
  fs.writeFileSync(frame, `<!doctype html><body style="margin:0"><iframe src="${src.replace(/"/g, "&quot;")}" style="display:block;border:0;width:${w}px;height:${h}px"></iframe>`);
  const server = await serve(target.startsWith("designs/") ? "public" : "build", { "/__shot.html": frame });
  const url = `http://127.0.0.1:${server.address().port}/__shot.html`;
  const file = path.resolve(out || path.join(os.tmpdir(), `shot-${(target.replace(/\W+/g, "-") || "home").slice(0, 40)}.jpg`));
  try {
    await chrome([`--window-size=${w},${h}`, `--force-device-scale-factor=${opt.scale || 0.5}`,
      `--virtual-time-budget=${opt.wait || 4000}`, `--screenshot=${file}`, url], (opt.timeout || 90) * 1000);
    console.log(file);
  } finally {
    server.close();
    fs.rmSync(frame, { force: true });
  }
})();
