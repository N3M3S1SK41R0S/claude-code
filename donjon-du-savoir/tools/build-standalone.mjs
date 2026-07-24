// Bundles the whole game into a single self-contained HTML file — no server,
// no service worker, no external fetch. Same source of truth as the PWA:
// modules are concatenated with a tiny CommonJS shim (each keeps its own
// scope, so name collisions like `pick` are fine), CSS and the question bank
// are inlined, and fetch("data/questions.json") is intercepted.
// Emits: dist/donjon-standalone.html (full page, for file:// + tests)
//        dist/donjon-artifact.html   (body-only, for the Artifact tool)
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const R = (p) => readFileSync(join(root, p), "utf8");

// Dependency-agnostic: the CommonJS shim resolves lazily, so order only needs
// the entry last. We register every module, then require("./app.js").
const MODULES = [
  "host-voice", "tts", "sfx", "music", "voices", "bots", "prefs", "palmares", "herald", "powers", "portraits", "custom", "items", "minigames",
  "wordgames", "themes", "state", "board", "data", "ui", "scene", "models3d", "board3d", "game", "app",
];

function collectExports(src) {
  const names = new Set();
  for (const re of [
    /^export\s+async\s+function\s+([A-Za-z0-9_$]+)/gm,
    /^export\s+function\s+([A-Za-z0-9_$]+)/gm,
    /^export\s+const\s+([A-Za-z0-9_$]+)/gm,
  ]) {
    let m;
    while ((m = re.exec(src))) names.add(m[1]);
  }
  const braceRe = /^export\s*\{([^}]*)\}\s*;?\s*$/gm;
  let b;
  while ((b = braceRe.exec(src))) {
    for (const part of b[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name) names.add(name);
    }
  }
  return [...names];
}

function transform(name, src) {
  const exports = collectExports(src);
  let code = src
    // import { a, b } from "./x.js"  →  const { a, b } = require("./x.js")
    .replace(/^import\s*\{([^}]*)\}\s*from\s*["']\.\/([-A-Za-z0-9_$]+)\.js["'];?/gm,
      (_, names, mod) => `const {${names}} = require("./${mod}.js");`)
    // drop `export { ... }` statements (re-exported explicitly at the end)
    .replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, "")
    // unwrap declaration exports
    .replace(/^export\s+async\s+function/gm, "async function")
    .replace(/^export\s+function/gm, "function")
    .replace(/^export\s+const/gm, "const");
  const tail = exports.length
    ? `\n;Object.assign(module.exports, {${exports.join(", ")}});`
    : "";
  return `__modules["./${name}.js"] = function(module, exports, require) {\n${code}${tail}\n};`;
}

const bundleParts = MODULES.map((name) => transform(name, R(`js/${name}.js`)));
const bank = JSON.parse(R("data/questions.json"));
const wordgames = JSON.parse(R("data/wordgames.json"));

const runtime = `
(function () {
  "use strict";
  const __QUESTIONS = ${JSON.stringify(bank)};
  const __WORDGAMES = ${JSON.stringify(wordgames)};
  // Intercept the data fetches; everything else stays real (there is nothing else).
  const __realFetch = typeof window.fetch === "function" ? window.fetch.bind(window) : null;
  window.fetch = function (url, ...rest) {
    if (String(url).indexOf("questions.json") !== -1) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(__QUESTIONS) });
    }
    if (String(url).indexOf("wordgames.json") !== -1) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(__WORDGAMES) });
    }
    return __realFetch ? __realFetch(url, ...rest) : Promise.reject(new Error("offline"));
  };
  // No service worker in the single-file build: app.js registers "sw.js"
  // inside a try/.catch, and that file simply does not exist here, so the
  // registration rejects harmlessly. We leave navigator untouched.
  const __modules = {};
  const __cache = {};
  function require(id) {
    if (__cache[id]) return __cache[id].exports;
    const m = { exports: {} };
    __cache[id] = m;
    if (!__modules[id]) throw new Error("Module introuvable: " + id);
    __modules[id](m, m.exports, require);
    return m.exports;
  }
${bundleParts.join("\n")}
  require("./app.js");
})();`;

// Body of index.html, minus the module script tag and any head-only links.
const indexHtml = R("index.html");
let body = indexHtml.replace(/^[\s\S]*?<body[^>]*>/, "").replace(/<\/body>[\s\S]*$/, "");
body = body.replace(/<script[^>]*type="module"[^>]*><\/script>/, "");
// Les scripts vendorés seront injectés ci-dessous : aucun src résiduel ne doit
// provoquer de requête en file:// dans le fichier autonome.
body = body.replace(/<script[^>]*src="vendor\/[^"]+"[^>]*><\/script>\s*/g, "");

const css = R("css/style.css");

// Inline récursivement les illustrations et les accroches vocales en data-URI :
// le fichier unique n'a aucun serveur, y compris lorsqu'il est ouvert en file://.
function inlineAssets(text) {
  const dir = join(root, "assets");
  let out = text;
  let count = 0;
  const files = [];
  const walk = (current, relative = "") => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(join(current, entry.name), rel);
      else files.push(rel);
    }
  };
  walk(dir);
  const mimeByExtension = {
    png: "image/png",
    webp: "image/webp",
    webm: "audio/webm;codecs=opus",
    glb: "model/gltf-binary",
  };
  for (const file of files) {
    const extension = file.split(".").pop().toLowerCase();
    const mime = mimeByExtension[extension];
    if (!mime) continue;
    const ref = `assets/${file}`;
    if (!out.includes(ref)) continue;
    const dataUri = `data:${mime};base64,${readFileSync(join(dir, file)).toString("base64")}`;
    out = out.split(ref).join(dataUri);
    count += 1;
  }
  assetCount = count;
  return out;
}
let assetCount = 0;

// three.js (MIT) embarqué : la vue 3D fonctionne hors-ligne, sans aucun CDN.
// Il expose le global THREE, utilisé par board3d.js ; repli 2D si absent.
const three = R("vendor/three.min.js");
const dracoLoader = R("vendor/DRACOLoader.js");
const gltfLoader = R("vendor/GLTFLoader.js");
const dracoWrapper = R("vendor/draco/draco_wasm_wrapper.js");
const dracoWasm = readFileSync(join(root, "vendor", "draco", "draco_decoder.wasm")).toString("base64");
const dracoResources = `globalThis.__DONJON_DRACO={
  wrapper:${JSON.stringify(dracoWrapper)},
  wasm:Uint8Array.from(atob("${dracoWasm}"),c=>c.charCodeAt(0)).buffer
};`;

const artifactContent = inlineAssets(`<style>\n${css}\n</style>\n${body}\n<script>${three}</script>\n<script>${dracoLoader}</script>\n<script>${gltfLoader}</script>\n<script>${dracoResources}</script>\n<script>${runtime}</script>\n`);

// Icône embarquée : le fichier standalone montre une vraie icône du jeu dans
// l'onglet du navigateur et sur l'écran d'accueil (« Ajouter à l'écran »),
// pour qu'on puisse le lancer d'un clic sur une jolie icône plutôt que sur un
// fichier anonyme.
const iconUri = (f) => `data:image/png;base64,${readFileSync(join(root, "icons", f)).toString("base64")}`;
const favicon = iconUri("icon-192.png");
const appleIcon = iconUri("apple-touch-icon.png");

const fullPage = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Le Donjon du Savoir</title>
<meta name="theme-color" content="#1a1230" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Le Donjon du Savoir" />
<link rel="icon" type="image/png" href="${favicon}" />
<link rel="apple-touch-icon" href="${appleIcon}" />
</head>
<body>
${artifactContent}</body>
</html>
`;

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist", "donjon-standalone.html"), fullPage, "utf8");
writeFileSync(join(root, "dist", "donjon-artifact.html"), artifactContent, "utf8");
const kb = (s) => Math.round(Buffer.byteLength(s) / 1024);
console.log(`✓ dist/donjon-standalone.html (${kb(fullPage)} Ko, ${bank.questions.length} questions, ${assetCount} assets inline)`);
console.log(`✓ dist/donjon-artifact.html (${kb(artifactContent)} Ko)`);
