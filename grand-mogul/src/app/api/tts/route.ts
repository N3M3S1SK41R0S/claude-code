import { NextResponse } from "next/server";

export const runtime = "edge";

/**
 * ElevenLabs text-to-speech proxy (keeps the API key server-side).
 * Voice ids are configured per character via environment variables; without
 * ELEVENLABS_API_KEY the route answers 503 and the client uses Web Speech.
 */

const SPEAKERS = ["mogul", "gronk", "lilune", "bargol", "melissandre", "fifrelin"] as const;
type Speaker = (typeof SPEAKERS)[number];

const VOICE_ENV: Record<Speaker, string> = {
  mogul: "ELEVENLABS_VOICE_MOGUL",
  gronk: "ELEVENLABS_VOICE_GRONK",
  lilune: "ELEVENLABS_VOICE_LILUNE",
  bargol: "ELEVENLABS_VOICE_BARGOL",
  melissandre: "ELEVENLABS_VOICE_MELISSANDRE",
  fifrelin: "ELEVENLABS_VOICE_FIFRELIN",
};

export async function POST(req: Request): Promise<Response> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ fallback: true, reason: "no-api-key" }, { status: 503 });
  }

  let body: { text?: string; speaker?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  const text = (body.text ?? "").slice(0, 600);
  const speaker: Speaker = SPEAKERS.includes(body.speaker as Speaker) ? (body.speaker as Speaker) : "mogul";
  if (!text.trim()) return NextResponse.json({ error: "empty-text" }, { status: 400 });

  const voiceId = process.env[VOICE_ENV[speaker]] ?? process.env.ELEVENLABS_VOICE_DEFAULT;
  if (!voiceId) {
    return NextResponse.json({ fallback: true, reason: "no-voice-id" }, { status: 503 });
  }

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.45, similarity_boost: 0.7, style: 0.35 },
      }),
    });

    if (!res.ok || !res.body) {
      // Quota exhausted or upstream failure: the client falls back to Web Speech.
      return NextResponse.json({ fallback: true, reason: `upstream-${res.status}` }, { status: 503 });
    }

    return new Response(res.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ fallback: true, reason: "tts-failed" }, { status: 503 });
  }
}
