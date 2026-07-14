/**
 * Recalibration de la fenêtre d'apogée par les ouvertures RÉELLES — Pari #9.
 *
 * L'intelligence ancrée-inventaire : la fenêtre de consommation prédite par
 * ZAPPA (a priori) se resserre au fil des bouteilles réellement ouvertes et
 * jugées (« encore jeune », « à l'apogée », « passé »). Chaque ouverture est
 * une observation qui resserre l'IC — irréplicable pour un scanner one-shot.
 *
 * Mise à jour DÉTERMINISTE et prudente (pas de sur-réaction à une observation
 * isolée) : les preuves dures bornent la fenêtre, les contradictions sont
 * signalées plutôt que forcées. Pur et testable.
 */
export type OpeningVerdict = 'too_young' | 'at_peak' | 'past_peak';

export interface OpeningEvent {
  /** Année d'ouverture de la bouteille. */
  year: number;
  verdict: OpeningVerdict;
}

export interface DrinkWindow {
  from: number;
  to: number;
}

export interface RecalibratedWindow {
  window: DrinkWindow;
  /** Confiance 0..1, croissante avec le nombre d'observations cohérentes. */
  confidence: number;
  /** La fenêtre a-t-elle bougé vs a priori ? */
  adjusted: boolean;
  /** Observations contradictoires détectées (on garde alors l'a priori). */
  conflict: boolean;
  notes: string[];
}

/**
 * Resserre la fenêtre d'apogée à partir des ouvertures observées.
 * - `too_young` en année Y ⇒ l'apogée commence après Y (borne basse ≥ Y+1) ;
 * - `past_peak` en année Y ⇒ l'apogée s'achève avant Y (borne haute ≤ Y−1) ;
 * - `at_peak` en année Y ⇒ Y est dans la fenêtre (l'élargit si besoin).
 * Contradiction (p. ex. « trop jeune » APRÈS un « passé ») ⇒ conflict = true,
 * on conserve l'a priori et on abaisse la confiance.
 */
export function recalibrateDrinkWindow(
  prior: DrinkWindow,
  openings: OpeningEvent[],
): RecalibratedWindow {
  if (openings.length === 0) {
    return { window: { ...prior }, confidence: 0.3, adjusted: false, conflict: false, notes: ['Aucune ouverture enregistrée — fenêtre a priori conservée.'] };
  }

  const tooYoung = openings.filter((o) => o.verdict === 'too_young').map((o) => o.year);
  const pastPeak = openings.filter((o) => o.verdict === 'past_peak').map((o) => o.year);
  const atPeak = openings.filter((o) => o.verdict === 'at_peak').map((o) => o.year);

  const maxTooYoung = tooYoung.length > 0 ? Math.max(...tooYoung) : undefined;
  const minPastPeak = pastPeak.length > 0 ? Math.min(...pastPeak) : undefined;

  // Contradiction dure : une preuve « trop jeune » à une année ≥ une preuve « passé ».
  let conflict = false;
  if (maxTooYoung !== undefined && minPastPeak !== undefined && maxTooYoung >= minPastPeak) {
    conflict = true;
  }
  // Un « à l'apogée » hors des bornes dures est aussi contradictoire.
  for (const y of atPeak) {
    if (maxTooYoung !== undefined && y <= maxTooYoung) conflict = true;
    if (minPastPeak !== undefined && y >= minPastPeak) conflict = true;
  }

  if (conflict) {
    return {
      window: { ...prior },
      confidence: 0.25,
      adjusted: false,
      conflict: true,
      notes: ['Ouvertures contradictoires (millésimes hétérogènes ou notes divergentes) — fenêtre a priori conservée, prudence.'],
    };
  }

  // Bornes dures issues des preuves, croisées avec l'a priori.
  let from = prior.from;
  let to = prior.to;
  if (maxTooYoung !== undefined) from = Math.max(from, maxTooYoung + 1);
  if (minPastPeak !== undefined) to = Math.min(to, minPastPeak - 1);
  // Les « à l'apogée » doivent être inclus dans la fenêtre.
  for (const y of atPeak) {
    from = Math.min(from, y);
    to = Math.max(to, y);
  }

  // Garde-fou : jamais une fenêtre vide/inversée — repli sur l'a priori.
  if (from > to) {
    return {
      window: { ...prior },
      confidence: 0.25,
      adjusted: false,
      conflict: true,
      notes: ['Les observations resserrent la fenêtre au-delà du possible — a priori conservé.'],
    };
  }

  const window = { from, to };
  const adjusted = from !== prior.from || to !== prior.to;
  const nConsistent = openings.length;
  const confidence = Number(Math.min(0.95, 0.3 + 0.15 * nConsistent).toFixed(3));

  const notes: string[] = [];
  if (maxTooYoung !== undefined) notes.push(`« Encore jeune » observé jusqu'en ${maxTooYoung} → apogée repoussée à ${from}.`);
  if (minPastPeak !== undefined) notes.push(`« Passé » observé dès ${minPastPeak} → fin d'apogée avancée à ${to}.`);
  if (atPeak.length > 0) notes.push(`${atPeak.length} ouverture(s) « à l'apogée » confirment le cœur de fenêtre.`);
  if (!adjusted) notes.push('Observations cohérentes avec l’a priori — fenêtre inchangée, confiance renforcée.');

  return { window, confidence, adjusted, conflict: false, notes };
}
