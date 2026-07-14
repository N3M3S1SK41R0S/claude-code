/**
 * Passeport de provenance détenu par le collectionneur — Pari #8.
 *
 * Chaque objet du carnet porte une chaîne d'événements (création, acquisition,
 * expertise, transfert, vente, exposition) ancrée par un hash chaîné : chaque
 * maillon hache (hash précédent + événement canonique). Toute altération d'un
 * maillon casse la chaîne → `verifyPassport` la détecte. C'est le DPP secondaire
 * hors-luxe que ni Aura ni Arianee ne fournissent pour l'objet hérité.
 *
 * Pur, déterministe, portable : les horodatages sont FOURNIS par l'appelant
 * (jamais Date.now()), donc la chaîne est rejouable et testable à l'identique.
 */
import { sha256 } from './hash.ts';

export type ProvenanceEventType =
  | 'created'
  | 'acquired'
  | 'appraised'
  | 'transferred'
  | 'sold'
  | 'exhibited';

export interface ProvenanceEvent {
  type: ProvenanceEventType;
  /** Horodatage ISO fourni par l'appelant. */
  at: string;
  /** Acteur pseudonymisé (id de propriétaire), jamais de PII en clair. */
  actor?: string;
  detail?: string;
  /** Valorisation attachée (EUR), le cas échéant. */
  valueEUR?: number;
}

export interface ProvenanceLink {
  event: ProvenanceEvent;
  prevHash: string;
  hash: string;
}

export interface ProvenancePassport {
  itemId: string;
  chain: ProvenanceLink[];
  /** Hash du dernier maillon — l'empreinte publique portable du passeport. */
  head: string;
}

const GENESIS_PREV = '0'.repeat(64);

/** Sérialisation canonique stable (clés triées) → hash reproductible. */
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

/** Hash d'un maillon = SHA-256(itemId | prevHash | événement canonique). */
export function linkHash(itemId: string, prevHash: string, event: ProvenanceEvent): string {
  return sha256(`${itemId}|${prevHash}|${stableStringify(event)}`);
}

/** Crée un passeport avec son événement de genèse. */
export function createPassport(itemId: string, genesis: ProvenanceEvent): ProvenancePassport {
  const hash = linkHash(itemId, GENESIS_PREV, genesis);
  return {
    itemId,
    chain: [{ event: genesis, prevHash: GENESIS_PREV, hash }],
    head: hash,
  };
}

/** Ajoute un événement au passeport (chaîne le hash au précédent). */
export function appendEvent(passport: ProvenancePassport, event: ProvenanceEvent): ProvenancePassport {
  const prevHash = passport.head;
  const hash = linkHash(passport.itemId, prevHash, event);
  const link: ProvenanceLink = { event, prevHash, hash };
  return {
    itemId: passport.itemId,
    chain: [...passport.chain, link],
    head: hash,
  };
}

export interface PassportVerification {
  valid: boolean;
  /** Index du premier maillon incohérent (falsifié), si invalide. */
  brokenAt?: number;
}

/**
 * Vérifie l'intégrité de la chaîne : chaque maillon doit chaîner le précédent
 * et son hash doit correspondre à son contenu. Détecte toute falsification.
 */
export function verifyPassport(passport: ProvenancePassport): PassportVerification {
  let prevHash = GENESIS_PREV;
  for (let i = 0; i < passport.chain.length; i++) {
    const link = passport.chain[i] as ProvenanceLink;
    if (link.prevHash !== prevHash) return { valid: false, brokenAt: i };
    const expected = linkHash(passport.itemId, prevHash, link.event);
    if (link.hash !== expected) return { valid: false, brokenAt: i };
    prevHash = link.hash;
  }
  if (passport.chain.length > 0 && passport.head !== prevHash) {
    return { valid: false, brokenAt: passport.chain.length - 1 };
  }
  return { valid: true };
}

/**
 * Adaptateur — construit un passeport (sceau d'intégrité vérifiable) À PARTIR
 * des lignes `provenance_entries` déjà persistées par l'app (chaîne de
 * possession : propriétaire, source d'acquisition, note, date). Le hash chaîné
 * est ainsi DÉRIVÉ de la table existante, sans table parallèle — la
 * tamper-evidence du pari #8 s'ajoute par-dessus le schéma en place.
 */
export interface ProvenanceEntryLike {
  ownerLabel?: string | null;
  acquiredFrom?: string | null;
  note?: string | null;
  /** Date de l'étape (ISO) ; à défaut, `createdAt`. */
  eventDate?: string | null;
  createdAt?: string | null;
}

function entryToEvent(entry: ProvenanceEntryLike, isFirst: boolean): ProvenanceEvent {
  const at = entry.eventDate ?? entry.createdAt ?? '';
  const detail = [entry.acquiredFrom, entry.note].filter(Boolean).join(' — ');
  return {
    type: isFirst ? 'acquired' : 'transferred',
    at,
    ...(entry.ownerLabel ? { actor: entry.ownerLabel } : {}),
    ...(detail ? { detail } : {}),
  };
}

/** Scelle une chaîne `provenance_entries` (ordre chronologique fourni). */
export function sealFromEntries(itemId: string, entries: ProvenanceEntryLike[]): ProvenancePassport | null {
  if (entries.length === 0) return null;
  const [first, ...rest] = entries;
  let passport = createPassport(itemId, entryToEvent(first as ProvenanceEntryLike, true));
  for (const entry of rest) passport = appendEvent(passport, entryToEvent(entry, false));
  return passport;
}

/** Résumé lisible de la chaîne de possession (pour la fiche/le partage). */
export function provenanceSummary(passport: ProvenancePassport): string[] {
  return passport.chain.map((l) => {
    const val = l.event.valueEUR !== undefined ? ` — ${l.event.valueEUR} €` : '';
    const who = l.event.actor ? ` (${l.event.actor})` : '';
    return `${l.event.at} · ${l.event.type}${who}${val}`;
  });
}
