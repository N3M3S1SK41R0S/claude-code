import { describe, expect, it } from 'vitest';
import type { CellarPeakEntry } from '@velum/core';

import fr from '../locales/fr.json';
import en from '../locales/en.json';
import type { Translate } from './cellarPeak';
import {
  buildReminderContent,
  buildWeeklyContent,
  contentKey,
  createSerialQueue,
  DEFAULT_DRINK_REMINDER_PREFS,
  DRINK_REMINDER_ROUTE,
  drinkReminderIdsToCancel,
  formatReminderTime,
  formatReminderWhen,
  nextReminderDate,
  normalizeDrinkReminderPrefs,
  oneShotStatus,
  parseTimeInput,
  pickReminderWine,
  resetDrinkReminders,
  toExpoWeekday,
  type DrinkReminderPrefs,
} from './drinkReminders';

function translator(catalog: unknown): Translate {
  return (key, opts) => {
    let node: unknown = catalog;
    for (const part of key.split('.')) {
      node = node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined;
    }
    if (typeof node !== 'string') return `!${key}`;
    return node.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(opts?.[name] ?? ''));
  };
}
const tFr = translator(fr);
const tEn = translator(en);

/** Vendredi 23 octobre 2026 (heure locale) — horloge injectée, jamais l'heure réelle. */
function local(day: number, hour: number, minute = 0, month = 9): Date {
  return new Date(2026, month, day, hour, minute, 0, 0);
}

function parts(date: Date | null): [number, number, number, number] | null {
  return date ? [date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()] : null;
}

describe('nextReminderDate — prochaine occurrence, toujours future', () => {
  it('le vendredi 23 à 10 h', () => {
    const now = local(23, 10);
    expect(now.getDay()).toBe(5);
    expect(parts(nextReminderDate('tonight', now))).toEqual([10, 23, 19, 0]);
    expect(parts(nextReminderDate('tomorrow', now))).toEqual([10, 24, 19, 0]);
    expect(parts(nextReminderDate('friday', now))).toEqual([10, 23, 18, 0]);
    expect(parts(nextReminderDate('custom', now, { hour: 10, minute: 30 }))).toEqual([10, 23, 10, 30]);
    // Heure libre déjà passée (ou dans moins d'une minute) → demain.
    expect(parts(nextReminderDate('custom', now, { hour: 9, minute: 0 }))).toEqual([10, 24, 9, 0]);
    expect(parts(nextReminderDate('custom', now, { hour: 10, minute: 0 }))).toEqual([10, 24, 10, 0]);
  });

  it('« ce soir » passé 19 h → demain ; « vendredi » passé 18 h → vendredi suivant', () => {
    const now = local(23, 20);
    expect(parts(nextReminderDate('tonight', now))).toEqual([10, 24, 19, 0]);
    expect(parts(nextReminderDate('friday', now))).toEqual([10, 30, 18, 0]);
    expect(parts(nextReminderDate('friday', local(26, 8)))).toEqual([10, 30, 18, 0]);
  });

  it('change de mois proprement et refuse une heure invalide', () => {
    expect(parts(nextReminderDate('tonight', local(31, 21)))).toEqual([11, 1, 19, 0]);
    expect(nextReminderDate('custom', local(23, 10))).toBeNull();
    expect(nextReminderDate('custom', local(23, 10), { hour: 24, minute: 0 })).toBeNull();
    expect(nextReminderDate('custom', local(23, 10), { hour: 7.5, minute: 0 })).toBeNull();
  });
});

describe('saisie et format de l’heure', () => {
  it('accepte les formats usuels français', () => {
    expect(parseTimeInput('19:30')).toEqual({ hour: 19, minute: 30 });
    expect(parseTimeInput('19h30')).toEqual({ hour: 19, minute: 30 });
    expect(parseTimeInput(' 19 h ')).toEqual({ hour: 19, minute: 0 });
    expect(parseTimeInput('7')).toEqual({ hour: 7, minute: 0 });
    expect(parseTimeInput('25:00')).toBeNull();
    expect(parseTimeInput('19:5')).toBeNull();
    expect(parseTimeInput('ce soir')).toBeNull();
    expect(formatReminderTime({ hour: 9, minute: 5 })).toBe('09:05');
  });

  it('formate l’instant du rappel en heure locale (FR / EN)', () => {
    const when = local(23, 19, 5);
    expect(formatReminderWhen(when, 'fr')).toMatch(/23 octobre à 19:05$/);
    expect(formatReminderWhen(when, 'fr').startsWith('vendredi')).toBe(true);
    expect(formatReminderWhen(when, 'en-GB')).toMatch(/^Friday 23 October at 19:05$/);
  });

  it('convertit le jour JS au format expo (1 = dimanche)', () => {
    expect(toExpoWeekday(0)).toBe(1);
    expect(toExpoWeekday(5)).toBe(6);
    expect(toExpoWeekday(6)).toBe(7);
  });
});

describe('contenu de la notification', () => {
  const bandol: CellarPeakEntry = {
    itemId: 'bandol',
    label: 'Bandol Tempier 2015',
    storageLocation: 'Rangée 2 · Colonne 4',
    windowFrom: 2020,
    windowTo: 2026,
    status: 'closing',
    suggestedDishes: ['gigot d’agneau', 'daube'],
  };
  const soon: CellarPeakEntry = { ...bandol, itemId: 'soon', label: 'Pauillac 2019', status: 'soon' };

  it('met en avant le plus urgent (jamais « l’an prochain »)', () => {
    expect(pickReminderWine([soon, bandol])?.itemId).toBe('bandol');
    expect(pickReminderWine([soon])).toBeNull();
  });

  it('« Ce soir : vin (position) — accord : plat », ouvre /cellar-peak', () => {
    const content = buildReminderContent(bandol, local(23, 19), tFr);
    expect(content).toEqual({
      title: 'Dernière année d’apogée',
      body: 'Ce soir : Bandol Tempier 2015 (Rangée 2 · Col. 4) — accord : gigot d’agneau',
      data: { url: DRINK_REMINDER_ROUTE, itemId: 'bandol', kind: 'drink-oneshot' },
    });
    expect(DRINK_REMINDER_ROUTE).toBe('/cellar-peak');
  });

  it('« Aujourd’hui » le matin ; sans position ni plat, le message reste propre', () => {
    const bare = { ...bandol, storageLocation: undefined, suggestedDishes: [], status: 'peak' as const };
    expect(buildReminderContent(bare, local(23, 9), tFr)?.body).toBe('Aujourd’hui : Bandol Tempier 2015');
    expect(buildReminderContent(bandol, local(23, 19), tEn)?.body).toBe(
      'Tonight: Bandol Tempier 2015 (Row 2 · Col. 4) — pair with: gigot d’agneau',
    );
    expect(buildReminderContent(null, local(23, 19), tFr)).toBeNull();
  });

  it('vin sans libellé : nom traduit dans la notification (FR / EN)', () => {
    const unlabeled = { ...bandol, label: '', storageLocation: undefined, suggestedDishes: [] };
    expect(buildReminderContent(unlabeled, local(23, 19), tFr)?.body).toBe('Ce soir : Vin sans étiquette');
    expect(buildReminderContent(unlabeled, local(23, 19), tEn)?.body).toBe('Tonight: Unlabelled wine');
    expect(buildWeeklyContent([unlabeled], tEn).body).toContain('Unlabelled wine');
  });

  it('rappel hebdomadaire : décompte et vin en tête, ou message neutre', () => {
    const weekly = buildWeeklyContent([soon, bandol], tFr);
    expect(weekly.body).toBe('1 vin(s) à boire — en tête : Bandol Tempier 2015 (Rangée 2 · Col. 4)');
    expect(weekly.data.url).toBe('/cellar-peak');
    expect(weekly.data.kind).toBe('drink-weekly');
    expect(buildWeeklyContent([], tFr).data.kind).toBe('drink-weekly');
    expect(buildWeeklyContent([], tFr).body).not.toMatch(/^!/);
    expect(contentKey(weekly)).toBe(`${weekly.title}\n${weekly.body}`);
  });
});

describe('préférences persistées', () => {
  it('rétro-compatibles : absent ou corrompu → valeurs par défaut sûres', () => {
    expect(normalizeDrinkReminderPrefs(undefined)).toEqual(DEFAULT_DRINK_REMINDER_PREFS);
    expect(
      normalizeDrinkReminderPrefs({
        preset: 'never',
        customHour: 30,
        oneShotAt: 'pas une date',
        weekly: 'oui',
        weeklyWeekday: 9,
        oneShotId: 42,
      }),
    ).toEqual(DEFAULT_DRINK_REMINDER_PREFS);
    expect(normalizeDrinkReminderPrefs({ preset: 'friday', weekly: true, weeklyId: 'w1' })).toMatchObject({
      preset: 'friday',
      weekly: true,
      weeklyId: 'w1',
    });
  });

  it('statut du rappel ponctuel selon l’horloge injectée', () => {
    const prefs = { ...DEFAULT_DRINK_REMINDER_PREFS, oneShotAt: local(23, 19).toISOString() };
    expect(oneShotStatus(prefs, local(23, 10))).toBe('scheduled');
    expect(oneShotStatus(prefs, local(23, 20))).toBe('delivered');
    expect(oneShotStatus(DEFAULT_DRINK_REMINDER_PREFS, local(23, 10))).toBe('none');
  });
});

describe('perte de session : rappels annulés et préférences remises à zéro', () => {
  const scheduledPrefs: DrinkReminderPrefs = {
    ...DEFAULT_DRINK_REMINDER_PREFS,
    preset: 'custom',
    customHour: 21,
    oneShotId: 'one-1',
    oneShotAt: local(23, 19).toISOString(),
    oneShotLabel: 'Bandol Tempier 2015',
    weekly: true,
    weeklyId: 'week-1',
    weeklyContentKey: 'clé',
  };

  it('efface D’ABORD les préférences (rien de l’ancien compte), puis annule tous les rappels connus', async () => {
    let prefs = scheduledPrefs;
    const events: string[] = [];
    await resetDrinkReminders({
      readPrefs: () => prefs,
      writePrefs: (next) => {
        events.push('write');
        prefs = next;
      },
      cancelAll: async (ids) => {
        events.push(`cancel:${ids.join(',')}`);
      },
    });
    expect(events).toEqual(['write', 'cancel:one-1,week-1']);
    expect(prefs).toEqual(DEFAULT_DRINK_REMINDER_PREFS);
    expect(prefs.oneShotLabel).toBeNull();
    expect(prefs.weekly).toBe(false);
  });

  it('une annulation native en échec ne bloque jamais la déconnexion (best effort)', async () => {
    let prefs = scheduledPrefs;
    await expect(
      resetDrinkReminders({
        readPrefs: () => prefs,
        writePrefs: (next) => {
          prefs = next;
        },
        cancelAll: () => Promise.reject(new Error('natif indisponible')),
      }),
    ).resolves.toBeUndefined();
    expect(prefs).toEqual(DEFAULT_DRINK_REMINDER_PREFS);
  });

  it('sans rappel programmé : aucun identifiant, balayage quand même (orphelins)', async () => {
    const seen: string[][] = [];
    await resetDrinkReminders({
      readPrefs: () => DEFAULT_DRINK_REMINDER_PREFS,
      writePrefs: () => undefined,
      cancelAll: async (ids) => {
        seen.push([...ids]);
      },
    });
    expect(seen).toEqual([[]]);
  });
});

describe('notifications programmées à annuler', () => {
  const scheduled = [
    { identifier: 'week-new', data: { url: DRINK_REMINDER_ROUTE, kind: 'drink-weekly' } },
    { identifier: 'week-orphan', data: { url: DRINK_REMINDER_ROUTE, kind: 'drink-weekly', itemId: 'x' } },
    { identifier: 'one', data: { url: DRINK_REMINDER_ROUTE, kind: 'drink-oneshot' } },
    // Version antérieure (sans `kind`) : rappel « à boire » quand même.
    { identifier: 'legacy', data: { url: DRINK_REMINDER_ROUTE, itemId: 'bandol' } },
    { identifier: 'legacy-oneshot', data: { url: DRINK_REMINDER_ROUTE } },
    { identifier: 'other', data: { url: '/community' } },
    { identifier: 'nothing', data: null },
  ];

  it('déconnexion : tous les rappels « à boire », jamais les autres notifications', () => {
    expect(drinkReminderIdsToCancel(scheduled, 'all')).toEqual([
      'week-new',
      'week-orphan',
      'one',
      'legacy',
      'legacy-oneshot',
    ]);
  });

  it('reprogrammation hebdomadaire : tous les hebdomadaires (doublons orphelins compris), jamais le ponctuel en cours', () => {
    expect(drinkReminderIdsToCancel(scheduled, 'weekly', 'legacy-oneshot')).toEqual([
      'week-new',
      'week-orphan',
      'legacy',
    ]);
  });
});

describe('file en série des opérations sur les rappels', () => {
  it('deux reprogrammations concurrentes (Profil + « Mes vins à leur apogée ») ne s’entrelacent jamais', async () => {
    const run = createSerialQueue();
    const log: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = run(async () => {
      log.push('A:début');
      await gate;
      log.push('A:fin');
      return 'A';
    });
    const second = run(async () => {
      log.push('B:début');
      return 'B';
    });
    await Promise.resolve();
    expect(log).toEqual(['A:début']);
    release();
    await expect(first).resolves.toBe('A');
    await expect(second).resolves.toBe('B');
    expect(log).toEqual(['A:début', 'A:fin', 'B:début']);
  });

  it('une opération en échec ne bloque pas les suivantes', async () => {
    const run = createSerialQueue();
    const failed = run(() => Promise.reject(new Error('boum')));
    const next = run(async () => 'ok');
    await expect(failed).rejects.toThrow('boum');
    await expect(next).resolves.toBe('ok');
  });
});
