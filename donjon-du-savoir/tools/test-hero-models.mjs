// Contrat statique des figurines : GLB Draco, quatre animations, chemins
// littéraux pour l'inlining et précache hors-ligne exhaustif.
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path));
const text = (path) => read(path).toString("utf8");
const manifest = JSON.parse(text("data/modeles-3d.json"));
const modelsModule = text("js/models3d.js");
const worker = text("sw.js");
const builder = text("tools/build-standalone.mjs");
const board = text("js/board3d.js");

function glbJson(buffer, filename) {
  assert.equal(buffer.toString("ascii", 0, 4), "glTF", `signature GLB invalide : ${filename}`);
  assert.equal(buffer.readUInt32LE(4), 2, `version GLB invalide : ${filename}`);
  assert.equal(buffer.readUInt32LE(8), buffer.length, `taille GLB incohérente : ${filename}`);
  const jsonLength = buffer.readUInt32LE(12);
  assert.equal(buffer.toString("ascii", 16, 20), "JSON", `chunk JSON absent : ${filename}`);
  return JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength).trim());
}

assert.equal(manifest.version, 1);
assert.equal(manifest.modeles.length, 11);
assert.equal(new Set(manifest.modeles.map((model) => model.id)).size, 11);
const expectedAnimations = ["disappointment", "idle", "joy", "walk"];
let totalBytes = 0;

for (const model of manifest.modeles) {
  assert.match(model.fichier, /^assets\/3d\/heroes\/hero-[a-z]+\.glb$/);
  assert(!model.fichier.includes("http"), `chemin réseau interdit : ${model.fichier}`);
  assert(modelsModule.includes(`"${model.fichier}"`), `chemin non littéral : ${model.fichier}`);
  assert(worker.includes(`"./${model.fichier}"`), `fichier absent du SHELL : ${model.fichier}`);
  assert.deepEqual([...model.animations].sort(), expectedAnimations);
  assert(model.triangles >= 1_200 && model.triangles <= 2_100, `budget triangles : ${model.id}`);

  const absolute = join(root, model.fichier);
  const bytes = statSync(absolute).size;
  totalBytes += bytes;
  assert.equal(bytes, model.octets, `taille du manifeste : ${model.id}`);
  assert(bytes < 60 * 1024, `modèle trop lourd : ${model.id}`);

  const json = glbJson(read(model.fichier), model.fichier);
  assert(json.extensionsUsed?.includes("KHR_draco_mesh_compression"), `Draco absent : ${model.id}`);
  assert.deepEqual((json.animations ?? []).map((animation) => animation.name).sort(), expectedAnimations);
}

assert(totalBytes < 500 * 1024, `budget héros dépassé : ${Math.round(totalBytes / 1024)} Ko`);
assert(builder.includes('glb: "model/gltf-binary"'));
assert(builder.includes('"models3d", "board3d"'));
assert(builder.includes("__DONJON_DRACO"));
assert(worker.includes('const VERSION = "donjon-v68"'));
assert(worker.includes('"./vendor/draco/LICENSE.txt"'));
assert(board.includes('prefs.animations === "reduites"'));
assert(board.includes("prefers-reduced-motion: reduce"));
assert(board.includes('playHeroAnimation(rec.hero, "walk")'));
assert(board.includes('success ? "joy" : "disappointment"'));

console.log(`✓ héros 3D : 11 GLB Draco, 4 animations chacun, ${Math.round(totalBytes / 1024)} Ko`);
