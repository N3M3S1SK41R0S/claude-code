import { NextResponse } from "next/server";

export const runtime = "edge";

/**
 * On-demand question generation through the Anthropic API with web search.
 * Without ANTHROPIC_API_KEY the route answers 503 and the client falls back
 * to the local verified bank — the game never depends on this endpoint.
 */

const THEME_IDS = [
  "histoire",
  "geographie",
  "litterature",
  "sciences",
  "arts",
  "cinema",
  "musique",
  "gastronomie",
  "sport",
  "langue",
] as const;

type ThemeId = (typeof THEME_IDS)[number];

interface GeneratedQuestion {
  id: string;
  theme: ThemeId;
  difficulty: number;
  question: string;
  choices: string[];
  answerIndex: number;
  anecdote: string;
  sources: string[];
}

function isValid(q: unknown): q is Omit<GeneratedQuestion, "id"> {
  if (typeof q !== "object" || q === null) return false;
  const c = q as Record<string, unknown>;
  return (
    typeof c.question === "string" &&
    c.question.length > 10 &&
    Array.isArray(c.choices) &&
    c.choices.length === 4 &&
    c.choices.every((x) => typeof x === "string" && x.length > 0) &&
    typeof c.answerIndex === "number" &&
    Number.isInteger(c.answerIndex) &&
    c.answerIndex >= 0 &&
    c.answerIndex <= 3 &&
    typeof c.difficulty === "number" &&
    c.difficulty >= 1 &&
    c.difficulty <= 5 &&
    typeof c.anecdote === "string" &&
    c.anecdote.length > 10 &&
    Array.isArray(c.sources) &&
    c.sources.length >= 2 &&
    c.sources.every((u) => typeof u === "string" && u.startsWith("https://")) &&
    THEME_IDS.includes(c.theme as ThemeId)
  );
}

const SYSTEM_PROMPT = `Tu es le moteur de questions d'un quiz de culture générale française.
Règles ABSOLUES :
- FAITS UNIQUEMENT, de niveau encyclopédique, vérifiés via l'outil web_search sur AU MOINS 2 sources indépendantes. Interdiction totale d'inventer ou d'approximer. Un fait que tu ne peux pas vérifier = question abandonnée.
- 4 choix plausibles de même catégorie, un seul correct, position de la bonne réponse variée.
- anecdote : 1-2 phrases, surprenante, strictement factuelle, liée à la question.
- sources : ≥2 URLs réelles issues de tes recherches web.
- INTERDIT : polémique politique, NSFW, vie privée de personnes vivantes, citations d'œuvres protégées.
- Contenu en français correct (typographie française).
Réponds UNIQUEMENT avec un objet JSON : {"questions":[{"theme","difficulty","question","choices","answerIndex","anecdote","sources"}]} sans texte autour.`;

export async function POST(req: Request): Promise<NextResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ fallback: true, reason: "no-api-key" }, { status: 503 });
  }

  let body: { theme?: string | null; difficulty?: number; count?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  const theme = THEME_IDS.includes(body.theme as ThemeId) ? (body.theme as ThemeId) : null;
  const difficulty = Math.min(5, Math.max(1, Math.round(body.difficulty ?? 3)));
  const count = Math.min(20, Math.max(1, Math.round(body.count ?? 10)));

  const userPrompt = `Génère ${count} questions${theme ? ` sur le thème "${theme}"` : " réparties sur des thèmes variés (parmi : " + THEME_IDS.join(", ") + ")"}, difficulté centrée sur ${difficulty}/5 (répartis sur ${Math.max(1, difficulty - 1)}–${Math.min(5, difficulty + 1)}). Vérifie chaque fait par recherche web avant de l'inclure.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-fable-5",
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ fallback: true, reason: `upstream-${res.status}` }, { status: 503 });
    }

    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("\n");

    // The model may wrap the JSON in prose or fences: extract the outermost object.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) {
      return NextResponse.json({ fallback: true, reason: "no-json" }, { status: 503 });
    }
    const parsed = JSON.parse(text.slice(start, end + 1)) as { questions?: unknown[] };
    const questions = (parsed.questions ?? [])
      .filter(isValid)
      .map((q, i) => ({ ...q, difficulty: Math.round(q.difficulty), id: `api-${Date.now()}-${i}` }));

    return NextResponse.json({ questions });
  } catch {
    return NextResponse.json({ fallback: true, reason: "generation-failed" }, { status: 503 });
  }
}
