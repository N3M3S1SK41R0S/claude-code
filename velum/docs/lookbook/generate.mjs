/**
 * Générateur du LOOKBOOK produit VELUM — une page HTML autonome (self-contained)
 * qui embarque le sceau, la vidéo de lancement (ré-encodée pour le web) et les
 * captures d'écran réelles, dans l'écrin velours & or.
 *
 * Sortie : docs/lookbook/velum-lookbook.html (gitignorée — c'est un livrable, pas
 * une source). Publie-la ensuite comme artifact / page web.
 *
 * Prérequis : ffmpeg dans le PATH (ré-encodage vidéo + redimensionnement images).
 * Les captures viennent de docs/screenshots (régénère-les avec e2e/*.mjs).
 *
 * Usage : node docs/lookbook/generate.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = resolve(HERE, '../screenshots');
const BRAND = resolve(HERE, '../../apps/mobile/assets/brand');
const OUT = join(HERE, 'velum-lookbook.html');
const tmp = mkdtempSync(join(os.tmpdir(), 'velum-lb-'));

/** Capture d'écran → JPEG 640px de large, en data-URI. */
function img(file) {
  const out = join(tmp, `${file}.jpg`);
  execFileSync('ffmpeg', ['-y', '-i', join(SHOTS, file), '-vf', 'scale=640:-1', '-q:v', '3', out], { stdio: 'ignore' });
  return `data:image/jpeg;base64,${readFileSync(out).toString('base64')}`;
}

/** PNG (sceau) redimensionné → data-URI. */
function png(absPath, width) {
  const out = join(tmp, 'seal.png');
  execFileSync('ffmpeg', ['-y', '-i', absPath, '-vf', `scale=${width}:-1`, out], { stdio: 'ignore' });
  return `data:image/png;base64,${readFileSync(out).toString('base64')}`;
}

/** Vidéo d'intro ré-encodée légère (H.264, 960p, faststart) → data-URI. */
function video(absPath) {
  const out = join(tmp, 'intro-web.mp4');
  execFileSync(
    'ffmpeg',
    // prettier-ignore
    ['-y', '-i', absPath, '-vf', 'scale=960:-2', '-c:v', 'libx264', '-crf', '30', '-preset', 'slow',
     '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out],
    { stdio: 'ignore' },
  );
  return `data:video/mp4;base64,${readFileSync(out).toString('base64')}`;
}

/** Image d'affiche (splash) → JPEG 960px → data-URI. */
function jpgPoster(absPath) {
  const out = join(tmp, 'poster.jpg');
  execFileSync('ffmpeg', ['-y', '-i', absPath, '-vf', 'scale=960:-1', '-q:v', '3', out], { stdio: 'ignore' });
  return `data:image/jpeg;base64,${readFileSync(out).toString('base64')}`;
}

const SEAL = png(join(BRAND, 'velum-seal.png'), 224);
const VIDEO = video(join(BRAND, 'velum-intro.mp4'));
const POSTER = jpgPoster(join(BRAND, 'splash-still.png'));

const CHAPTERS = [
  {
    num: 'I',
    title: "L'écrin",
    lead: "Un seul écrin numérique pour quatre univers de collection. La valeur, l'inventaire et la mise en scène, réunis dès l'ouverture.",
    screens: [
      { f: '18-accueil.png', n: "L'accueil", d: 'Le sceau, la vidéo de lancement et les accès rapides — le sceau ramène ici depuis chaque écran.' },
      { f: '02-onboarding-modules.png', n: 'Les quatre univers', d: 'Vin, pièces, art et timbres — illustrés à la main, un seul écrin.' },
      { f: '06-collection.png', n: 'Ma collection', d: 'Cave, cabinet, galerie et album réunis ; la valeur du portefeuille en tête.' },
      { f: '07-carnet.png', n: 'Le carnet', d: "Chaque module mis en scène comme le carnet d'un collectionneur." },
    ],
  },
  {
    num: 'II',
    title: 'Fiches & expertise',
    lead: "Chaque objet raconte son histoire : identification, valorisation à intervalle de confiance, rareté, tirage et dernières ventes sourcées.",
    screens: [
      { f: '08-fiche-vin.png', n: 'Fiche vin', d: 'Estimation à intervalle de confiance, histoire & rareté, et dernières ventes sourcées.' },
      { f: '19-fiche-piece.png', n: 'Fiche pièce', d: 'Grade, frappe et tirage ; comparables numismatiques (CGB, Numista, Heritage).' },
      { f: '20-fiche-timbre.png', n: 'Fiche timbre', d: 'Dentelure, gomme, cote Yvert ; ventes Delcampe et eBay attribuées.' },
      { f: '21-fiche-tableau.png', n: 'Fiche tableau', d: 'Attribution prudente, provenance ; comparables Drouot & Artprice.' },
      { f: '09-sommelier.png', n: 'Sommelier de cave', d: 'Quel vin de ma cave servir sur ce plat, ce soir ?' },
      { f: '16-sommelier-evenement.png', n: "Sommelier d'événement", d: "Les accords d'un menu complet, plat par plat." },
      { f: '15-degustation-aveugle.png', n: "Dégustation à l'aveugle", d: 'Cartes anonymes, réponses masquées, feuille imprimable.' },
    ],
  },
  {
    num: 'III',
    title: 'La communauté & le marché',
    lead: "Acheter et vendre entre collectionneurs de confiance, sans jamais exposer son paiement : le séquestre protège les deux côtés jusqu'à réception.",
    screens: [
      { f: '17-communaute.png', n: 'Communauté à séquestre', d: 'Le paiement reste bloqué jusqu’à réception ; la commission n’est prélevée qu’à la vente conclue.' },
      { f: '10-marche.png', n: 'Marché & alertes', d: "Apogée atteinte, seuils de prix, accès à la communauté Platine." },
      { f: '03-formules.png', n: 'Formules', d: 'Gratuit, Premium, Gold et Platine — la communauté marchande est réservée au Platine.' },
    ],
  },
  {
    num: 'IV',
    title: 'Confiance & accessibilité',
    lead: "Un objet précieux mérite un soin précieux : lisibilité pour tous, données maîtrisées, conformité assumée.",
    screens: [
      { f: '12-mode-senior.png', n: 'Mode senior', d: 'Typographie agrandie et contrastes renforcés (WCAG 2.2 AA).' },
      { f: '11-profil.png', n: 'Profil & confidentialité', d: 'Consentement IA, langue, export et suppression du compte (RGPD).' },
      { f: '05-confidentialite.png', n: 'Confidentialité', d: 'Responsable de traitement, finalités et droits exposés en clair, dans l’app.' },
      { f: '14-mode-demo.png', n: 'Mode démo', d: 'Essayer l’application entière, sans compte ni backend — données fictives.' },
      { f: '13-offline.png', n: 'Hors-ligne', d: 'La collection reste consultable, même sans réseau.' },
    ],
  },
];

const plate = (s) => `
        <figure class="plate">
          <div class="frame"><img loading="lazy" src="${img(s.f)}" alt="VELUM — ${s.n}" /></div>
          <figcaption class="cap"><h3>${s.n}</h3><p>${s.d}</p></figcaption>
        </figure>`;

const chapter = (c) => `
      <section class="chapter">
        <header class="head">
          <p class="eyebrow"><span class="rn">${c.num}</span>Chapitre</p>
          <h2>${c.title}</h2>
          <p class="lead">${c.lead}</p>
        </header>
        <div class="plates">${c.screens.map(plate).join('')}</div>
      </section>`;

const html = `<title>VELUM — Lookbook produit</title>
<style>
  :root {
    --bg: #ece3d0; --bg2: #e4d9c2; --panel: #f5eddc;
    --ink: #2a1614; --ink-dim: #6f5945;
    --gold: #9a7517; --gold-bright: #b8902a;
    --wine: #7d2331; --seal: #4f8a63;
    --hairline: rgba(122,35,49,.24); --gilt-line: rgba(154,117,23,.34);
    --frame: #120809; --glow: rgba(154,117,23,.16);
    --shadow: 0 24px 60px -28px rgba(60,20,10,.5);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #170b0d; --bg2: #1f1013; --panel: #22141800;
      --ink: #f3e8d6; --ink-dim: #b39685;
      --gold: #d9b450; --gold-bright: #efce74;
      --wine: #8a2a38; --seal: #77b98d;
      --hairline: rgba(217,180,80,.20); --gilt-line: rgba(217,180,80,.40);
      --frame: #0b0607; --glow: rgba(217,180,80,.18);
      --shadow: 0 26px 64px -26px rgba(0,0,0,.72);
    }
  }
  :root[data-theme="light"] {
    --bg: #ece3d0; --bg2: #e4d9c2; --panel: #f5eddc;
    --ink: #2a1614; --ink-dim: #6f5945;
    --gold: #9a7517; --gold-bright: #b8902a;
    --wine: #7d2331; --seal: #4f8a63;
    --hairline: rgba(122,35,49,.24); --gilt-line: rgba(154,117,23,.34);
    --frame: #120809; --glow: rgba(154,117,23,.16);
    --shadow: 0 24px 60px -28px rgba(60,20,10,.5);
  }
  :root[data-theme="dark"] {
    --bg: #170b0d; --bg2: #1f1013; --panel: #22141800;
    --ink: #f3e8d6; --ink-dim: #b39685;
    --gold: #d9b450; --gold-bright: #efce74;
    --wine: #8a2a38; --seal: #77b98d;
    --hairline: rgba(217,180,80,.20); --gilt-line: rgba(217,180,80,.40);
    --frame: #0b0607; --glow: rgba(217,180,80,.18);
    --shadow: 0 26px 64px -26px rgba(0,0,0,.72);
  }

  * { box-sizing: border-box; }
  body {
    margin: 0; color: var(--ink);
    background:
      radial-gradient(1100px 620px at 50% -8%, var(--glow), transparent 62%),
      radial-gradient(760px 520px at 88% 4%, var(--glow), transparent 60%),
      var(--bg);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
    line-height: 1.55;
  }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 0 clamp(20px, 5vw, 44px); }

  /* Hero */
  .hero { text-align: center; padding: clamp(60px, 13vw, 128px) 0 clamp(26px, 5vw, 52px); }
  .seal {
    display: block; width: clamp(86px, 14vw, 118px); height: auto;
    margin: 0 auto clamp(16px, 2.6vw, 26px);
    filter: drop-shadow(0 8px 26px var(--glow));
  }
  .kicker {
    font-size: .74rem; letter-spacing: .32em; text-transform: uppercase;
    color: var(--gold); margin: 0 0 clamp(18px, 3vw, 30px);
  }
  .wordmark {
    font-family: Georgia, "Iowan Old Style", "Palatino Linotype", serif;
    font-weight: 600; letter-spacing: .14em; margin: 0;
    font-size: clamp(3.1rem, 13vw, 7rem); line-height: .96;
    background: linear-gradient(176deg, var(--gold-bright), var(--gold) 62%, var(--wine));
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .flourish {
    display: flex; align-items: center; justify-content: center; gap: 14px;
    margin: clamp(20px, 3.4vw, 34px) auto clamp(20px, 3vw, 30px); max-width: 260px;
  }
  .flourish::before, .flourish::after {
    content: ""; height: 1px; flex: 1;
    background: linear-gradient(90deg, transparent, var(--gilt-line));
  }
  .flourish::after { transform: scaleX(-1); }
  .flourish span { color: var(--gold); font-size: .8rem; }
  .cinema { max-width: 720px; margin: clamp(26px, 4vw, 44px) auto clamp(22px, 3.4vw, 34px); }
  .intro {
    display: block; width: 100%; aspect-ratio: 16 / 9; background: #000;
    border-radius: 20px; border: 1px solid var(--gilt-line);
    box-shadow: var(--shadow), 0 0 66px -12px var(--glow);
  }
  .cine-cap {
    margin: 13px 0 0; text-align: center; font-size: .74rem;
    letter-spacing: .2em; text-transform: uppercase; color: var(--gold);
  }
  .tagline {
    font-size: clamp(1.05rem, 2.7vw, 1.42rem); color: var(--ink);
    max-width: 30ch; margin: 0 auto; text-wrap: balance;
  }
  .tagline em { font-style: italic; color: var(--gold-bright); }
  .chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin: clamp(24px, 4vw, 38px) auto 0; }
  .chip {
    font-size: .76rem; letter-spacing: .06em; color: var(--ink-dim);
    border: 1px solid var(--hairline); border-radius: 999px;
    padding: 6px 14px; background: var(--panel);
  }

  /* Chapters */
  .chapter { margin-top: clamp(52px, 8vw, 100px); }
  .head { max-width: 62ch; margin: 0 0 clamp(22px, 3.4vw, 40px); }
  .eyebrow {
    display: flex; align-items: center; gap: 12px; margin: 0 0 12px;
    font-size: .74rem; letter-spacing: .26em; text-transform: uppercase; color: var(--gold);
  }
  .rn {
    font-family: Georgia, serif; font-size: .96rem; letter-spacing: .04em;
    color: var(--gold-bright); border: 1px solid var(--gilt-line);
    border-radius: 50%; width: 30px; height: 30px; display: grid; place-items: center;
  }
  .chapter h2 { font-family: Georgia, "Iowan Old Style", serif; font-weight: 600;
    font-size: clamp(1.7rem, 4.4vw, 2.5rem); margin: 0; text-wrap: balance; letter-spacing: .005em; }
  .lead { color: var(--ink-dim); font-size: clamp(1rem, 1.4vw, 1.08rem); margin: 10px 0 0; text-wrap: pretty; }

  .plates { columns: 1; column-gap: clamp(20px, 3vw, 34px); }
  @media (min-width: 720px) { .plates { columns: 2; } }
  @media (min-width: 1080px) { .plates { columns: 3; } }

  .plate { break-inside: avoid; margin: 0 0 clamp(22px, 3.4vw, 38px); }
  .frame {
    position: relative; background: var(--frame); border: 1px solid var(--hairline);
    border-radius: 30px; padding: 8px; box-shadow: var(--shadow);
    transition: transform .5s cubic-bezier(.2,.7,.2,1), box-shadow .5s;
  }
  .frame::after {
    content: ""; position: absolute; inset: 0; border-radius: 30px; pointer-events: none;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.05), inset 0 0 0 1px rgba(217,180,80,.06);
  }
  .frame img { display: block; width: 100%; border-radius: 22px; }
  .plate:hover .frame {
    transform: translateY(-6px);
    box-shadow: var(--shadow), 0 0 44px -6px var(--glow);
  }
  .cap { padding: 15px 6px 0; }
  .cap h3 { font-family: Georgia, "Iowan Old Style", serif; font-weight: 600;
    font-size: 1.16rem; margin: 0 0 3px; color: var(--ink); }
  .cap p { margin: 0; font-size: .92rem; color: var(--ink-dim); text-wrap: pretty; }

  /* Colophon */
  .colophon {
    margin-top: clamp(64px, 10vw, 120px); padding: 30px 0 66px;
    border-top: 1px solid var(--hairline); text-align: center; color: var(--ink-dim);
  }
  .colophon .mk { font-family: Georgia, serif; letter-spacing: .22em; color: var(--gold);
    font-size: 1rem; margin: 0 0 8px; }
  .colophon p { margin: 4px auto; font-size: .84rem; max-width: 54ch; }

  /* Reveal */
  .reveal { opacity: 0; transform: translateY(18px); transition: opacity .8s ease, transform .8s cubic-bezier(.2,.7,.2,1); }
  .reveal.in { opacity: 1; transform: none; }
  @media (prefers-reduced-motion: reduce) {
    .reveal { opacity: 1; transform: none; transition: none; }
    .frame, .plate:hover .frame { transition: none; }
  }
</style>

<main>
  <header class="hero wrap">
    <img class="seal reveal" src="${SEAL}" alt="Sceau VELUM" />
    <p class="kicker reveal">Lookbook produit</p>
    <figure class="cinema reveal">
      <video class="intro" autoplay muted loop playsinline controls preload="auto" poster="${POSTER}">
        <source src="${VIDEO}" type="video/mp4" />
      </video>
      <figcaption class="cine-cap">Vidéo de lancement · activez le son</figcaption>
    </figure>
    <h1 class="wordmark reveal">VELUM</h1>
    <div class="flourish reveal"><span>&#9670;</span></div>
    <p class="tagline reveal">L'écrin numérique du collectionneur — <em>analyser, valoriser, transmettre</em> le vin, les pièces, l'art et les timbres.</p>
    <div class="chips reveal">
      <span class="chip">iOS · Android · PWA</span>
      <span class="chip">4 modules</span>
      <span class="chip">Communauté à séquestre</span>
      <span class="chip">FR / EN</span>
      <span class="chip">WCAG 2.2 AA</span>
    </div>
  </header>

  <div class="wrap">
    ${CHAPTERS.map(chapter).join('')}
  </div>

  <footer class="colophon">
    <p class="mk">VELUM</p>
    <p>Rendus réels du build de démonstration — mode hors-ligne, sans backend.</p>
    <p>Écrin velours &amp; or · profondeur sertie · captures iPhone 6,9&Prime;.</p>
  </footer>
</main>

<script>
  (function () {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var nodes = Array.prototype.slice.call(document.querySelectorAll('.plate, .head, .kicker, .seal, .cinema, .wordmark, .flourish, .tagline, .chips'));
    nodes.forEach(function (n) { n.classList.add('reveal'); });
    if (reduce || !('IntersectionObserver' in window)) {
      nodes.forEach(function (n) { n.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    nodes.forEach(function (n) { io.observe(n); });
  })();
</script>`;

writeFileSync(OUT, html);
console.log(`wrote ${OUT} (${Math.round(Buffer.byteLength(html) / 1024)} KB)`);
