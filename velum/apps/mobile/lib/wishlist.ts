/**
 * Liste d'envies et d'idées PAR CATÉGORIE — logique PURE, testée sans React
 * Native : segments (Envies / Idées / Obtenues), tri, recherche, statistiques
 * par catégorie, détection de doublon, conversions objet / candidat → envie et
 * envie → objet de la collection, validation du formulaire.
 *
 * Les écrans (`app/wishlist/*`) et `AddToWishlistButton` ne font qu'afficher
 * et brancher ces fonctions sur `client.wishlist` / `client.items`.
 */
import type { NewItem } from '@velum/api-client';
import {
  isVelumError,
  type Candidate,
  type NewWishlistEntry,
  type VelumDomain,
  type VelumItem,
  type WishlistEntry,
  type WishlistKind,
  type WishlistPriority,
  type WishlistSource,
} from '@velum/core';

import { NON_IDENTITY_ATTRIBUTE_KEYS, identityAttributes } from './analysisState';
import {
  identityFieldsFor,
  identityValuesFrom,
  labelFromValues,
  parseNumericInput,
  validateIdentityValues,
} from './identityFields';
import { normalizeText, searchEntries, type SearchDocument } from './search';
import { routes } from './routes';

// ── Bornes (miroir de la migration 20261023110000_wishlist.sql) ──────────────

/** Longueur maximale du titre (contrainte SQL `wishlist_entries_title_check`). */
export const WISHLIST_TITLE_MAX_LENGTH = 200;
/** Longueur maximale des notes (contrainte SQL `wishlist_entries_notes_check`). */
export const WISHLIST_NOTES_MAX_LENGTH = 2000;
/** Plafond de `numeric(14, 2)`. */
const TARGET_PRICE_MAX = 999_999_999_999.99;

/** Clé React Query de la liste complète (partagée écran / bouton / fiche). */
export const WISHLIST_QUERY_KEY = ['wishlist'] as const;

// ── Routes propres au chantier ───────────────────────────────────────────────

/**
 * Sous-routes de /wishlist (la racine est `routes.wishlist(domain, q)` dans
 * lib/routes.ts). « new » n'entre jamais en collision avec un identifiant
 * (uuid côté serveur, `demo-…`/`wish-…` en démo).
 */
export const wishlistRoutes = {
  entry: (id: string) => routes.wishlistEntry(id),
  create: (domain?: VelumDomain | null) => routes.wishlistNew(domain),
} as const;

/** Paramètre de route `domain` → domaine actif, ou null (« Toutes »). */
export function parseDomainParam(
  raw: string | string[] | undefined,
  allowed: readonly VelumDomain[],
): VelumDomain | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined) return null;
  return allowed.find((domain) => domain === value) ?? null;
}

// ── Segments et tri ──────────────────────────────────────────────────────────

/** Segment d'affichage : envie en cours, idée en cours, ou obtenue. */
export type WishlistSegment = 'wish' | 'idea' | 'acquired';
export const WISHLIST_SEGMENTS: readonly WishlistSegment[] = ['wish', 'idea', 'acquired'];

export type WishlistSort = 'priority' | 'recent' | 'targetPrice';
export const WISHLIST_SORTS: readonly WishlistSort[] = ['priority', 'recent', 'targetPrice'];

export const WISHLIST_PRIORITIES: readonly WishlistPriority[] = ['high', 'medium', 'low'];
export const WISHLIST_KINDS: readonly WishlistKind[] = ['wish', 'idea'];

const PRIORITY_RANK: Record<WishlistPriority, number> = { high: 0, medium: 1, low: 2 };

export function segmentOf(entry: Pick<WishlistEntry, 'acquired' | 'kind'>): WishlistSegment {
  return entry.acquired ? 'acquired' : entry.kind;
}

/** Date de référence « récent » : obtention pour une envie comblée, création sinon. */
function recencyKey(entry: WishlistEntry): string {
  return entry.acquired ? (entry.acquiredAt ?? entry.updatedAt) : entry.createdAt;
}

function compareIds(a: WishlistEntry, b: WishlistEntry): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function byRecency(a: WishlistEntry, b: WishlistEntry): number {
  const ka = recencyKey(a);
  const kb = recencyKey(b);
  if (ka !== kb) return ka < kb ? 1 : -1;
  return compareIds(a, b);
}

function byPriority(a: WishlistEntry, b: WishlistEntry): number {
  return (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
}

/** Prix cible croissant, les entrées sans prix en dernier. */
function byTargetPrice(a: WishlistEntry, b: WishlistEntry): number {
  if (a.targetPrice === b.targetPrice) return 0;
  if (a.targetPrice === null) return 1;
  if (b.targetPrice === null) return -1;
  return a.targetPrice - b.targetPrice;
}

/** Tri déterministe (nouvelle liste ; l'entrée n'est pas modifiée). */
export function sortWishlist(entries: readonly WishlistEntry[], sort: WishlistSort): WishlistEntry[] {
  const copy = [...entries];
  switch (sort) {
    case 'priority':
      return copy.sort((a, b) => byPriority(a, b) || byRecency(a, b));
    case 'recent':
      return copy.sort(byRecency);
    case 'targetPrice':
      return copy.sort((a, b) => byTargetPrice(a, b) || byPriority(a, b) || byRecency(a, b));
  }
}

// ── Recherche et filtres ─────────────────────────────────────────────────────

/** Document de recherche : titre + notes + attributs d'identité (sans données techniques). */
export function wishlistSearchDocument(entry: WishlistEntry): SearchDocument {
  return { title: entry.title, fields: [entry.notes, identityAttributes(entry.attributes, entry.domain)] };
}

export interface WishlistFilter {
  /** null = toutes les catégories. */
  domain: VelumDomain | null;
  segment: WishlistSegment;
  query: string;
  sort: WishlistSort;
}

function inDomain(entry: WishlistEntry, domain: VelumDomain | null): boolean {
  return domain === null || entry.domain === domain;
}

/**
 * Entrées visibles : catégorie + segment, triées, puis filtrées par la
 * recherche (à pertinence égale, l'ordre du tri choisi est conservé).
 */
export function filterWishlist(entries: readonly WishlistEntry[], filter: WishlistFilter): WishlistEntry[] {
  const scoped = entries.filter(
    (entry) => inDomain(entry, filter.domain) && segmentOf(entry) === filter.segment,
  );
  return searchEntries(sortWishlist(scoped, filter.sort), filter.query, wishlistSearchDocument);
}

/** Pistes quand la recherche ne trouve rien (ou peu) dans le segment affiché. */
export interface WishlistSearchHints {
  /** Correspondances dans les AUTRES segments de la même catégorie. */
  otherSegments: { segment: WishlistSegment; count: number }[];
  /** Correspondances toutes catégories et tous segments (utile si une catégorie est choisie). */
  everywhere: number;
}

export function searchHints(entries: readonly WishlistEntry[], filter: WishlistFilter): WishlistSearchHints {
  if (normalizeText(filter.query).length === 0) return { otherSegments: [], everywhere: 0 };
  const matching = searchEntries(entries, filter.query, wishlistSearchDocument);
  const otherSegments = WISHLIST_SEGMENTS.filter((segment) => segment !== filter.segment)
    .map((segment) => ({
      segment,
      count: matching.filter((e) => inDomain(e, filter.domain) && segmentOf(e) === segment).length,
    }))
    .filter((hint) => hint.count > 0);
  return { otherSegments, everywhere: matching.length };
}

/**
 * Segment à ouvrir pour une recherche reçue en lien (« Ouvrir mes envies » de
 * la recherche globale, qui compte tous les segments) : le premier segment
 * — Envies, Idées, puis Obtenues — qui contient une correspondance dans la
 * catégorie, pour que les résultats annoncés soient visibles d'emblée.
 * `fallback` si la recherche est vide ou ne trouve rien.
 */
export function segmentForQuery(
  entries: readonly WishlistEntry[],
  domain: VelumDomain | null,
  query: string,
  fallback: WishlistSegment = 'wish',
): WishlistSegment {
  if (normalizeText(query).length === 0) return fallback;
  const matching = searchEntries(
    entries.filter((entry) => inDomain(entry, domain)),
    query,
    wishlistSearchDocument,
  );
  return WISHLIST_SEGMENTS.find((segment) => matching.some((e) => segmentOf(e) === segment)) ?? fallback;
}

/** Nombre d'entrées par segment (pour les libellés « Envies (3) »). */
export function segmentCounts(
  entries: readonly WishlistEntry[],
  domain: VelumDomain | null,
): Record<WishlistSegment, number> {
  const counts: Record<WishlistSegment, number> = { wish: 0, idea: 0, acquired: 0 };
  for (const entry of entries) {
    if (inDomain(entry, domain)) counts[segmentOf(entry)] += 1;
  }
  return counts;
}

/**
 * Regroupe par catégorie dans l'ordre fourni (domaines inconnus à la fin) ;
 * seules les catégories non vides sont retournées, l'ordre interne est gardé.
 */
export function groupByDomain(
  entries: readonly WishlistEntry[],
  order: readonly VelumDomain[],
): { domain: VelumDomain; entries: WishlistEntry[] }[] {
  const groups = new Map<VelumDomain, WishlistEntry[]>();
  for (const domain of order) groups.set(domain, []);
  for (const entry of entries) {
    const bucket = groups.get(entry.domain);
    if (bucket) bucket.push(entry);
    else groups.set(entry.domain, [entry]);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length > 0)
    .map(([domain, list]) => ({ domain, entries: list }));
}

// ── Statistiques par catégorie ───────────────────────────────────────────────

export interface WishlistStats {
  wishes: number;
  ideas: number;
  acquired: number;
  total: number;
  /** Somme des prix cibles des ENVIES en cours (budget à prévoir), en EUR. */
  targetBudget: number;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function wishlistStats(entries: readonly WishlistEntry[], domain: VelumDomain | null = null): WishlistStats {
  const stats: WishlistStats = { wishes: 0, ideas: 0, acquired: 0, total: 0, targetBudget: 0 };
  for (const entry of entries) {
    if (!inDomain(entry, domain)) continue;
    stats.total += 1;
    const segment = segmentOf(entry);
    if (segment === 'acquired') stats.acquired += 1;
    else if (segment === 'idea') stats.ideas += 1;
    else {
      stats.wishes += 1;
      if (entry.targetPrice !== null && Number.isFinite(entry.targetPrice)) {
        stats.targetBudget += entry.targetPrice;
      }
    }
  }
  stats.targetBudget = roundCents(stats.targetBudget);
  return stats;
}

/** Statistiques de chaque catégorie présente (ordre fourni, puis les autres). */
export function statsByDomain(
  entries: readonly WishlistEntry[],
  order: readonly VelumDomain[],
): { domain: VelumDomain; stats: WishlistStats }[] {
  return groupByDomain(entries, order).map((group) => ({
    domain: group.domain,
    stats: wishlistStats(group.entries),
  }));
}

// ── Doublons ─────────────────────────────────────────────────────────────────

/** Clé de comparaison d'un titre (casse, accents, apostrophes, espaces). */
export function wishlistTitleKey(title: string): string {
  return normalizeText(title);
}

/**
 * Envie EN COURS de même catégorie et de même titre normalisé, ou null.
 * Une envie obtenue n'est pas un doublon : on peut vouloir la racheter.
 */
export function findDuplicate(
  entries: readonly WishlistEntry[],
  candidate: { domain: VelumDomain; title: string },
  excludeId?: string,
): WishlistEntry | null {
  const key = wishlistTitleKey(candidate.title);
  if (key.length === 0) return null;
  return (
    entries.find(
      (entry) =>
        !entry.acquired &&
        entry.id !== excludeId &&
        entry.domain === candidate.domain &&
        wishlistTitleKey(entry.title) === key,
    ) ?? null
  );
}

/** Issue d'un ajout aux envies : l'envie créée, ou l'envie en cours déjà présente. */
export interface WishlistAddOutcome {
  entry: WishlistEntry;
  /** true : doublon (même catégorie, même titre normalisé) — rien n'a été créé. */
  duplicate: boolean;
}

/**
 * Ajoute une envie SAUF doublon — règle commune au bouton « Ajouter à mes
 * envies », à l'écran Candidats et au sommelier de cave (hook
 * `useAddToWishlist`). La liste est relue fraîche juste avant (une envie
 * identique a pu être ajoutée ailleurs) ; si cette lecture échoue, l'ajout
 * est tenté quand même : le serveur tranchera.
 */
export async function addUnlessDuplicate(
  input: NewWishlistEntry,
  deps: {
    list: () => Promise<readonly WishlistEntry[]>;
    add: (input: NewWishlistEntry) => Promise<WishlistEntry>;
  },
): Promise<WishlistAddOutcome> {
  let current: readonly WishlistEntry[] | null = null;
  try {
    current = await deps.list();
  } catch {
    current = null;
  }
  const duplicate = current ? findDuplicate(current, { domain: input.domain, title: input.title }) : null;
  if (duplicate) return { entry: duplicate, duplicate: true };
  return { entry: await deps.add(input), duplicate: false };
}

/**
 * Doublon qui bloque l'enregistrement d'une MODIFICATION : seulement si
 * l'envie modifiée est en cours. Une envie obtenue peut coexister avec une
 * envie en cours de même titre (rachat) : modifier ses notes reste possible.
 */
export function duplicateForEdit(
  entries: readonly WishlistEntry[],
  edited: Pick<WishlistEntry, 'id' | 'acquired'>,
  input: { domain: VelumDomain; title: string },
): WishlistEntry | null {
  return edited.acquired ? null : findDuplicate(entries, input, edited.id);
}

/**
 * Doublon qui bloque « Remettre dans mes envies » : l'envie obtenue
 * deviendrait une seconde envie en cours identique.
 */
export function duplicateForReopen(
  entries: readonly WishlistEntry[],
  entry: Pick<WishlistEntry, 'id' | 'domain' | 'title'>,
): WishlistEntry | null {
  return findDuplicate(entries, entry, entry.id);
}

// ── Conversions vers / depuis la collection ──────────────────────────────────

/** Brouillon d'envie prêt pour `AddToWishlistButton` (props compatibles). */
export interface WishlistDraft {
  domain: VelumDomain;
  title: string;
  attributes: Record<string, unknown>;
  source: WishlistSource;
  sourceItemId: string | null;
  notes: string | null;
}

function cleanNotes(notes: string | null | undefined): string | null {
  const trimmed = (notes ?? '').trim();
  return trimmed.length > 0 ? trimmed.slice(0, WISHLIST_NOTES_MAX_LENGTH) : null;
}

/** Titre, sinon libellé composé des champs d'identification principaux. */
function titleOrLabel(
  title: string | null | undefined,
  domain: VelumDomain,
  attributes: Record<string, unknown>,
): string {
  const trimmed = (title ?? '').trim();
  const fallback = labelFromValues(domain, identityValuesFrom(attributes, domain));
  return (trimmed.length > 0 ? trimmed : fallback).slice(0, WISHLIST_TITLE_MAX_LENGTH);
}

/**
 * Envie issue d'un objet de MA collection (« en racheter ») ou d'une note de
 * dégustation (`source: 'tasting'`). Seuls les attributs d'IDENTITÉ du
 * domaine sont copiés (liste d'inclusion) : ni la fiche complète, ni les
 * avertissements, ni l'historique, ni ce qui décrit l'exemplaire possédé
 * (quantité, « bouteille bue », prix payé, emplacement…).
 */
export function entryFromItem(
  item: VelumItem,
  options: { source?: 'item' | 'tasting'; notes?: string | null } = {},
): WishlistDraft {
  const attributes = identityAttributes(item.attributes, item.domain);
  return {
    domain: item.domain,
    title: titleOrLabel(item.title, item.domain, attributes),
    attributes,
    source: options.source ?? 'item',
    sourceItemId: item.id,
    notes: cleanNotes(options.notes),
  };
}

/** Envie issue d'un scan non ajouté à la collection (vin goûté au restaurant…). */
export function entryFromCandidate(
  candidate: Candidate,
  options: { notes?: string | null } = {},
): WishlistDraft {
  const attributes = identityAttributes(candidate.attributes, candidate.domain);
  return {
    domain: candidate.domain,
    title: titleOrLabel(candidate.label, candidate.domain, attributes),
    attributes,
    source: 'scan',
    sourceItemId: null,
    notes: cleanNotes(options.notes),
  };
}

/** Brouillon → création (défauts neutres : envie, priorité moyenne). */
export function draftToNewEntry(
  draft: WishlistDraft,
  overrides: Pick<NewWishlistEntry, 'kind' | 'priority' | 'targetPrice'> = {},
): NewWishlistEntry {
  return {
    domain: draft.domain,
    title: draft.title.trim(),
    attributes: draft.attributes,
    source: draft.source,
    sourceItemId: draft.sourceItemId,
    notes: draft.notes,
    kind: overrides.kind ?? 'wish',
    priority: overrides.priority ?? 'medium',
    targetPrice: overrides.targetPrice ?? null,
  };
}

/**
 * Jour CIVIL (AAAA-MM-JJ) d'un horodatage dans le fuseau de l'appareil — le
 * jour qu'affiche `formatDate` —, ou dans `timeZone` s'il est fourni (tests).
 * Jamais le jour UTC tronqué (décalé d'un jour le soir et la nuit en France).
 * Null si l'horodatage est illisible.
 */
export function localIsoDate(iso: string, timeZone?: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(timeZone !== undefined ? { timeZone } : {}),
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): string | undefined =>
    parts.find((p) => p.type === type)?.value;
  const year = part('year');
  const month = part('month');
  const day = part('day');
  if (year === undefined || month === undefined || day === undefined) return null;
  return `${year.padStart(4, '0')}-${month}-${day}`;
}

/**
 * Envie obtenue → nouvel objet de la collection. La fiche complète n'est PAS
 * générée ici (lente) : `analysisStatus: 'pending'` la fait proposer à la
 * demande sur la fiche objet. Confiance inconnue (null) plutôt qu'inventée ;
 * prix d'acquisition inconnu (le prix cible n'est pas le prix payé). Seule
 * l'identité est reprise (une envie enregistrée avant le filtrage d'inclusion
 * est nettoyée ici) ; date d'acquisition = jour LOCAL de l'obtention.
 */
export function newItemFromEntry(
  entry: WishlistEntry,
  ownerId: string,
  options: { timeZone?: string } = {},
): NewItem {
  return {
    ownerId,
    domain: entry.domain,
    title: entry.title,
    attributes: { ...identityAttributes(entry.attributes, entry.domain), analysisStatus: 'pending' },
    confidence: null,
    acquiredAt: entry.acquiredAt !== null ? localIsoDate(entry.acquiredAt, options.timeZone) : null,
    acquiredPrice: null,
    notes: entry.notes,
  };
}

// ── Communauté (« Disponible dans la communauté ? ») ─────────────────────────

/**
 * Texte court pour chercher l'envie dans le catalogue : le titre avant tout
 * commentaire (« — compléter la série »), limité aux 5 premiers mots — la
 * recherche exige tous les mots, une requête courte trouve davantage.
 */
export function communitySearchText(entry: Pick<WishlistEntry, 'title'>): string {
  const words = (text: string) => text.trim().split(/\s+/).filter((w) => w.length > 0);
  const head = words(entry.title.split(/\s[—–-]\s|[(:;,]/)[0] ?? '');
  return (head.length > 0 ? head : words(entry.title)).slice(0, 5).join(' ');
}

/** Nature d'un échec de la vérification communauté (message adapté, jamais d'écran cassé). */
export type CommunityProblem = 'plan' | 'notYet' | 'unavailable' | 'generic';

export function classifyCommunityError(error: unknown): CommunityProblem {
  if (!isVelumError(error)) return 'unavailable';
  if (error.code === 'PLAN_REQUIRED' || /platine/i.test(error.message)) return 'plan';
  if (/pas encore disponible/i.test(error.message)) return 'notYet';
  if (error.code === 'SOURCE_UNAVAILABLE' || error.code === 'RATE_LIMITED') return 'unavailable';
  return 'generic';
}

// ── Mises à jour locales du cache ────────────────────────────────────────────

/** Insère ou remplace une entrée (nouvelle liste). */
export function upsertEntry(entries: readonly WishlistEntry[], entry: WishlistEntry): WishlistEntry[] {
  const index = entries.findIndex((e) => e.id === entry.id);
  if (index === -1) return [entry, ...entries];
  return entries.map((e) => (e.id === entry.id ? entry : e));
}

export function removeEntry(entries: readonly WishlistEntry[], id: string): WishlistEntry[] {
  return entries.filter((e) => e.id !== id);
}

// ── Affichage ────────────────────────────────────────────────────────────────

/** Tonalité du badge de priorité (seule la priorité haute est mise en avant). */
export const PRIORITY_TONE: Record<WishlistPriority, 'gold' | 'neutral'> = {
  high: 'gold',
  medium: 'neutral',
  low: 'neutral',
};

/** Clé i18n du libellé complet de priorité (« Priorité haute »). */
export const PRIORITY_BADGE_KEY: Record<WishlistPriority, string> = {
  high: 'wishlist.priority.badgeHigh',
  medium: 'wishlist.priority.badgeMedium',
  low: 'wishlist.priority.badgeLow',
};

/**
 * Prix cible en euros : centimes affichés seulement s'ils existent
 * (« 60 € », « 59,90 € ») — jamais arrondi à l'euro comme une estimation.
 */
export function formatTargetPrice(value: number, locale = 'fr'): string {
  const cents = Math.round(value * 100) % 100 !== 0;
  return new Intl.NumberFormat(locale.startsWith('en') ? 'en-GB' : 'fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Extrait d'une ligne des notes, coupé sur un mot. */
export function notesExcerpt(notes: string | null, max = 90): string | null {
  const flat = (notes ?? '').replace(/\s+/g, ' ').trim();
  if (flat.length === 0) return null;
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Attributs d'identité affichables (clés connues du domaine, valeurs scalaires). */
export function identityDetails(
  entry: Pick<WishlistEntry, 'domain' | 'attributes'>,
): { key: string; labelKey: string; value: string }[] {
  const values = identityValuesFrom(entry.attributes, entry.domain);
  return identityFieldsFor(entry.domain)
    .map((field) => ({ key: field.key, labelKey: field.labelKey, value: (values[field.key] ?? '').trim() }))
    .filter((detail) => detail.value.length > 0);
}

// ── Formulaire ───────────────────────────────────────────────────────────────

export interface WishlistFormValues {
  domain: VelumDomain;
  kind: WishlistKind;
  title: string;
  notes: string;
  /** Saisie libre (« 59,90 », « 1 200 € »). */
  targetPrice: string;
  priority: WishlistPriority;
  /** Champs d'identification PRINCIPAUX du domaine (texte saisi). */
  identity: Record<string, string>;
}

function primaryIdentityValues(
  domain: VelumDomain,
  attributes: Record<string, unknown>,
): Record<string, string> {
  const all = identityValuesFrom(attributes, domain);
  const values: Record<string, string> = {};
  for (const field of identityFieldsFor(domain, true)) values[field.key] = all[field.key] ?? '';
  return values;
}

export function emptyWishlistForm(domain: VelumDomain, kind: WishlistKind = 'wish'): WishlistFormValues {
  return {
    domain,
    kind,
    title: '',
    notes: '',
    targetPrice: '',
    priority: 'medium',
    identity: primaryIdentityValues(domain, {}),
  };
}

/** Prix → saisie (virgule décimale à la française par défaut). */
export function formatPriceInput(value: number | null, decimalSeparator = ','): string {
  if (value === null || !Number.isFinite(value)) return '';
  return String(roundCents(value)).replace('.', decimalSeparator);
}

export function formFromEntry(entry: WishlistEntry, decimalSeparator = ','): WishlistFormValues {
  return {
    domain: entry.domain,
    kind: entry.kind,
    title: entry.title,
    notes: entry.notes ?? '',
    targetPrice: formatPriceInput(entry.targetPrice, decimalSeparator),
    priority: entry.priority,
    identity: primaryIdentityValues(entry.domain, entry.attributes),
  };
}

/** Change la catégorie du formulaire : champs d'identification du nouveau domaine. */
export function withDomain(values: WishlistFormValues, domain: VelumDomain): WishlistFormValues {
  if (domain === values.domain) return values;
  return { ...values, domain, identity: primaryIdentityValues(domain, {}) };
}

/** Prix cible saisi → montant (≥ 0, au centime) ; vide → null ; illisible → erreur. */
export function parseTargetPriceInput(raw: string): { ok: true; value: number | null } | { ok: false } {
  const cleaned = raw.replace(/€|eur(os?)?/gi, '').trim();
  if (cleaned.length === 0) return { ok: true, value: null };
  const value = parseNumericInput(cleaned);
  if (value === null || value < 0 || value > TARGET_PRICE_MAX) return { ok: false };
  return { ok: true, value: roundCents(value) };
}

/**
 * Clés d'un EXEMPLAIRE possédé (quantité, « bouteille bue », prix payé ou
 * emplacement d'un import CSV) : jamais celles d'une envie — une envie
 * enregistrée avant le filtrage par inclusion peut encore en porter.
 */
const EXEMPLAR_ATTRIBUTE_KEYS: ReadonlySet<string> = new Set(['quantity', 'consumedAt', 'price_paid', 'location']);

/**
 * Attributs d'une envie conservés à sa MODIFICATION (même catégorie) : liste
 * d'EXCLUSION, car l'app y écrit elle-même des clés hors identité du domaine
 * (plat et styles d'une idée du sommelier). La liste d'inclusion
 * (`identityAttributes`) reste réservée aux COPIES depuis un objet ou un
 * candidat, et vers le nouvel objet.
 */
function editableAttributes(attributes: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (!NON_IDENTITY_ATTRIBUTE_KEYS.has(key) && !EXEMPLAR_ATTRIBUTE_KEYS.has(key)) out[key] = value;
  }
  return out;
}

/** Champs validés, communs à la création et à la modification. */
export interface WishlistInput {
  domain: VelumDomain;
  kind: WishlistKind;
  title: string;
  notes: string | null;
  attributes: Record<string, unknown>;
  targetPrice: number | null;
  priority: WishlistPriority;
}

export type WishlistFormResult =
  | { ok: true; input: WishlistInput }
  | { ok: false; errors: Record<string, string> };

/**
 * Valide le formulaire. Erreurs = clés i18n par champ (`title`, `notes`,
 * `targetPrice`, clés d'identification). Titre vide → libellé composé des
 * champs d'identification ; les deux vides → erreur.
 *
 * `base` (modification) : les attributs existants hors formulaire sont
 * conservés si la catégorie ne change pas (ex. plat et styles d'une idée du
 * sommelier), moins les clés techniques et celles d'un exemplaire possédé
 * (`editableAttributes`) ; sinon ils sont abandonnés (ils décrivaient un
 * objet d'une autre catégorie).
 */
export function buildWishlistInput(
  values: WishlistFormValues,
  base?: Pick<WishlistEntry, 'domain' | 'attributes'>,
): WishlistFormResult {
  const errors: Record<string, string> = {};
  const domain = values.domain;

  for (const [key, messageKey] of Object.entries(validateIdentityValues(values.identity, domain))) {
    errors[key] = messageKey;
  }

  const attributes: Record<string, unknown> =
    base !== undefined && base.domain === domain ? editableAttributes(base.attributes) : {};
  for (const field of identityFieldsFor(domain, true)) {
    const raw = (values.identity[field.key] ?? '').trim();
    if (raw.length === 0) {
      delete attributes[field.key];
      continue;
    }
    const parsed = field.numeric ? parseNumericInput(raw) : raw;
    if (parsed !== null) attributes[field.key] = parsed;
  }

  const typedTitle = values.title.trim();
  const title = typedTitle.length > 0 ? typedTitle : labelFromValues(domain, values.identity).trim();
  if (title.length === 0) errors['title'] = 'wishlist.errors.titleRequired';
  else if (title.length > WISHLIST_TITLE_MAX_LENGTH) errors['title'] = 'wishlist.errors.titleTooLong';

  const notes = values.notes.trim();
  if (notes.length > WISHLIST_NOTES_MAX_LENGTH) errors['notes'] = 'wishlist.errors.notesTooLong';

  const price = parseTargetPriceInput(values.targetPrice);
  if (!price.ok) errors['targetPrice'] = 'wishlist.errors.priceInvalid';

  if (Object.keys(errors).length > 0 || !price.ok) return { ok: false, errors };
  return {
    ok: true,
    input: {
      domain,
      kind: values.kind,
      title,
      notes: notes.length > 0 ? notes : null,
      attributes,
      targetPrice: price.value,
      priority: values.priority,
    },
  };
}
