// FORGE DES ILLUSTRATIONS DE MONUMENTS — recadre, redimensionne et encode en
// WebP les planches livrées par le studio. La machine n'a ni ImageMagick ni
// Pillow : c'est Chromium qui fait le travail, via un canvas — il sait encoder
// le WebP nativement, et le résultat est identique à cwebp à qualité égale.
//
// Trois opérations, dans cet ordre :
//  1. MISE EN CARRÉ par ajout de marge, jamais par découpe (les planches
//     arrivent en 1303x1207, 1145x1374…). On ne rogne pas : couper 200 px sur
//     une image verticale ferait sauter la flèche d'une cathédrale. Comme les
//     illustrations ont déjà un fond de papier crème, la marge ajoutée est
//     invisible — elle prolonge la page du carnet.
//  2. Redimensionnement à la taille d'affichage réelle : inutile d'embarquer
//     du 1254 px pour une vignette de 240 px. Le réglage retenu est 280 px —
//     contrôlé à l'œil sur tools/planche-monuments.mjs, aucune perte visible à
//     la taille où le jeu les montre, et c'est ce qui laisse la place aux
//     illustrations encore à venir sous le plafond de publication.
//  3. Encodage WebP. Le poids compte double ici : le jeu embarque TOUT en
//     base64, et la version web publiable plafonne à 16 Mo.
//
// Lancer : node tools/forge-monuments.mjs <dossier-source> [--largeur 280] [--qualite 0.75]
import { chromium } from "playwright-core";
import { existsSync, statSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = process.argv[2];
if (!source) { console.error("usage : node tools/forge-monuments.mjs <dossier-source> [--largeur N] [--qualite Q]"); process.exit(2); }
const arg = (nom, defaut) => {
  const i = process.argv.indexOf(nom);
  return i > -1 ? Number(process.argv[i + 1]) : defaut;
};
const LARGEUR = arg("--largeur", 280);
const QUALITE = arg("--qualite", 0.75);

// Le nom de fichier livré par le studio ne dit rien du monument (« a_detailed_
// watercolor_ink_illustration_scene_of.png ») : la correspondance est établie
// À L'ŒIL sur la planche de contrôle, puis figée ici. C'est le seul endroit où
// elle vit — le reste de la chaîne ne connaît que les clés du jeu.
const CORRESPONDANCE = JSON.parse(readFileSync(join(root, "data", "monuments-source.json"), "utf8"));

function findChromium() {
  for (const c of [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(Boolean)) {
    if (!existsSync(c)) continue;
    if (statSync(c).isFile()) return c;
    for (const sub of ["chrome-linux/chrome", "chrome"]) { const p = join(c, sub); if (existsSync(p) && statSync(p).isFile()) return p; }
  }
  throw new Error("Chromium not found");
}

const dossier = join(root, "assets", "monuments");
mkdirSync(dossier, { recursive: true });
const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-proxy-server"] });
const page = await browser.newPage();
await page.setContent("<body></body>");

let total = 0;
const bilan = [];
for (const [fichier, cle] of Object.entries(CORRESPONDANCE)) {
  const chemin = join(source, fichier);
  if (!existsSync(chemin)) { console.log(`✗ absent : ${fichier}`); continue; }
  const b64 = readFileSync(chemin).toString("base64");
  const webp = await page.evaluate(async ({ b64, largeur, qualite }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = c.height = largeur;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    // Fond crème plutôt que transparent : les planches arrivent avec leur
    // papier peint, et une vignette « page de carnet » est plus jolie sur le
    // parchemin du jeu qu'un détourage approximatif.
    ctx.fillStyle = "#f7f3ea";
    ctx.fillRect(0, 0, largeur, largeur);
    // L'image ENTIÈRE tient dans le carré, centrée : rien n'est rogné.
    const k = Math.min(largeur / img.naturalWidth, largeur / img.naturalHeight);
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    ctx.drawImage(img, (largeur - w) / 2, (largeur - h) / 2, w, h);
    return c.toDataURL("image/webp", qualite);
  }, { b64, largeur: LARGEUR, qualite: QUALITE });

  const donnees = Buffer.from(webp.split(",")[1], "base64");
  writeFileSync(join(dossier, `${cle}.webp`), donnees);
  total += donnees.length;
  bilan.push([cle, donnees.length]);
}
await browser.close();

bilan.sort((a, b) => b[1] - a[1]);
for (const [cle, poids] of bilan) console.log(`  ${cle.padEnd(20)} ${(poids / 1024).toFixed(1).padStart(6)} Ko`);
console.log(`✓ ${bilan.length} illustrations → assets/monuments/ (${(total / 1024).toFixed(0)} Ko au total, ${LARGEUR} px, qualité ${QUALITE})`);
