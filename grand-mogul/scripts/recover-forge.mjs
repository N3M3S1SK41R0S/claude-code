// One-off salvage: the forge workflow's write-agents were killed by the
// monthly spend limit, so the verified questions never reached disk — but
// each write-agent's PROMPT embeds the exact <json> payload it was told to
// write. This reconstructs the per-theme files from those prompts.
// Usage: node scripts/recover-forge.mjs <workflow-transcript-dir> <out-dir>
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const [srcDir, outDir] = process.argv.slice(2);
if (!srcDir || !outDir) {
  console.error("Usage: node scripts/recover-forge.mjs <transcript-dir> <out-dir>");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

function textOf(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((b) => (typeof b === "string" ? b : b?.text ?? "")).join("");
  return "";
}

const byTheme = new Map();

for (const file of readdirSync(srcDir).filter((f) => f.startsWith("agent-") && f.endsWith(".jsonl"))) {
  let raw;
  try {
    raw = readFileSync(join(srcDir, file), "utf8");
  } catch {
    continue;
  }
  if (!raw.includes("Tu es un simple copiste")) continue;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const msg = obj.message ?? obj;
    const text = textOf(msg?.content);
    const end = text.indexOf("</json>");
    // The prompt mentions "<json>" in its instructions too; the real opening
    // tag is the LAST one before the closing tag.
    const start = text.lastIndexOf("<json>", end);
    if (start === -1 || end <= start) continue;
    const payload = text.slice(start + 6, end).trim();
    try {
      const data = JSON.parse(payload);
      if (data && typeof data.theme === "string" && Array.isArray(data.questions)) {
        // Keep the richest copy if several messages carry the same theme.
        const prev = byTheme.get(data.theme);
        if (!prev || data.questions.length > prev.questions.length) byTheme.set(data.theme, data);
      }
    } catch {
      /* truncated prompt: skip */
    }
  }
}

let total = 0;
for (const [theme, data] of byTheme) {
  writeFileSync(join(outDir, `${theme}.json`), JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`✓ ${theme}: ${data.questions.length} questions`);
  total += data.questions.length;
}
console.log(`Recovered ${total} questions across ${byTheme.size} themes → ${outDir}`);
