// Builds a cross-platform "desktop launcher kit" for Le Donjon du Savoir:
// a stylised icon (.ico / .icns / .png) generated from the app icon, the
// offline single-file game, and a launcher per OS + instructions.
// Run: node tools/make-launcher.mjs
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, rmSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist", "launcher-kit");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

function findChromium() {
  const s = "/opt/pw-browsers/chromium/chrome-linux/chrome";
  return existsSync(s) && statSync(s).isFile() ? s : "/opt/pw-browsers/chromium";
}

// ---- 1. Resize the app icon to the sizes each format needs (via Chromium canvas) ----
const srcB64 = "data:image/png;base64," + readFileSync(join(root, "icons", "icon-512.png")).toString("base64");
const SIZES = [16, 24, 32, 48, 64, 128, 256, 512];
const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-proxy-server"] });
const page = await browser.newPage();
const pngs = {}; // size -> Buffer
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

// ---- 2. Assemble a Windows .ico (PNG-in-ICO, supported since Vista) ----
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
writeFileSync(join(out, "donjon.ico"), buildIco([16, 24, 32, 48, 64, 128, 256]));

// ---- 3. Assemble a macOS .icns (PNG entries ic07/ic08/ic09) ----
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
writeFileSync(join(out, "donjon.icns"), buildIcns({ ic07: 128, ic08: 256, ic09: 512 }));

// ---- 4. PNG icons for Linux / generic ----
writeFileSync(join(out, "donjon-512.png"), pngs[512]);
writeFileSync(join(out, "donjon-256.png"), pngs[256]);

// ---- 5. The offline game, renamed nicely ----
copyFileSync(join(root, "dist", "donjon-standalone.html"), join(out, "Le Donjon du Savoir.html"));

// ---- 6. Launchers per OS ----
// Windows : a .cmd that creates a Desktop shortcut (.lnk) with the custom icon.
writeFileSync(join(out, "Windows — Créer le raccourci du bureau.cmd"),
  "@echo off\r\n" +
  "chcp 65001 >nul\r\n" +
  "setlocal\r\n" +
  "set \"HERE=%~dp0\"\r\n" +
  "set \"GAME=%HERE%Le Donjon du Savoir.html\"\r\n" +
  "set \"ICON=%HERE%donjon.ico\"\r\n" +
  "powershell -NoProfile -ExecutionPolicy Bypass -Command \"$w=New-Object -ComObject WScript.Shell; $lnk=Join-Path ([Environment]::GetFolderPath('Desktop')) 'Le Donjon du Savoir.lnk'; $s=$w.CreateShortcut($lnk); $s.TargetPath=$env:GAME; $s.IconLocation=$env:ICON; $s.WorkingDirectory=$env:HERE; $s.Description='Le Donjon du Savoir'; $s.Save()\"\r\n" +
  "echo.\r\n" +
  "echo  Raccourci « Le Donjon du Savoir » cree sur le Bureau. \r\n" +
  "echo  Double-cliquez dessus pour jouer (le jeu s'ouvre dans votre navigateur, sans internet).\r\n" +
  "echo.\r\n" +
  "pause\r\n", "utf8");

// macOS : a double-clickable .command that opens the game in the default browser.
writeFileSync(join(out, "macOS — Lancer le jeu.command"),
  "#!/bin/bash\n" +
  "DIR=\"$(cd \"$(dirname \"$0\")\" && pwd)\"\n" +
  "open \"$DIR/Le Donjon du Savoir.html\"\n", "utf8");

// Linux : an installer that writes a .desktop with the right absolute paths.
writeFileSync(join(out, "Linux — Installer.sh"),
  "#!/usr/bin/env bash\n" +
  "set -e\n" +
  "DIR=\"$(cd \"$(dirname \"$0\")\" && pwd)\"\n" +
  "APPS=\"$HOME/.local/share/applications\"\n" +
  "mkdir -p \"$APPS\"\n" +
  "DESK=\"$APPS/donjon-du-savoir.desktop\"\n" +
  "cat > \"$DESK\" <<EOF\n" +
  "[Desktop Entry]\n" +
  "Type=Application\n" +
  "Name=Le Donjon du Savoir\n" +
  "Comment=Jeu de plateau de culture générale (hors-ligne)\n" +
  "Exec=xdg-open \"$DIR/Le Donjon du Savoir.html\"\n" +
  "Icon=$DIR/donjon-512.png\n" +
  "Terminal=false\n" +
  "Categories=Game;Education;\n" +
  "EOF\n" +
  "chmod +x \"$DESK\"\n" +
  "if [ -d \"$HOME/Bureau\" ]; then cp \"$DESK\" \"$HOME/Bureau/\" 2>/dev/null || true; fi\n" +
  "if [ -d \"$HOME/Desktop\" ]; then cp \"$DESK\" \"$HOME/Desktop/\" 2>/dev/null || true; fi\n" +
  "echo 'Icone installee. Cherchez « Le Donjon du Savoir » dans vos applications ou sur le Bureau.'\n", "utf8");

// ---- 7. Instructions ----
writeFileSync(join(out, "LISEZ-MOI.txt"),
`LE DONJON DU SAVOIR — icône de bureau
=====================================

Ce dossier contient le jeu complet en UN SEUL FICHIER (« Le Donjon du Savoir.html »,
fonctionne hors-ligne, sans installation) et de quoi créer une belle icône sur
votre bureau qui le lance directement.

Gardez tout le dossier ENSEMBLE (l'icône et le jeu doivent rester au même endroit).
Placez-le où vous voulez (par ex. dans « Documents »).

——— WINDOWS ———
  1. Double-cliquez sur « Windows — Créer le raccourci du bureau.cmd ».
     (Si Windows affiche un avertissement SmartScreen : « Informations complémentaires »
      puis « Exécuter quand même » — le script crée simplement un raccourci.)
  2. Une icône « Le Donjon du Savoir » apparaît sur le Bureau. Double-cliquez : le jeu
     s'ouvre dans votre navigateur, sans internet.

——— macOS ———
  1. Double-cliquez sur « macOS — Lancer le jeu.command » (au 1er lancement :
     clic droit → Ouvrir → Ouvrir, pour autoriser).
  2. Pour une jolie icône : sélectionnez « donjon.icns », Cmd+C. Puis clic droit sur
     « macOS — Lancer le jeu.command » → Lire les informations → cliquez sur la petite
     icône en haut à gauche de la fenêtre → Cmd+V. Glissez ensuite le fichier sur le
     Bureau ou dans le Dock.

——— LINUX ———
  1. Rendez le script exécutable puis lancez-le :
        chmod +x "Linux — Installer.sh" && "./Linux — Installer.sh"
  2. « Le Donjon du Savoir » apparaît dans votre menu d'applications (et sur le Bureau).

Astuce : vous pouvez aussi tout simplement double-cliquer sur
« Le Donjon du Savoir.html » — le jeu s'ouvre dans le navigateur.
`, "utf8");

console.log("✓ dist/launcher-kit/ créé (" + Object.keys(pngs).length + " tailles d'icône, .ico + .icns + .png)");
