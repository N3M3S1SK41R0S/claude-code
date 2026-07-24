// Contrat statique du lot final : cubemaps locales, 12 familles d'effets,
// garde-fou 30 fps et rebascule 2D sans toucher à la logique du jeu.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const text = (path) => readFileSync(join(root, path), "utf8");
const board = text("js/board3d.js");
const game = text("js/game.js");
const worker = text("sw.js");
const builder = text("tools/build-standalone.mjs");

for (const theme of ["donjon", "crypte", "tour", "labyrinthe", "catacombes"]) {
  assert(board.includes(`${theme}: [`), `palette de skybox absente : ${theme}`);
}
assert(board.includes("new THREE.CubeTexture(faces)"));
assert(board.includes("seededRandom("));
assert(!board.replace("http://www.w3.org/2000/svg", "").match(/https?:\/\//), "URL réseau interdite dans board3d");

for (const type of [
  "question", "chance", "evenement", "malus", "pieces", "joker",
  "gambit", "trounoir", "boutique", "insolite", "expression", "arrivee",
]) {
  assert(board.includes(`${type}: 0x`), `effet de case absent : ${type}`);
}
assert(board.includes("export function stageCase3D"));
assert(game.includes("stageCase3D(type, pion.id)"));
assert(game.includes('stageCase3D("boutique", pion.id)'));
assert(game.includes('stageCase3D("arrivee", pion.id)'));

assert(board.includes("watchPerformance(now)"));
assert(board.includes("R.setPixelRatio(1)"));
assert(board.includes("R.shadowMap.enabled = false"));
assert(board.includes('new CustomEvent("donjon-3d-fallback")'));
assert(game.includes('addEventListener?.("donjon-3d-fallback"'));
assert(board.includes("runtime3DDisabled"));
assert.match(worker, /const VERSION = "donjon-v\d+";/);
assert(builder.includes('glb: "model/gltf-binary"'));

console.log("✓ ambiances 3D : 5 cubemaps, 12 effets de case, qualité adaptative et repli 2D");
