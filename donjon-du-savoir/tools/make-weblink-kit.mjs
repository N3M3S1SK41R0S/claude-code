// Construit un « kit lien direct » : des raccourcis de bureau qui ouvrent le
// jeu EN LIGNE (donc toujours la dernière version, sans rien à remplacer),
// avec la véritable icône du Donjon. Très léger : aucune copie du jeu.
// Lancer : node tools/make-weblink-kit.mjs [url]
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist", "lien-direct-kit");
const URL_JEU = process.argv[2] ?? "https://claude.ai/code/artifact/e2127687-04c1-40c0-be43-f0e5f8b27205";
const VERSION = readFileSync(join(root, "sw.js"), "utf8").match(/const VERSION = "([^"]+)"/)?.[1] ?? "inconnue";

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

function findChromium() {
  const s = "/opt/pw-browsers/chromium/chrome-linux/chrome";
  return existsSync(s) && statSync(s).isFile() ? s : "/opt/pw-browsers/chromium";
}

/* ---- 1. Icônes aux tailles attendues par chaque système ---- */
const srcB64 = "data:image/png;base64," + readFileSync(join(root, "icons", "icon-512.png")).toString("base64");
const SIZES = [16, 24, 32, 48, 64, 128, 256, 512];
const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-proxy-server"] });
const page = await browser.newPage();
const pngs = {};
for (const size of SIZES) {
  const dataUrl = await page.evaluate(async ({ src, size }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, size, size);
    return c.toDataURL("image/png");
  }, { src: srcB64, size });
  pngs[size] = Buffer.from(dataUrl.split(",")[1], "base64");
}
await browser.close();

function buildIco(sizes) {
  const entries = sizes.map((s) => ({ size: s, data: pngs[s] }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + 16 * entries.length;
  entries.forEach((e, i) => {
    const b = dir.subarray(i * 16, i * 16 + 16);
    b.writeUInt8(e.size >= 256 ? 0 : e.size, 0);
    b.writeUInt8(e.size >= 256 ? 0 : e.size, 1);
    b.writeUInt8(0, 2); b.writeUInt8(0, 3);
    b.writeUInt16LE(1, 4); b.writeUInt16LE(32, 6);
    b.writeUInt32LE(e.data.length, 8);
    b.writeUInt32LE(offset, 12);
    offset += e.data.length;
  });
  return Buffer.concat([header, dir, ...entries.map((e) => e.data)]);
}
function buildIcns(map) {
  const chunks = [];
  for (const [type, size] of Object.entries(map)) {
    const data = pngs[size];
    const head = Buffer.alloc(8);
    head.write(type, 0, "ascii");
    head.writeUInt32BE(8 + data.length, 4);
    chunks.push(head, data);
  }
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(8);
  header.write("icns", 0, "ascii");
  header.writeUInt32BE(8 + body.length, 4);
  return Buffer.concat([header, body]);
}
writeFileSync(join(out, "donjon.ico"), buildIco([16, 24, 32, 48, 64, 128, 256]));
writeFileSync(join(out, "donjon.icns"), buildIcns({ ic07: 128, ic08: 256, ic09: 512 }));
writeFileSync(join(out, "donjon-512.png"), pngs[512]);

/* ---- 2. Windows : un .cmd qui pose sur le Bureau un raccourci Internet
        (.url) portant l'icône du Donjon — la méthode qui affiche l'icône à
        coup sûr, car le chemin de l'icône y est absolu. ---- */
writeFileSync(join(out, "Windows — Créer le raccourci du bureau.cmd"),
  "@echo off\r\n" +
  "chcp 65001 >nul\r\n" +
  "setlocal\r\n" +
  "set \"HERE=%~dp0\"\r\n" +
  "set \"ICON=%HERE%donjon.ico\"\r\n" +
  `set "JEU=${URL_JEU}"\r\n` +
  "powershell -NoProfile -ExecutionPolicy Bypass -Command \"" +
  "$d=[Environment]::GetFolderPath('Desktop'); " +
  "$f=Join-Path $d 'Le Donjon du Savoir.url'; " +
  "$c=\\\"[InternetShortcut]`nURL=$env:JEU`nIconFile=$env:ICON`nIconIndex=0`n\\\"; " +
  "Set-Content -LiteralPath $f -Value $c -Encoding Default\"\r\n" +
  "echo.\r\n" +
  "echo  Raccourci « Le Donjon du Savoir » cree sur le Bureau.\r\n" +
  "echo  Double-cliquez dessus : le jeu s'ouvre dans votre navigateur.\r\n" +
  "echo  (Gardez ce dossier : l'icone y est stockee.)\r\n" +
  "echo.\r\n" +
  "pause\r\n", "utf8");

/* ---- 3. macOS : un .command (auquel on peut coller l'icône) + un .webloc ---- */
writeFileSync(join(out, "macOS — Le Donjon du Savoir.command"),
  "#!/bin/bash\n" +
  `open "${URL_JEU}"\n`, "utf8");
writeFileSync(join(out, "Le Donjon du Savoir.webloc"),
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
  '<plist version="1.0">\n<dict>\n\t<key>URL</key>\n\t<string>' + URL_JEU + '</string>\n</dict>\n</plist>\n', "utf8");

/* ---- 4. Linux : installeur .desktop avec l'icône en chemin absolu ---- */
writeFileSync(join(out, "Linux — Installer le raccourci.sh"),
  "#!/usr/bin/env bash\n" +
  "set -e\n" +
  "DIR=\"$(cd \"$(dirname \"$0\")\" && pwd)\"\n" +
  "APPS=\"$HOME/.local/share/applications\"\n" +
  "mkdir -p \"$APPS\"\n" +
  "DESK=\"$APPS/donjon-du-savoir-lien.desktop\"\n" +
  "cat > \"$DESK\" <<EOF\n" +
  "[Desktop Entry]\n" +
  "Type=Application\n" +
  "Name=Le Donjon du Savoir\n" +
  "Comment=Jeu de plateau de culture générale (dernière version en ligne)\n" +
  `Exec=xdg-open "${URL_JEU}"\n` +
  "Icon=$DIR/donjon-512.png\n" +
  "Terminal=false\n" +
  "Categories=Game;Education;\n" +
  "EOF\n" +
  "chmod +x \"$DESK\"\n" +
  "for B in \"$HOME/Bureau\" \"$HOME/Desktop\"; do [ -d \"$B\" ] && cp \"$DESK\" \"$B/\" 2>/dev/null || true; done\n" +
  "echo 'Icone installee. Cherchez « Le Donjon du Savoir » dans vos applications ou sur le Bureau.'\n", "utf8");

/* ---- 5. Mode d'emploi ---- */
writeFileSync(join(out, "LISEZ-MOI.txt"),
`LE DONJON DU SAVOIR — raccourci « lien direct »
===============================================

Ce dossier crée sur votre bureau une icône qui ouvre le jeu EN LIGNE.
Gros avantage : elle pointe TOUJOURS sur la dernière version — il n'y a
jamais rien à remplacer, contrairement au fichier hors-ligne.

  Adresse ouverte : ${URL_JEU}
  Version en ligne au moment de la création de ce kit : ${VERSION}

Gardez ce dossier quelque part (par ex. dans « Documents ») : l'icône y
est stockée, le raccourci va la chercher ici.

——— WINDOWS ———
  1. Double-cliquez sur « Windows — Créer le raccourci du bureau.cmd ».
     (Avertissement SmartScreen éventuel : « Informations complémentaires »
      puis « Exécuter quand même » — le script crée juste un raccourci.)
  2. L'icône « Le Donjon du Savoir » apparaît sur le Bureau.

——— macOS ———
  Le plus simple : glissez « Le Donjon du Savoir.webloc » sur le Bureau
  ou dans le Dock.
  Pour une jolie icône : sélectionnez « donjon.icns », Cmd+C. Puis clic
  droit sur « macOS — Le Donjon du Savoir.command » → Lire les
  informations → cliquez la petite icône en haut à gauche → Cmd+V.
  Glissez ensuite ce fichier sur le Bureau. (Au 1er lancement : clic
  droit → Ouvrir → Ouvrir, pour autoriser.)

——— LINUX ———
  chmod +x "Linux — Installer le raccourci.sh" && "./Linux — Installer le raccourci.sh"

——— BON À SAVOIR ———
  • Ce raccourci a besoin d'internet, et que vous soyez connecté au
    compte Claude qui héberge la page (le lien est privé).
  • Pour jouer SANS internet (en voiture, en vacances, chez des amis),
    utilisez l'autre kit : celui qui embarque le jeu en un seul fichier.
  • Pour vérifier la version en cours de jeu : Réglages, tout en bas.
`, "utf8");

console.log(`✓ dist/lien-direct-kit/ créé (lien : ${URL_JEU}, version en ligne : ${VERSION})`);
