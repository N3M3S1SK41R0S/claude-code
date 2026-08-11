// Carte-souvenir de partie : une image générée en canvas à la victoire
// (podium, stats, anecdote à retenir), téléchargeable et partageable.
// 100 % hors-ligne : tout est dessiné localement, aucun service externe.
import { el } from "./ui.js";
import { getState } from "./state.js";
import { grimoireEntries } from "./grimoire.js";
import { portraitArtSrc } from "./portraits.js";

const W = 1080;
const H = 1350;

/** Charge une image, sans jamais rejeter (null si absente ou illisible). */
function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Découpe un texte en lignes tenant dans maxWidth ; tronque avec « … ». */
function wrapText(ctx, text, maxWidth, maxLines) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) {
        // Dernière ligne : on remplit puis on tronque proprement.
        let last = line;
        for (const w2 of words.slice(words.indexOf(word) + 1)) {
          if (ctx.measureText(`${last} ${w2}`).width > maxWidth - 30) break;
          last = `${last} ${w2}`;
        }
        lines.push(last === text ? last : `${last}…`);
        return lines;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** L'anecdote « à retenir » : une entrée du grimoire découverte CETTE partie. */
function anecdoteOfGame() {
  const asked = new Set(getState()?.askedIds ?? []);
  const found = grimoireEntries().filter((e) => asked.has(e.id));
  if (found.length === 0) return null;
  // La plus savoureuse = la plus longue à raconter (au goûter comme au dîner).
  return found.sort((a, b) => (b.anecdote?.length ?? 0) - (a.anecdote?.length ?? 0))[0];
}

/** Dessine la carte complète dans le canvas (portraits chargés au préalable). */
async function drawCard(canvas, { winner, rankingData, etoilesMode }) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const serif = "Georgia, 'Times New Roman', serif";
  // Cadre parchemin peint (GEN 2, centre transparent) — repli : cadre doré dessiné.
  const cadre = await loadImage("assets/souvenir-cadre.webp");

  // Fond : dégradé de donjon + vignette dorée.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#241536");
  bg.addColorStop(0.55, "#170e26");
  bg.addColorStop(1, "#120b1d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 300, 80, W / 2, 300, 900);
  glow.addColorStop(0, "rgba(224,176,74,0.14)");
  glow.addColorStop(1, "rgba(224,176,74,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Cadre doré double (uniquement si le cadre peint n'est pas disponible).
  if (!cadre) {
    ctx.strokeStyle = "#e0b04a";
    ctx.lineWidth = 6;
    roundedRect(ctx, 24, 24, W - 48, H - 48, 28);
    ctx.stroke();
    ctx.strokeStyle = "rgba(224,176,74,0.35)";
    ctx.lineWidth = 2;
    roundedRect(ctx, 40, 40, W - 80, H - 80, 20);
    ctx.stroke();
  }

  // Titre.
  ctx.textAlign = "center";
  ctx.fillStyle = "#f2dfae";
  ctx.font = `bold 58px ${serif}`;
  ctx.fillText("🏰 Le Donjon du Savoir", W / 2, 128);
  ctx.fillStyle = "#b9a6d8";
  ctx.font = `italic 30px ${serif}`;
  const date = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  ctx.fillText(`Carte souvenir — ${date}`, W / 2, 176);

  // Vainqueur.
  ctx.fillStyle = "#e0b04a";
  ctx.font = `bold 44px ${serif}`;
  const titre = etoilesMode
    ? `👑 ${winner.nom} — ${winner.etoiles ?? 0} ⭐ !`
    : `👑 ${winner.nom} remporte le Trésor !`;
  ctx.fillText(titre, W / 2, 248);

  // Podium (jusqu'à 3) : 2e · 1er · 3e, portraits ronds sur des marches.
  const top = rankingData.slice(0, 3);
  const order = [1, 0, 2].filter((i) => top[i]);
  const podiumY = 470;
  const stepH = [86, 120, 64];
  const colW = 210;
  const startX = W / 2 - (order.length * colW) / 2;
  const portraits = await Promise.all(top.map((p) => loadImage(portraitArtSrc(p.characterId))));
  order.forEach((idx, col) => {
    const p = top[idx];
    const cx = startX + col * colW + colW / 2;
    const baseY = podiumY + 150;
    // Marche.
    ctx.fillStyle = idx === 0 ? "#3a2a55" : "#2c2040";
    roundedRect(ctx, cx - 88, baseY, 176, stepH[idx], 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(224,176,74,0.45)";
    ctx.lineWidth = 2;
    roundedRect(ctx, cx - 88, baseY, 176, stepH[idx], 10);
    ctx.stroke();
    ctx.fillStyle = "#e0b04a";
    ctx.font = `bold 42px ${serif}`;
    ctx.fillText(String(idx + 1), cx, baseY + stepH[idx] / 2 + 15);
    // Portrait rond (image peinte, repli pastille dorée + initiale).
    const r = idx === 0 ? 66 : 52;
    const py = baseY - r - 46;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, py, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = "#2c2040";
    ctx.fill();
    ctx.clip();
    const img = portraits[idx];
    if (img) ctx.drawImage(img, cx - r, py - r, r * 2, r * 2);
    else {
      ctx.fillStyle = "#e0b04a";
      ctx.font = `bold ${r}px ${serif}`;
      ctx.fillText((p.nom ?? "?").slice(0, 1).toUpperCase(), cx, py + r * 0.35);
    }
    ctx.restore();
    ctx.strokeStyle = "#e0b04a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, py, r, 0, Math.PI * 2);
    ctx.stroke();
    // Couronne / médailles au-dessus.
    ctx.font = "44px serif";
    ctx.fillStyle = "#f2dfae";
    ctx.fillText(idx === 0 ? "👑" : idx === 1 ? "🥈" : "🥉", cx, py - r - 12);
    // Nom sous la marche.
    ctx.fillStyle = "#f2eadb";
    ctx.font = `bold 30px ${serif}`;
    const nom = p.nom.length > 12 ? `${p.nom.slice(0, 11)}…` : p.nom;
    ctx.fillText(nom, cx, baseY - 8);
  });

  // Classement (jusqu'à 6 lignes).
  let y = podiumY + 320;
  ctx.textAlign = "left";
  ctx.font = `28px ${serif}`;
  const rows = rankingData.slice(0, 6);
  for (let i = 0; i < rows.length; i++) {
    const p = rows[i];
    ctx.fillStyle = i === 0 ? "#f2dfae" : "#d8cdea";
    const medal = i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🎓";
    const score = etoilesMode ? `⭐${p.etoiles ?? 0}` : `case ${p.position}`;
    ctx.fillText(`${medal} ${p.nom}${p.bot ? " 🤖" : ""} — ${score} · 🪙${p.pieces} · ${p.bonnes}/${p.questions} bonnes`, 110, y);
    y += 44;
  }
  if (rankingData.length > 6) {
    ctx.fillStyle = "#9d8cc0";
    ctx.fillText(`… et ${rankingData.length - 6} autres aventuriers !`, 110, y);
    y += 44;
  }

  // Anecdote à retenir (parchemin).
  const entry = anecdoteOfGame();
  if (entry) {
    const boxY = y + 18;
    const boxH = H - boxY - 120;
    if (boxH > 150) {
      ctx.fillStyle = "rgba(242,223,174,0.08)";
      roundedRect(ctx, 70, boxY, W - 140, boxH, 16);
      ctx.fill();
      ctx.strokeStyle = "rgba(224,176,74,0.4)";
      ctx.lineWidth = 2;
      roundedRect(ctx, 70, boxY, W - 140, boxH, 16);
      ctx.stroke();
      ctx.fillStyle = "#e0b04a";
      ctx.font = `bold 30px ${serif}`;
      ctx.fillText("📜 L'anecdote à retenir", 100, boxY + 48);
      ctx.font = `italic 25px ${serif}`;
      ctx.fillStyle = "#b9a6d8";
      let ty = boxY + 92;
      for (const line of wrapText(ctx, entry.texte, W - 200, 2)) {
        ctx.fillText(line, 100, ty);
        ty += 34;
      }
      ctx.font = `26px ${serif}`;
      ctx.fillStyle = "#f2eadb";
      ty += 8;
      const maxLines = Math.max(2, Math.floor((boxY + boxH - 24 - ty) / 36));
      for (const line of wrapText(ctx, entry.anecdote, W - 200, maxLines)) {
        ctx.fillText(line, 100, ty);
        ty += 36;
      }
    }
  }

  // Pied de carte.
  ctx.textAlign = "center";
  ctx.fillStyle = "#9d8cc0";
  ctx.font = `italic 24px ${serif}`;
  const nQuestions = rankingData.reduce((s, p) => s + (p.questions ?? 0), 0);
  ctx.fillText(`${nQuestions} questions posées · jouée en famille, sans chrono ✨`, W / 2, H - 66);

  // Le cadre peint par-dessus tout (son centre est transparent).
  if (cadre) ctx.drawImage(cadre, 0, 0, W, H);
}

/** Nom de fichier du souvenir (date locale, sans caractères exotiques). */
function fileName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `donjon-souvenir-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.png`;
}

/**
 * Bloc « carte souvenir » de l'écran de victoire : le canvas dessiné + les
 * boutons Télécharger (toujours) et Partager (si l'appareil sait partager des
 * fichiers). Le dessin est asynchrone (portraits) mais l'élément est immédiat.
 */
export function souvenirSection(winner, rankingData, etoilesMode) {
  const canvas = el("canvas", { class: "souvenir-canvas", width: String(W), height: String(H), "aria-label": "Carte souvenir de la partie" });
  drawCard(canvas, { winner, rankingData, etoilesMode }).catch(() => {});

  const toBlob = () => new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const download = el("button", { class: "btn", type: "button", onclick: async () => {
    const blob = await toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: fileName() });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } }, "💾 Télécharger l'image");

  const actions = el("div", { class: "souvenir-actions" }, download);
  // Partage natif (mobile surtout) : seulement si les fichiers sont acceptés.
  if (navigator.canShare && navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] })) {
    actions.append(el("button", { class: "btn", type: "button", onclick: async () => {
      const blob = await toBlob();
      if (!blob) return;
      const file = new File([blob], fileName(), { type: "image/png" });
      try { await navigator.share({ files: [file], title: "Le Donjon du Savoir" }); } catch { /* partage annulé */ }
    } }, "📤 Partager"));
  }

  return el("details", { class: "souvenir-details" },
    el("summary", { text: "📸 Carte souvenir de la partie" }),
    el("div", { class: "souvenir-box" }, canvas, actions),
  );
}
