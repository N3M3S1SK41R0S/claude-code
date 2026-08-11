import { makeAnagram, hangmanState, hangmanHas, hangmanLetters, closestRanking } from "../js/minigames.js";
let fail = 0;
const ok = (name, cond) => { console.log((cond?"✓":"✗")+" "+name); if(!cond) fail++; };

// Anagram: same multiset of letters, different order, spaces preserved.
const seq = (() => { let i=0; const xs=[0.1,0.9,0.3,0.7,0.2,0.8,0.4,0.6,0.15,0.85]; return ()=>xs[(i++)%xs.length]; })();
const a = makeAnagram("Victor Hugo", seq);
ok("anagram preserves space", a.scrambled.includes(" "));
ok("anagram differs from source", a.scrambled !== "VICTOR HUGO");
const norm = s => [...s.replace(/\s/g,"").toLowerCase()].sort().join("");
ok("anagram same letters", norm(a.scrambled) === norm("victorhugo"));

// Hangman: accent-insensitive reveal, structure preserved.
ok("hangman letter count", hangmanLetters("Canberra") === 8);
let st = hangmanState("Éléphant", ["e"]);
ok("hangman reveals accented e with plain e", st.display === "É_É____t".replace("t","_") || /É/.test(st.display));
st = hangmanState("Oural", ["o","u","r","a","l"]);
ok("hangman full reveal", st.revealed && st.display === "Oural");
ok("hangman has (accent-insensitive)", hangmanHas("Éléphant","e") === true);
ok("hangman missing letter", hangmanHas("Oural","z") === false);

// Closest ranking.
const r = closestRanking(193, [{id:1,valeur:180},{id:2,valeur:200},{id:3,valeur:193}]);
ok("closest exact first", r[0].id === 3 && r[0].ecart === 0);
ok("closest order", r[1].id === 2 && r[2].id === 1);

console.log(fail===0 ? "\nMINIGAMES OK" : `\nMINIGAMES FAILED (${fail})`);
process.exit(fail===0?0:1);
