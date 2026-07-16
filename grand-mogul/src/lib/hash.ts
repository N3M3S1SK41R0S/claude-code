/** Normalize a question text so trivial rewordings collapse to the same key. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** SHA-256 hex digest of the normalized text (dedup key for the question bank). */
export async function questionHash(questionText: string): Promise<string> {
  const data = new TextEncoder().encode(normalizeText(questionText));
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Insecure-context fallback (plain http on LAN): djb2, good enough for dedup.
  let h = 5381;
  for (const byte of data) h = ((h << 5) + h + byte) | 0;
  return `djb2-${(h >>> 0).toString(16)}`;
}

/** Stable cache key for TTS audio blobs. */
export async function audioKey(character: string, text: string): Promise<string> {
  return `${character}:${await questionHash(text)}`;
}
