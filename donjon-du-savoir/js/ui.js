// Small DOM helpers: element factory, modal panel, herald banner.
import { herald } from "./herald.js";
import { say } from "./tts.js";

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null) continue;
    node.append(child);
  }
  return node;
}

const panel = () => document.getElementById("panel");

/** Replace the action panel content (the zone under the board). */
export function setPanel(...children) {
  const p = panel();
  p.innerHTML = "";
  p.append(...children.filter(Boolean));
  p.scrollTop = 0;
}

/** Avatar du Héraut : médaillon peint posé sur l'emoji 📯 (repli si absent). */
export function heraldAvatar() {
  const span = el("span", { class: "herald-avatar", "aria-hidden": "true", text: "📯" });
  const img = document.createElement("img");
  img.className = "herald-art";
  img.alt = "";
  img.decoding = "async";
  img.src = "assets/heraut-medaillon.png";
  img.onerror = () => img.remove();
  span.appendChild(img);
  return span;
}

export function heraldSays(text, { speak = true } = {}) {
  const zone = document.getElementById("herald-zone");
  if (zone) {
    zone.innerHTML = "";
    zone.append(
      el("div", { class: "herald-bubble", role: "status", "aria-live": "polite" },
        heraldAvatar(),
        el("p", { class: "herald-text", text }),
      ),
    );
  }
  if (speak) say(text);
}

export function bigButton(label, onclick, cls = "") {
  return el("button", { class: `btn btn-big ${cls}`, type: "button", onclick }, label);
}

export function choiceButton(label, onclick, cls = "") {
  return el("button", { class: `btn btn-choice ${cls}`, type: "button", onclick }, label);
}

export { herald };
