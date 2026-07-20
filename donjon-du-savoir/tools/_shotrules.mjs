import { chromium } from "playwright-core";
import { existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "dist", "donjon-standalone.html");
function findC(){const s="/opt/pw-browsers/chromium/chrome-linux/chrome";return existsSync(s)&&statSync(s).isFile()?s:"/opt/pw-browsers/chromium";}
const br = await chromium.launch({executablePath:findC(),args:["--no-proxy-server"]});
const pg = await br.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
await pg.goto(pathToFileURL(file).href,{waitUntil:"load"});
await pg.locator("#bank-info").textContent({timeout:8000});
await pg.getByRole("button",{name:"⚔️ Nouvelle partie"}).click();
// Setup: select Étoiles to show the rounds picker
await pg.locator(".board-card",{hasText:"Étoiles"}).click();
await pg.waitForTimeout(300);
await pg.locator(".rounds-picker").scrollIntoViewIfNeeded();
await pg.locator(".rounds-picker").screenshot({path:"/tmp/claude-0/-home-user-claude-code/54eb68d8-ebec-5279-aab2-7d969c3a238b/scratchpad/v3-rounds.png"});
// Start a game and roll until a rule banner shows
await pg.getByRole("button",{name:"🏰 Entrer dans le Donjon"}).click();
await pg.getByRole("button",{name:"🎲 Au hasard !"}).click();
let seen=false;
for(let i=0;i<80 && !seen;i++){
  if((await pg.locator(".regle-banner").count())>0){seen=true;break;}
  const roll=pg.getByRole("button",{name:"🎲 Lancer le dé"});
  if(await roll.isVisible().catch(()=>false)){await roll.click();await pg.getByRole("button",{name:/Avancer de \d/}).click({timeout:8000}).catch(()=>{});continue;}
  const next=pg.getByRole("button",{name:/Continuer|Révéler|Valider|Subir|Quitter|Garder|Trouvé|abandonne/}).first();
  if(await next.isVisible().catch(()=>false)){await next.click().catch(()=>{});continue;}
  await pg.waitForTimeout(80);
}
console.log("rule banner seen:", seen);
if(seen) await pg.screenshot({path:"/tmp/claude-0/-home-user-claude-code/54eb68d8-ebec-5279-aab2-7d969c3a238b/scratchpad/v3-regle.png"});
await br.close();
