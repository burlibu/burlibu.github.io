// Small JPEG screenshot for checking a page by eye without filling the agent's context.
//   node scripts/shot.js <target> [WIDTHxHEIGHT] [out.jpg] [--scale=0.5] [--wait=4000]
// <target>: "designs/vault/index.html?seed=4" is served from public/ (no build needed),
// "#/resources" or "" (home) from build/, and a full http(s) URL is loaded as is.
// The layout uses the full CSS size; --scale only shrinks the pixels saved.
const os = require("os");
const path = require("path");
const { serve, chrome } = require("./chrome");

const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));
const [target = "", size = "1440x900", out] = args.filter((a) => !a.startsWith("--"));
const [w, h] = size.split("x").map(Number);

(async () => {
  let url = target, server;
  if (!/^https?:/.test(target)) {
    server = await serve(target.startsWith("designs/") ? "public" : "build");
    url = `http://127.0.0.1:${server.address().port}/${target}`;
  }
  const file = path.resolve(out || path.join(os.tmpdir(), `shot-${(target.replace(/\W+/g, "-") || "home").slice(0, 40)}.jpg`));
  try {
    await chrome([`--window-size=${w},${h}`, `--force-device-scale-factor=${opt.scale || 0.5}`,
      `--virtual-time-budget=${opt.wait || 4000}`, `--screenshot=${file}`, url]);
    console.log(file);
  } finally {
    server && server.close();
  }
})();
