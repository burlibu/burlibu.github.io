// Shared by shot.js and check-responsive.js: a throwaway static server and a
// headless Chrome runner that work the same on Windows, macOS and Linux.
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml",
  ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".woff2": "font/woff2",
  ".mp3": "audio/mpeg", ".wasm": "application/wasm", ".txt": "text/plain",
};

// Serves `root` on a free port; `extra` maps URL paths to files outside it.
function serve(root, extra = {}) {
  root = path.resolve(root);
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    let file = extra[url] || path.join(root, url);
    if (!extra[url] && !file.startsWith(root)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404).end();
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function findChrome() {
  const candidates = [
    process.env.CHROME,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  ];
  const found = candidates.find((p) => p && fs.existsSync(p));
  if (!found) throw new Error("Chrome not found: set CHROME to its path");
  return found;
}

// Runs headless Chrome with its own profile, so an open browser window doesn't interfere.
// Async, because the page is served from this same process.
function chrome(args, timeoutMs = 600000) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-"));
  return new Promise((resolve, reject) => {
    execFile(findChrome(), ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--user-data-dir=${profile}`, ...args],
      { maxBuffer: 64 << 20, timeout: timeoutMs, encoding: "utf8" },
      (err, stdout) => {
        fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
        err && !stdout ? reject(err) : resolve(stdout);
      });
  });
}

module.exports = { serve, chrome };
