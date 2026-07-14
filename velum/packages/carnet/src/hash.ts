/**
 * SHA-256 pur, synchrone et portable (Deno Edge / React Native / Node), sans
 * dépendance ni Web Crypto (async). Sert d'ancre d'intégrité au passeport de
 * provenance (Pari #8) : un hash chaîné vérifie qu'aucun maillon d'historique
 * n'a été altéré.
 *
 * Implémentation FIPS 180-4 standard, validée contre les vecteurs de test.
 */

// prettier-ignore
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Lecture bornée d'un tableau typé (indices toujours valides ici). */
function at(arr: Uint32Array | Uint8Array, i: number): number {
  return arr[i] ?? 0;
}

/** Encode une chaîne en octets UTF-8 (sans TextEncoder, pour la portabilité). */
function utf8Bytes(str: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff) {
      const c2 = str.charCodeAt(++i);
      const cp = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return out;
}

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/** Retourne le SHA-256 d'une chaîne UTF-8, en hexadécimal minuscule (64 car.). */
export function sha256(message: string): string {
  const bytes = utf8Bytes(message);
  const l = bytes.length;
  const bitLen = l * 8;
  const withOne = l + 1;
  const pad = (56 - (withOne % 64) + 64) % 64;
  const total = withOne + pad + 8;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[l] = 0x80;
  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen >>> 0;
  buf[total - 8] = (hi >>> 24) & 0xff;
  buf[total - 7] = (hi >>> 16) & 0xff;
  buf[total - 6] = (hi >>> 8) & 0xff;
  buf[total - 5] = hi & 0xff;
  buf[total - 4] = (lo >>> 24) & 0xff;
  buf[total - 3] = (lo >>> 16) & 0xff;
  buf[total - 2] = (lo >>> 8) & 0xff;
  buf[total - 1] = lo & 0xff;

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);

  for (let i = 0; i < total; i += 64) {
    for (let t = 0; t < 16; t++) {
      const o = i + 4 * t;
      w[t] = ((at(buf, o) << 24) | (at(buf, o + 1) << 16) | (at(buf, o + 2) << 8) | at(buf, o + 3)) >>> 0;
    }
    for (let t = 16; t < 64; t++) {
      const w15 = at(w, t - 15);
      const w2 = at(w, t - 2);
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      w[t] = (at(w, t - 16) + s0 + at(w, t - 7) + s1) >>> 0;
    }

    let a = at(H, 0);
    let b = at(H, 1);
    let c = at(H, 2);
    let d = at(H, 3);
    let e = at(H, 4);
    let f = at(H, 5);
    let g = at(H, 6);
    let h = at(H, 7);

    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + at(K, t) + at(w, t)) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (at(H, 0) + a) >>> 0;
    H[1] = (at(H, 1) + b) >>> 0;
    H[2] = (at(H, 2) + c) >>> 0;
    H[3] = (at(H, 3) + d) >>> 0;
    H[4] = (at(H, 4) + e) >>> 0;
    H[5] = (at(H, 5) + f) >>> 0;
    H[6] = (at(H, 6) + g) >>> 0;
    H[7] = (at(H, 7) + h) >>> 0;
  }

  let hex = '';
  for (let i = 0; i < 8; i++) hex += at(H, i).toString(16).padStart(8, '0');
  return hex;
}
