// Contrat statique du lot décors : 10 bâtiments, 12 socles, modules, Draco,
// précache complet et repli conservé dans board3d.
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path));
const text = (path) => read(path).toString("utf8");
const manifest = JSON.parse(text("data/decors-3d.json"));
const models = text("js/models3d.js");
const board = text("js/board3d.js");
const worker = text("sw.js");

function glbJson(buffer, filename) {
  assert.equal(buffer.toString("ascii", 0, 4), "glTF", `signature GLB : ${filename}`);
  assert.equal(buffer.readUInt32LE(4), 2, `version GLB : ${filename}`);
  const length = buffer.readUInt32LE(12);
  assert.equal(buffer.toString("ascii", 16, 20), "JSON", `chunk JSON : ${filename}`);
  return JSON.parse(buffer.toString("utf8", 20, 20 + length).trim());
}

assert.equal(manifest.version, 1);
assert.equal(manifest.collections.buildings.length, 10);
assert.equal(manifest.collections.tiles.length, 12);
assert.equal(manifest.collections.dungeon.length, 4);
let total = 0;

for (const [collection, entries] of Object.entries(manifest.collections)) {
  assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length, `IDs ${collection}`);
  for (const entry of entries) {
    assert.match(entry.fichier, /^assets\/3d\/(buildings|tiles|dungeon)\/[a-z-]+\.glb$/);
    assert(models.includes(`"${entry.fichier}"`), `chemin littéral absent : ${entry.fichier}`);
    assert(worker.includes(`"./${entry.fichier}"`), `SHELL absent : ${entry.fichier}`);
    const bytes = statSync(join(root, entry.fichier)).size;
    assert.equal(bytes, entry.octets, `taille manifeste : ${entry.id}`);
    assert(bytes < 30 * 1024, `asset trop lourd : ${entry.id}`);
    assert(entry.triangles > 100 && entry.triangles < 1_500, `géométrie : ${entry.id}`);
    const json = glbJson(read(entry.fichier), entry.fichier);
    assert(json.extensionsUsed?.includes("KHR_draco_mesh_compression"), `Draco absent : ${entry.id}`);
    total += bytes;
  }
}

assert(total < 500 * 1024, `budget décors dépassé : ${Math.round(total / 1024)} Ko`);
assert(worker.includes('const VERSION = "donjon-v69"'));
assert(board.includes("THREE.PCFSoftShadowMap"));
assert(board.includes("key.castShadow = true"));
assert(board.includes("addBuilding("));
assert(board.includes("createTileModel(type)"));
assert(board.includes("standee(art"));

console.log(`✓ décors 3D : 10 bâtiments, 12 socles, 4 modules, ${Math.round(total / 1024)} Ko`);
