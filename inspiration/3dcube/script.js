// PHP proxy example: https://gist.github.com/arenagroove/ec98806b34b7d523118d5f439b82691a
const CONFIG = {
    proxyUrl: "https://lessrain.com/dev/codepen/codepen-proxy-extended-v2-cached.php",
    collectionId: "MWOMwo",
    perPage: 100,
    sort: "created",
    direction: "desc",
    pointerLight: true,
    cardReveal: "always", // once, forward, always
    cubeLean: true,
    numerals: true
};

const BASE_ROTATIONS = [
    { rx: 90, ry: 0 },
    { rx: 0, ry: 0 },
    { rx: 0, ry: -90 },
    { rx: 0, ry: -180 },
    { rx: 0, ry: -270 },
    { rx: -90, ry: -360 }
];

const SCREENSHOT_SIZES = [
    ["small", 320],
    ["medium", 512],
    ["large", 800],
    ["xlarge", 1280]
];

const REVEAL_THRESHOLD = 0.15;

const COVER_SIZE = 1024;
const MAX_IMAGE_CACHE = 12;
const MAX_IMAGE_LOADS = 3;

const WHEEL_EASE = 0.1;
const WHEEL_MAX_VELOCITY = 600;
const ANCHOR_DURATION = 900;
const JUMP_STEP = 90;
const JUMP_MAX = 2200;

const SHADE_MAX = 0.55;
const DEG = Math.PI / 180;
const LIGHT = [-0.35, -0.35, 0.87];
const LIGHT_RANGE = 0.7;
const LIGHT_EASE = 3;
const GLOW_FOLLOW = 0.35;
const SHEEN_MAX = 0.14;
const SHEEN_SPREAD = 60;

const FACE_NORMALS = [
    [0, 1, 0],
    [0, 0, 1],
    [1, 0, 0],
    [0, 0, -1],
    [-1, 0, 0],
    [0, -1, 0]
];

const SHADOW_SPREAD = 0.25;
const SHADOW_FADE = 0.45;
const BREATH_DEPTH = 0.12;
const SHADOW_SHIFT = 0.12;

const LEAN_PER_STOP = 1.6;
const LEAN_MAX = 4;
const LEAN_STIFFNESS = 140;
const LEAN_DAMPING = 9;

const ICON_NEXT = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>';
const ICON_BACK = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>';
const ICON_EXTERNAL = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>';

const dom = {
    scene: document.querySelector("#scene"),
    cube: document.querySelector("#cube"),
    shadow: document.querySelector("#cube_shadow"),
    faces: [...document.querySelectorAll(".face")],
    hud: document.querySelector("#hud"),
    hudCount: document.querySelector("#hud_count"),
    progress: document.querySelector("#progress_fill"),
    stops: document.querySelector("#stops"),
    title: document.querySelector("#collection_title"),
    description: document.querySelector("#collection_description"),
    status: document.querySelector("#request_status"),
    collectionLink: document.querySelector("#collection_link"),
    error: document.querySelector("#request_error"),
    introNav: document.querySelector("#intro_nav"),
    introCard: document.querySelector("#s0 .card"),
    loader: document.querySelector("#page_loader"),
    themeSwitch: document.querySelector("#theme_switch"),
    pens: document.querySelector("#pen_list")
};

const imageCache = new Map();
const imageQueue = [];
const faceVersion = new Uint32Array(6);
const facePendingSrc = new Array(6).fill("");
let activeImageLoads = 0;
const coverUrls = new Map();
const darkCoverUrls = new Map();
const darkMissing = new Set();
const coverRequests = new Map();
const coverChecked = new Set();
const faceWaitingForCover = new Array(6).fill(false);
const faceStop = new Array(6).fill(-1);
const light = [...LIGHT];
const lightState = { x: 0, y: 0, a: 0 };
const lightTarget = { x: 0, y: 0, a: 0 };
const cubeCenter = { x: 0, y: 0 };

let collection = null;
let pens = [];
let screenshots = [];
let rotations = [];
let stopElements = [];
let anchors = [];
let maxScroll = 0;
let velocity = 0;
let target = 0;
let current = 0;
let lastBase = -1;
let lastActive = -1;
let frameId = 0;
let anchorMotion = null;
let lastTime = 0;
let sourceHeight = 0;
let lastRx = NaN;
let lastRy = NaN;
let lastTransform = "";
let lastSpread = "";
let lastAlpha = "";
const faceShading = dom.faces.map(() => ({ shade: "", sheen: "" }));
const lightCss = { x: "", y: "", sx: "", sy: "", shift: "" };
let lean = 0;
let leanVelocity = 0;
let leanPrev = 0;

let layoutId = 0;
let themeSwitchedAfterLoad = false;

const pad = value => String(value).padStart(2, "0");
const plural = count => `${count} ${count === 1 ? "Pen" : "Pens"}`;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const easeInOut = t => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeInOutQuart = t => (t < 0.5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2);
const wheelFriction = value => (Math.abs(value) > 200 ? 0.8 : 0.9);

function getRequestUrl(resource, page = 1, penId = "") {
    const url = new URL(CONFIG.proxyUrl);
    url.searchParams.set("resource", resource);
    url.searchParams.set("collection", CONFIG.collectionId);

    if (resource === "pens") {
        url.searchParams.set("page", String(page));
        url.searchParams.set("per_page", String(CONFIG.perPage));
        url.searchParams.set("sort", CONFIG.sort);
        url.searchParams.set("direction", CONFIG.direction);
    } else if (resource === "cover") {
        url.searchParams.set("pen", penId);
    }

    return url;
}

async function request(resource, page = 1, penId = "") {
    let response;

    try {
        response = await fetch(getRequestUrl(resource, page, penId));
    } catch {
        throw new Error("Could not reach the PHP proxy. Check its URL and CORS settings.");
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
    }

    if (!data) {
        throw new Error("The response was not valid JSON");
    }

    return {
        data,
        link: response.headers.get("Link") || ""
    };
}

function nextPage(link, currentPage) {
    const match = link.match(/<([^>]+)>;\s*rel="?next"?/i);
    if (!match) return null;

    const page = Number(new URL(match[1]).searchParams.get("page"));
    if (!Number.isInteger(page) || page <= currentPage || page > 100) {
        throw new Error("Invalid or unsupported API pagination");
    }

    return page;
}

async function getPens() {
    const result = [];
    let page = 1;

    while (page !== null) {
        const response = await request("pens", page);
        if (!Array.isArray(response.data)) {
            throw new Error("Unexpected Pens response");
        }

        result.push(...response.data);
        page = nextPage(response.link, page);
    }

    return result;
}

function buildRotations(count) {
    const out = BASE_ROTATIONS.slice(0, Math.min(count, 6));

    for (let i = 6; i < count; i++) {
        out.push({ rx: 0, ry: -360 - (i - 6) * 90 });
    }

    return out;
}

function faceAtStop(stop) {
    if (stop < 6) return stop;
    return 1 + ((stop - 2) % 4);
}

function applyTransform(t, lightChanged = false) {
    let rx;
    let ry;
    let lift = 0;

    if (rotations.length < 2) {
        ({ rx, ry } = rotations[0]);
    } else {
        const position = clamp(t, 0, rotations.length - 1);
        const i = Math.min(Math.floor(position), rotations.length - 2);
        const f = easeInOut(position - i);
        const a = rotations[i];
        const b = rotations[i + 1];
        rx = a.rx + (b.rx - a.rx) * f;
        ry = a.ry + (b.ry - a.ry) * f;
        lift = Math.sin(f * Math.PI);
    }

    const depth = 0.5 + BREATH_DEPTH * lift;
    const tilt = lean ? ` rotateX(${lean.toFixed(3)}deg)` : "";
    const transform = `translateZ(calc(var(--s) * ${(-depth).toFixed(4)}))${tilt} rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg)`;

    if (transform !== lastTransform) {
        dom.cube.style.transform = transform;
        lastTransform = transform;
    }

    if (rx !== lastRx || ry !== lastRy || lightChanged) {
        lastRx = rx;
        lastRy = ry;
        updateShading(rx, ry);
    }
    updateShadow(lift);
}

function advanceLean(dt) {
    if (!CONFIG.cubeLean) return true;

    const goal = clamp((current - leanPrev) / dt * LEAN_PER_STOP, -LEAN_MAX, LEAN_MAX);
    leanPrev = current;
    leanVelocity += ((goal - lean) * LEAN_STIFFNESS - leanVelocity * LEAN_DAMPING) * dt;
    lean += leanVelocity * dt;

    if (Math.abs(goal) < 0.001 && Math.abs(lean) < 0.01 && Math.abs(leanVelocity) < 0.01) {
        lean = 0;
        leanVelocity = 0;
        return true;
    }
    return false;
}

function updateShadow(lift) {
    const style = dom.shadow.style;
    const spread = (1 + SHADOW_SPREAD * lift).toFixed(3);
    const alpha = (1 - SHADOW_FADE * lift).toFixed(3);
    if (spread !== lastSpread) {
        style.setProperty("--shadow-spread", spread);
        lastSpread = spread;
    }
    if (alpha !== lastAlpha) {
        style.setProperty("--shadow-alpha", alpha);
        lastAlpha = alpha;
    }
}

function updateShading(rx, ry) {
    const sinX = Math.sin(rx * DEG);
    const cosX = Math.cos(rx * DEG);
    const sinY = Math.sin(ry * DEG);
    const cosY = Math.cos(ry * DEG);

    const [lx, ly, lz] = light;
    const sheen = SHEEN_MAX * lightState.a;

    dom.faces.forEach((face, index) => {
        const [x, y, z] = FACE_NORMALS[index];
        const rotatedX = x * cosY + z * sinY;
        const rotatedZ = z * cosY - x * sinY;
        const worldY = y * cosX - rotatedZ * sinX;
        const worldZ = y * sinX + rotatedZ * cosX;
        const light = (rotatedX * lx + worldY * ly + worldZ * lz) / lz;
        const lit = clamp(light, 0, 1);
        const shade = (SHADE_MAX * (1 - lit)).toFixed(3);
        const shine = (sheen * lit).toFixed(3);
        if (shade !== faceShading[index].shade) {
            face.style.setProperty("--shade", shade);
            faceShading[index].shade = shade;
        }
        if (shine !== faceShading[index].sheen) {
            face.style.setProperty("--sheen", shine);
            faceShading[index].sheen = shine;
        }
    });
}

function measureCube() {
    cubeCenter.x = dom.cube.offsetLeft + dom.cube.offsetWidth / 2;
    cubeCenter.y = dom.cube.offsetTop + dom.cube.offsetHeight / 2;
}

function applyLight() {
    const { x, y, a } = lightState;
    const root = document.documentElement.style;

    light[0] = LIGHT[0] + (x * LIGHT_RANGE - LIGHT[0]) * a;
    light[1] = LIGHT[1] + (y * LIGHT_RANGE - LIGHT[1]) * a;

    const glowX = a > 0 ? `${Math.round(cubeCenter.x + x * window.innerWidth / 2 * GLOW_FOLLOW * a)}px` : "";
    const glowY = a > 0 ? `${Math.round(cubeCenter.y + y * window.innerHeight / 2 * GLOW_FOLLOW * a)}px` : "";
    if (glowX !== lightCss.x) {
        if (glowX) root.setProperty("--light-x", glowX);
        else root.removeProperty("--light-x");
        lightCss.x = glowX;
    }
    if (glowY !== lightCss.y) {
        if (glowY) root.setProperty("--light-y", glowY);
        else root.removeProperty("--light-y");
        lightCss.y = glowY;
    }

    const sx = `${(50 + x * SHEEN_SPREAD).toFixed(2)}%`;
    const sy = `${(50 + y * SHEEN_SPREAD).toFixed(2)}%`;
    const shift = (-x * a * SHADOW_SHIFT).toFixed(4);
    if (sx !== lightCss.sx) {
        dom.cube.style.setProperty("--sheen-x", sx);
        lightCss.sx = sx;
    }
    if (sy !== lightCss.sy) {
        dom.cube.style.setProperty("--sheen-y", sy);
        lightCss.sy = sy;
    }
    if (shift !== lightCss.shift) {
        dom.shadow.style.setProperty("--shadow-shift", shift);
        lightCss.shift = shift;
    }
}

function advanceLight(dt) {
    let changed = false;

    for (const key of ["x", "y", "a"]) {
        const previous = lightState[key];
        const diff = lightTarget[key] - previous;
        lightState[key] = Math.abs(diff) < 0.0005 ? lightTarget[key] : previous + diff * (1 - Math.exp(-dt * LIGHT_EASE));
        if (lightState[key] !== previous) changed = true;
    }

    if (changed) applyLight();
    return changed;
}

function onPointerMove(event) {
    if (event.pointerType === "touch") return;

    lightTarget.x = clamp((event.clientX - cubeCenter.x) / (window.innerWidth / 2), -1, 1);
    lightTarget.y = clamp((event.clientY - cubeCenter.y) / (window.innerHeight / 2), -1, 1);
    lightTarget.a = 1;
    requestTick();
}

function onPointerOut(event) {
    if (event.relatedTarget) return;

    lightTarget.a = 0;
    requestTick();
}

function updateCubeMax() {
    const max = COVER_SIZE / (window.devicePixelRatio || 1);
    document.documentElement.style.setProperty("--cube-max", `${max}px`);
}

function getScreenshotUrl(pen) {
    const urls = pen.screenshot_urls;
    if (!urls) return "";

    const needed = sourceHeight;

    for (const [key, width] of SCREENSHOT_SIZES) {
        if (urls[key] && (width * 9) / 16 >= needed) return urls[key];
    }

    for (const [key] of [...SCREENSHOT_SIZES].reverse()) {
        if (urls[key]) return urls[key];
    }

    return "";
}

function getDarkCoverUrl(pen) {
    if (!pen || darkMissing.has(pen.id)) return "";
    return darkCoverUrls.get(pen.id) || "";
}

function getImageUrl(pen) {
    const dark = isDarkTheme() ? getDarkCoverUrl(pen) : "";
    return dark || coverUrls.get(pen.id) || getScreenshotUrl(pen);
}

function isDarkTheme() {
    const theme = document.documentElement.dataset.theme;
    return theme === "dark" || (theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
}

function facePriority(stop) {
    const distance = Math.abs(stop - current);
    return distance < 0.8 ? 3 : distance < 1.8 ? 2 : 1;
}

function holdFaceForTheme(faceIndex, stop) {
    const face = dom.faces[faceIndex];
    ++faceVersion[faceIndex];
    faceStop[faceIndex] = stop;
    facePendingSrc[faceIndex] = "";
    faceWaitingForCover[faceIndex] = true;
    face.replaceChildren(createLoader());
}

function refreshImages(themeChange = false) {
    if (!rotations.length) return;
    if (themeChange) themeSwitchedAfterLoad = true;
    const previous = screenshots;
    screenshots = pens.map(getImageUrl);

    faceStop
        .map((stop, face) => ({ stop, face }))
        .filter(({ stop }) => stop > 0)
        .sort((a, b) => facePriority(b.stop) - facePriority(a.stop))
        .forEach(({ face, stop }) => {
            const pen = pens[stop - 1];
            if (themeChange && isDarkTheme() && pen?.id && !coverChecked.has(pen.id)) {
                holdFaceForTheme(face, stop);
                ensureCover(stop - 1);
                return;
            }

            if (screenshots[stop - 1] !== previous[stop - 1] || faceWaitingForCover[face]) {
                setFace(face, stop, { hideOld: themeChange });
            }
        });
}

function ensureCover(index) {
    const pen = pens[index];
    if (!pen?.id || coverChecked.has(pen.id)) return Promise.resolve();
    if (coverRequests.has(pen.id)) return coverRequests.get(pen.id);

    const promise = (async () => {
        try {
            const response = await request("cover", 1, pen.id);
            const url = response.data?.url;
            const darkUrl = response.data?.darkUrl;
            if (typeof url === "string" && url.startsWith("https://")) coverUrls.set(pen.id, url);
            if (typeof darkUrl === "string" && darkUrl.startsWith("https://")) darkCoverUrls.set(pen.id, darkUrl);
        } catch { /* Screenshot fallback. */ }

        coverChecked.add(pen.id);
        const next = getImageUrl(pen);
        const changed = next !== screenshots[index];
        screenshots[index] = next;
        faceStop.forEach((stop, face) => {
            if (stop === index + 1 && (changed || faceWaitingForCover[face])) {
                setFace(face, stop, { hideOld: faceWaitingForCover[face] });
            }
        });
    })();

    coverRequests.set(pen.id, promise);
    promise.finally(() => coverRequests.delete(pen.id));
    return promise;
}

function loadCovers() {
    const remaining = new Set(pens.map((_, i) => i));
    const workers = Array.from({ length: Math.min(4, pens.length) }, async () => {
        while (remaining.size) {
            let penIndex = -1;
            let bestDistance = Infinity;
            for (const index of remaining) {
                const distance = Math.abs(index + 1 - target);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    penIndex = index;
                }
            }
            remaining.delete(penIndex);
            await ensureCover(penIndex);
        }
    });
    return Promise.all(workers);
}

function trimImageCache() {
    for (const [key, entry] of imageCache) {
        if (imageCache.size <= MAX_IMAGE_CACHE) break;
        if (entry.state === "ready" || entry.state === "error") imageCache.delete(key);
    }
}

function processImageQueue() {
    while (activeImageLoads < MAX_IMAGE_LOADS && imageQueue.length) {
        imageQueue.sort((a, b) => b.priority - a.priority);
        const entry = imageQueue.shift();
        if (imageCache.get(entry.src) !== entry || !facePendingSrc.includes(entry.src)) {
            if (imageCache.get(entry.src) === entry) imageCache.delete(entry.src);
            entry.resolve(null);
            continue;
        }

        activeImageLoads++;
        entry.state = "loading";
        const image = new Image();
        image.alt = "";
        image.decoding = "async";

        const done = success => {
            image.onload = null;
            image.onerror = null;
            entry.state = success ? "ready" : "error";
            if (!success && imageCache.get(entry.src) === entry) imageCache.delete(entry.src);
            entry.resolve(success ? image : null);
            activeImageLoads--;
            trimImageCache();
            processImageQueue();
        };

        image.onload = () => image.decode().then(() => done(true), () => done(true));
        image.onerror = () => done(false);
        image.src = entry.src;
    }
}

function loadImage(src, priority = 1) {
    const existing = imageCache.get(src);
    if (existing) {
        existing.priority = Math.max(existing.priority, priority);
        imageCache.delete(src);
        imageCache.set(src, existing);
        processImageQueue();
        return existing.promise;
    }

    let resolve;
    const promise = new Promise(done => { resolve = done; });
    const entry = { src, promise, resolve, priority, state: "queued" };
    imageCache.set(src, entry);
    imageQueue.push(entry);
    processImageQueue();
    trimImageCache();
    return promise;
}

function indexChildren(card) {
    [...card.children].forEach((element, index) => element.style.setProperty("--i", index));
}

function hideLoader(state) {
    const spinner = dom.loader.firstElementChild;

    if (Number(getComputedStyle(spinner).opacity) > 0) {
        spinner.addEventListener("transitionend", () => dom.loader.remove(), { once: true });
    } else {
        dom.loader.remove();
    }

    document.body.dataset.state = state;
}

function updateThemeSwitch() {
    const dark = isDarkTheme();
    dom.themeSwitch.dataset.current = dark ? "dark" : "light";
    dom.themeSwitch.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
}

function setTheme(theme) {
    if (document.documentElement.dataset.theme === theme && dom.themeSwitch.dataset.ready) return;
    document.documentElement.dataset.theme = theme;
    dom.themeSwitch.dataset.ready = "true";
    updateThemeSwitch();
    refreshImages(true);
}

function onThemeClick() {
    setTheme(isDarkTheme() ? "light" : "dark");
}

function initTheme() {
    const theme = document.documentElement.dataset.theme;
    setTheme(theme === "auto" ? "auto" : theme === "dark" ? "dark" : "light");
    dom.themeSwitch.addEventListener("click", onThemeClick);
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if (document.documentElement.dataset.theme === "auto") {
            updateThemeSwitch();
            refreshImages(true);
        }
    });
}

function createPlaceholder(text) {
    const placeholder = document.createElement("span");
    placeholder.className = "face-placeholder";
    placeholder.textContent = text;
    return placeholder;
}

function createLoader() {
    const wrapper = document.createElement("span");
    wrapper.className = "face-placeholder";

    const spinner = document.createElement("span");
    spinner.className = "face-spinner";

    wrapper.append(spinner);
    return wrapper;
}

function createIntroFace() {
    const intro = document.createElement("div");
    intro.className = "face-intro";

    const label = document.createElement("span");
    label.className = "face-intro-label";
    label.textContent = "Collection";

    const title = document.createElement("span");
    title.className = "face-intro-title";
    title.textContent = collection.title || "Untitled Collection";

    const count = document.createElement("span");
    count.className = "face-intro-count";
    count.textContent = plural(pens.length);

    intro.append(label, title, count);
    return intro;
}

async function setFace(faceIndex, stop, { hideOld = false } = {}) {
    const face = dom.faces[faceIndex];
    const src = stop > 0 ? screenshots[stop - 1] : "";

    if (!faceWaitingForCover[faceIndex] && faceStop[faceIndex] === stop && facePendingSrc[faceIndex] === src && src) return;

    const version = ++faceVersion[faceIndex];
    faceStop[faceIndex] = stop;
    facePendingSrc[faceIndex] = "";
    faceWaitingForCover[faceIndex] = false;

    if (stop === 0) {
        face.replaceChildren(createIntroFace());
        return;
    }

    if (!src) {
        face.replaceChildren(createPlaceholder("No screenshot"));
        return;
    }

    const existing = [...face.querySelectorAll("img")];
    const top = existing.at(-1);
    if (top?.src === src && top.complete && top.naturalWidth) return;

    const base = existing[0];
    if (base?.src === src && base.complete && base.naturalWidth) {
        base.classList.remove("is-entering");
        face.replaceChildren(base);
        return;
    }

    facePendingSrc[faceIndex] = src;
    if (hideOld && imageCache.get(src)?.state !== "ready") {
        face.replaceChildren(createLoader());
    } else if (!existing.length && !face.querySelector(".face-placeholder")) {
        face.replaceChildren(createLoader());
    }

    const loaded = await loadImage(src, facePriority(stop));
    if (faceVersion[faceIndex] !== version || faceStop[faceIndex] !== stop || screenshots[stop - 1] !== src) return;

    if (!loaded) {
        facePendingSrc[faceIndex] = "";
        const pen = pens[stop - 1];
        if (getDarkCoverUrl(pen) === src) {
            darkMissing.add(pen.id);
            screenshots[stop - 1] = getImageUrl(pen);
            setFace(faceIndex, stop);
            return;
        }
        if (coverUrls.get(pen?.id) === src) {
            coverUrls.delete(pen.id);
            screenshots[stop - 1] = getImageUrl(pen);
            setFace(faceIndex, stop);
            return;
        }
        if (!face.querySelector("img")) face.replaceChildren(createPlaceholder("No screenshot"));
        return;
    }

    const image = loaded.cloneNode(false);
    image.alt = "";
    image.decoding = "async";
    await image.decode().catch(() => {});
    if (faceVersion[faceIndex] !== version || faceStop[faceIndex] !== stop || screenshots[stop - 1] !== src) return;
    facePendingSrc[faceIndex] = "";

    const images = [...face.querySelectorAll("img")];
    if (images[0]?.src === src) {
        images[0].classList.remove("is-entering");
        face.replaceChildren(images[0]);
        return;
    }
    if (images.length > 1) images.slice(1).forEach(el => el.remove());

    const loader = face.querySelector(".face-placeholder");
    if (loader) loader.classList.add("is-done");

    image.classList.add("is-entering");
    image.addEventListener("animationend", () => {
        if (!face.contains(image)) return;
        image.classList.remove("is-entering");
        if (face.querySelector("img:last-of-type") === image) face.replaceChildren(image);
        else image.remove();
    }, { once: true });
    face.append(image);
}

function assignFaces(base) {
    const count = rotations.length;
    const center = count > 1 ? base + 0.5 : 0;

    for (let face = 0; face < 6; face++) {
        let best = -1;
        let bestDistance = Infinity;

        for (let stop = 0; stop < count; stop++) {
            if (faceAtStop(stop) !== face) continue;

            const distance = Math.abs(stop - center);

            if (distance < bestDistance) {
                best = stop;
                bestDistance = distance;
            }
        }

        if (best !== -1 && Math.abs(best - center) <= 1.5 && best !== faceStop[face]) {
            const pen = pens[best - 1];
            if (themeSwitchedAfterLoad && isDarkTheme() && pen?.id && !coverChecked.has(pen.id)) {
                holdFaceForTheme(face, best);
                ensureCover(best - 1);
            } else {
                setFace(face, best);
            }
        }
    }
}

function measure() {
    const viewport = window.innerHeight;
    maxScroll = Math.max(0, document.documentElement.scrollHeight - viewport);

    anchors = stopElements.map(element => {
        const rect = element.getBoundingClientRect();
        const centered = rect.top + window.scrollY + rect.height / 2 - viewport / 2;
        return clamp(centered, 0, maxScroll);
    });
}

function scrollToStop(y) {
    if (anchors.length < 2 || y <= anchors[0]) return 0;

    for (let i = 0; i < anchors.length - 1; i++) {
        const a = anchors[i];
        const b = anchors[i + 1];

        if (y < b) {
            return b > a ? i + (y - a) / (b - a) : i + 1;
        }
    }

    return anchors.length - 1;
}

function updateHud() {
    const active = Math.round(target);
    const last = rotations.length - 1;

    dom.progress.style.transform = `scaleX(${last > 0 ? target / last : 0})`;

    if (active !== lastActive) {
        lastActive = active;
        dom.hudCount.textContent = `${pad(active)} / ${pad(pens.length)}`;
    }
}

function render(lightChanged = false) {
    applyTransform(current, lightChanged);

    const base = rotations.length > 1 ?
        clamp(Math.floor(current), 0, rotations.length - 2) :
        0;

    if (base !== lastBase) {
        lastBase = base;
        assignFaces(base);
    }
}

function tick(now) {
    frameId = 0;
    const dt = lastTime ? clamp((now - lastTime) / 1000, 0.001, 0.05) : 1 / 60;
    lastTime = now;

    if (anchorMotion) {
        const motion = anchorMotion;
        const progress = clamp((now - motion.startTime) / motion.duration, 0, 1);
        const nextY = motion.startY + motion.distance * motion.ease(progress);
        window.scrollTo(0, nextY);
        target = scrollToStop(nextY);
        current = target;
        updateHud();
        if (progress === 1) anchorMotion = null;
    } else {
        velocity *= Math.pow(wheelFriction(velocity), dt * 60);
        if (Math.abs(velocity) < 0.01) velocity = 0;

        if (Math.abs(velocity) > 0.2) {
            const y = clamp(window.scrollY + velocity * WHEEL_EASE * dt * 60, 0, maxScroll);
            window.scrollTo(0, y);
            target = scrollToStop(y);
            updateHud();
        }

        current += (target - current) * (1 - Math.exp(-dt * 8));
        if (Math.abs(target - current) < 0.0005) current = target;
    }

    const leanSettled = advanceLean(dt);
    const lightChanged = advanceLight(dt);
    render(lightChanged);

    if (anchorMotion || velocity || current !== target || !leanSettled ||
        (Math.abs(lightTarget.x - lightState.x) >= 0.0005 ||
        Math.abs(lightTarget.y - lightState.y) >= 0.0005 ||
        Math.abs(lightTarget.a - lightState.a) >= 0.0005)) {
        frameId = requestAnimationFrame(tick);
    } else {
        lastTime = 0;
    }
}

function requestTick() {
    if (!frameId) frameId = requestAnimationFrame(tick);
}

function stopAnchor() {
    anchorMotion = null;
}

function scrollToY(y) {
    stopAnchor();
    velocity = 0;

    const startY = window.scrollY;
    const distance = y - startY;
    const stops = Math.abs(scrollToStop(y) - scrollToStop(startY));
    const isJump = stops > 1.5;
    const duration = isJump ? Math.min(ANCHOR_DURATION + (stops - 1) * JUMP_STEP, JUMP_MAX) : ANCHOR_DURATION;

    anchorMotion = {
        startY,
        distance,
        startTime: performance.now(),
        duration,
        ease: isJump ? easeInOutQuart : easeInOutCubic
    };
    requestTick();
}

function onScroll() {
    if (anchorMotion) return;
    target = scrollToStop(window.scrollY);
    updateHud();
    requestTick();
}

function scheduleLayout() {
    if (layoutId) return;
    layoutId = requestAnimationFrame(() => {
        layoutId = 0;
        onLayout();
    });
}

function onLayout() {
    updateCubeMax();

    const height = dom.cube.offsetWidth * (window.devicePixelRatio || 1);
    if (Math.abs(sourceHeight - height) > 1) {
        sourceHeight = height;
        refreshImages();
    }

    measure();
    measureCube();
    if (lightState.a) {
        lightCss.x = "";
        lightCss.y = "";
        applyLight();
    }
    onScroll();
}

function onWheel(event) {
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;

    stopAnchor();

    const delta = event.deltaMode === 1 ?
        event.deltaY * 16 :
        event.deltaMode === 2 ?
        event.deltaY * window.innerHeight * 0.9 :
        event.deltaY;

    if (Math.abs(delta) < 5) return;
    if ((delta < 0 && window.scrollY <= 0) || (delta > 0 && window.scrollY >= maxScroll - 1)) return;

    event.preventDefault();
    velocity = clamp(velocity + delta, -WHEEL_MAX_VELOCITY, WHEEL_MAX_VELOCITY);
    requestTick();
}

function stopMotion() {
    stopAnchor();
    velocity = 0;
}

function onClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

    const link = event.target.closest('a[href^="#s"]');
    if (!link) return;

    const index = stopElements.indexOf(document.querySelector(link.getAttribute("href")));
    if (index === -1) return;

    event.preventDefault();
    scrollToY(anchors[index]);
}

function createLink(href, text, icon = false) {
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = text;

    if (icon) {
        link.insertAdjacentHTML("beforeend", ICON_EXTERNAL);
    }

    return link;
}

function createNavLink(stop, text, back) {
    const link = document.createElement("a");
    link.className = back ? "cta-back" : "cta";
    link.href = `#s${stop}`;

    if (back) {
        link.insertAdjacentHTML("beforeend", ICON_BACK);
        link.append(text);
    } else {
        link.append(text);
        link.insertAdjacentHTML("beforeend", ICON_NEXT);
    }

    return link;
}

function createPenStop(pen, index) {
    const stopIndex = index + 1;
    const isLast = index === pens.length - 1;

    const stop = document.createElement("li");
    stop.id = `s${stopIndex}`;
    stop.className = "stop pen";

    if (index % 2 === 0) {
        stop.classList.add("is-end");
    }

    const card = document.createElement("article");
    card.className = "card";

    if (CONFIG.numerals) {
        card.dataset.index = pad(stopIndex);
    }

    const number = document.createElement("p");
    number.className = "pen-index";
    number.textContent = pad(stopIndex);

    const title = pen.title || "Untitled Pen";
    const titleHref = pen.urls?.editor || pen.urls?.preview;
    const heading = document.createElement("h2");
    heading.append(titleHref ? createLink(titleHref, title) : title);

    card.append(number, heading);

    if (pen.description) {
        const description = document.createElement("p");
        description.className = "card-description";
        description.textContent = pen.description;
        card.append(description);
    }

    const meta = document.createElement("p");
    meta.className = "card-meta";

    const editor = document.createElement("span");
    editor.textContent = pen.editor === "V2" ? "CodePen 2.0" : "Classic";
    meta.append(editor);

    if (pen.created_at) {
        const date = new Date(pen.created_at);

        if (!Number.isNaN(date.getTime())) {
            const time = document.createElement("time");
            time.dateTime = pen.created_at;
            time.textContent = date.toLocaleDateString("en-GB");
            meta.append(time);
        }
    }

    card.append(meta);

    const previewHref = pen.urls?.preview || pen.urls?.editor;

    if (previewHref) {
        const links = document.createElement("p");
        links.className = "card-links";
        links.append(createLink(previewHref, "Preview", true));
        card.append(links);
    }

    const nav = document.createElement("div");
    nav.className = "cta-row";
    nav.append(
        createNavLink(stopIndex - 1, "Back", true),
        isLast ? createNavLink(0, "Begin again", false) : createNavLink(stopIndex + 1, "Turn", false)
    );
    card.append(nav);
    indexChildren(card);

    stop.append(card);
    return stop;
}

function renderCollection() {
    dom.title.textContent = collection.title || "Untitled Collection";
    dom.description.textContent = collection.description || "";
    dom.description.hidden = !collection.description;
    dom.status.textContent = pens.length ? plural(pens.length) : "No public Pens in this Collection";
    dom.introNav.hidden = pens.length === 0;

    if (collection.url) {
        dom.collectionLink.href = collection.url;
        dom.collectionLink.hidden = false;
    }
}

function renderPens() {
    const fragment = document.createDocumentFragment();
    pens.forEach((pen, index) => fragment.append(createPenStop(pen, index)));
    dom.pens.replaceChildren(fragment);

    const observer = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                const card = entry.target;

                if (entry.intersectionRatio >= REVEAL_THRESHOLD) {
                    card.classList.remove("is-reset");
                    card.classList.add("is-visible");
                    if (CONFIG.cardReveal === "once") observer.unobserve(card);
                    return;
                }

                if (entry.isIntersecting || CONFIG.cardReveal === "once") return;
                if (CONFIG.cardReveal === "forward" && entry.boundingClientRect.top < 0) return;

                card.classList.add("is-reset");
                card.classList.remove("is-visible");
            });
        }, { threshold: [0, REVEAL_THRESHOLD] }
    );

    dom.stops.querySelectorAll(".card").forEach(card => observer.observe(card));
}

function start() {
    stopElements = [...dom.stops.querySelectorAll(".stop")];
    rotations = buildRotations(stopElements.length);

    dom.scene.hidden = false;
    dom.hud.hidden = pens.length === 0;

    sourceHeight = dom.cube.offsetWidth * (window.devicePixelRatio || 1);
    screenshots = pens.map(getImageUrl);

    measure();
    measureCube();

    target = scrollToStop(window.scrollY);
    current = target;
    leanPrev = current;
    updateHud();
    render();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", stopMotion, { passive: true });
    window.addEventListener("mousedown", stopMotion, { passive: true });
    window.addEventListener("keydown", stopMotion);
    window.addEventListener("resize", scheduleLayout);

    if (CONFIG.pointerLight) {
        window.addEventListener("blur", onPointerOut);
        document.addEventListener("pointermove", onPointerMove, { passive: true });
        document.addEventListener("pointerout", onPointerOut);
    }

    document.addEventListener("click", onClick);
    new ResizeObserver(scheduleLayout).observe(dom.stops);
}

async function load() {
    try {
        const [collectionResponse, pensData] = await Promise.all([request("collection"), getPens()]);
        const collectionData = collectionResponse.data;

        if (collectionData?.access !== "Public") {
            throw new Error("This Collection is not public");
        }

        collection = collectionData;
        pens = pensData.filter(pen => pen?.access === "Public");

        renderCollection();
        renderPens();
        start();
        loadCovers();
        requestAnimationFrame(() => hideLoader("ready"));
    } catch (error) {
        console.error(error);
        dom.introCard.classList.add("is-visible");
        hideLoader("error");
        dom.status.textContent = "Error";
        dom.error.textContent = error.message;
        dom.error.hidden = false;
    }
}

updateCubeMax();
initTheme();
indexChildren(dom.introCard);
load();