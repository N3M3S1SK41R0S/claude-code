import { describe, expect, it, vi } from 'vitest';

import {
  PRIMARY_ROLE,
  QUICK_JPEG_QUALITY,
  SHEET_JPEG_QUALITY,
  classificationText,
  countUnattached,
  createUploadTracker,
  formatEstimateRange,
  mediaForRecognition,
  pictureSizeWithin,
  secondsForDisplay,
  settledStoragePaths,
  startStopwatch,
} from './batchCapture';

/** Téléversement contrôlé par le test : chaque appel attend sa résolution. */
function deferredUploads() {
  const resolvers = new Map<string, (path: string | null) => void>();
  const upload = vi.fn(
    (dataUrl: string) =>
      new Promise<string | null>((resolve) => {
        resolvers.set(dataUrl, resolve);
      }),
  );
  return { upload, resolve: (dataUrl: string, path: string | null) => resolvers.get(dataUrl)?.(path) };
}

describe('createUploadTracker', () => {
  it('ne téléverse jamais deux fois la même photo et suit son état', async () => {
    const { upload, resolve } = deferredUploads();
    const tracker = createUploadTracker(upload);
    const first = tracker.start('data:a');
    const again = tracker.start('data:a');
    expect(again).toBe(first);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(tracker.peek('data:a')).toEqual({ state: 'pending' });
    resolve('data:a', 'user/a.jpg');
    await expect(first).resolves.toBe('user/a.jpg');
    expect(tracker.peek('data:a')).toEqual({ state: 'done', path: 'user/a.jpg' });
  });

  it('un échec (null ou exception) devient « failed », sans rejet', async () => {
    const tracker = createUploadTracker(async (dataUrl) => {
      if (dataUrl === 'data:boom') throw new Error('réseau');
      return null;
    });
    await expect(tracker.start('data:boom')).resolves.toBeNull();
    await expect(tracker.start('data:null')).resolves.toBeNull();
    expect(tracker.peek('data:boom')).toEqual({ state: 'failed' });
    expect(tracker.peek('data:null')).toEqual({ state: 'failed' });
  });

  it('relance un téléversement en échec (réseau revenu), jamais un téléversement en cours ou réussi', async () => {
    const outcomes: (string | null)[] = [null, 'user/a.jpg'];
    const upload = vi.fn(async () => outcomes.shift() ?? null);
    const tracker = createUploadTracker(upload);
    await expect(tracker.start('data:a')).resolves.toBeNull();
    expect(tracker.peek('data:a')).toEqual({ state: 'failed' });
    // Second essai : nouvel appel réseau, et non la promesse déjà résolue à null.
    await expect(tracker.start('data:a')).resolves.toBe('user/a.jpg');
    expect(upload).toHaveBeenCalledTimes(2);
    expect(tracker.peek('data:a')).toEqual({ state: 'done', path: 'user/a.jpg' });
    await expect(tracker.start('data:a')).resolves.toBe('user/a.jpg');
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it('forget libère la photo (un cliché remplacé ne garde pas d’état)', async () => {
    const tracker = createUploadTracker(async () => 'p');
    await tracker.start('data:a');
    tracker.forget('data:a');
    expect(tracker.peek('data:a')).toBeUndefined();
    expect(tracker.wait('data:a')).toBeUndefined();
    await tracker.start('data:b');
    tracker.clear();
    expect(tracker.peek('data:b')).toBeUndefined();
  });
});

describe('mediaForRecognition — reconnaissance sans attendre le téléversement', () => {
  it('chemin connu, téléversement terminé, en cours ou en échec', async () => {
    const { upload, resolve } = deferredUploads();
    const tracker = createUploadTracker(upload);
    void tracker.start('data:done');
    void tracker.start('data:pending');
    const failed = tracker.start('data:failed');
    resolve('data:done', 'user/done.jpg');
    resolve('data:failed', null);
    await failed;
    await Promise.resolve();

    const media = mediaForRecognition(
      [
        { role: 'front', base64: 'data:known', storagePath: ' user/known.jpg ' },
        { role: 'back', base64: 'data:done' },
        { role: 'detail', base64: 'data:pending' },
        { role: 'edge', base64: 'data:failed' },
        { role: 'label', base64: 'data:never' },
      ],
      tracker,
    );
    expect(media).toEqual([
      { role: 'front', storagePath: 'user/known.jpg' },
      { role: 'back', storagePath: 'user/done.jpg' },
      { role: 'detail', storagePath: '', base64: 'data:pending' },
      { role: 'edge', storagePath: '', base64: 'data:failed' },
      { role: 'label', storagePath: '', base64: 'data:never' },
    ]);
  });
});

describe('settledStoragePaths — rattachement à l’enregistrement', () => {
  it('attend les téléversements en cours ; relance UNE fois un échec ou un téléversement jamais lancé', async () => {
    // Résultats successifs par photo : le 1er à la prise de vue, le 2e à l'enregistrement.
    const script: Record<string, (string | null)[]> = {
      'data:slow': ['user/slow.jpg'],
      'data:ko': [null, null],
      'data:revenu': [null, 'user/revenu.jpg'],
      'data:jamais': ['user/jamais.jpg'],
    };
    const upload = vi.fn(async (dataUrl: string) => script[dataUrl]?.shift() ?? null);
    const tracker = createUploadTracker(upload);
    void tracker.start('data:slow');
    await tracker.start('data:ko');
    await tracker.start('data:revenu');
    const paths = await settledStoragePaths(
      [
        { role: 'front', base64: 'data:x', storagePath: 'user/x.jpg' },
        { role: 'back', base64: 'data:slow' },
        { role: 'detail', base64: 'data:ko' },
        { role: 'edge', base64: 'data:revenu' },
        { role: 'label', base64: 'data:jamais' },
      ],
      tracker,
    );
    expect(paths).toEqual([
      { role: 'front', storagePath: 'user/x.jpg' },
      { role: 'back', storagePath: 'user/slow.jpg' },
      { role: 'detail' },
      { role: 'edge', storagePath: 'user/revenu.jpg' },
      { role: 'label', storagePath: 'user/jamais.jpg' },
    ]);
    // Une seule relance par photo sans chemin, aucune pour une photo déjà téléversée.
    expect(upload.mock.calls.map(([dataUrl]) => dataUrl).sort()).toEqual(
      ['data:jamais', 'data:ko', 'data:ko', 'data:revenu', 'data:revenu', 'data:slow'].sort(),
    );
    // L'appelant sait combien de photos ne seront PAS rattachées (avertissement).
    expect(countUnattached(paths)).toBe(1);
  });

  it('attend un téléversement encore en cours puis le relance s’il échoue', async () => {
    const { upload, resolve } = deferredUploads();
    const tracker = createUploadTracker(upload);
    void tracker.start('data:lent');
    const settled = settledStoragePaths([{ role: 'front', base64: 'data:lent' }], tracker);
    resolve('data:lent', null);
    await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
    resolve('data:lent', 'user/lent.jpg');
    await expect(settled).resolves.toEqual([{ role: 'front', storagePath: 'user/lent.jpg' }]);
  });

  it('une entrée sans photo ne déclenche aucun téléversement', async () => {
    const upload = vi.fn(async () => 'jamais');
    const paths = await settledStoragePaths([{ role: 'front', base64: '' }], createUploadTracker(upload));
    expect(paths).toEqual([{ role: 'front' }]);
    expect(upload).not.toHaveBeenCalled();
  });
});

describe('chronométrage et réglages', () => {
  it('stopwatch à horloge injectée', () => {
    let t = 1000;
    const watch = startStopwatch(() => t);
    t = 3349.6;
    expect(watch.elapsed()).toBe(2350);
    t = 500;
    expect(watch.elapsed()).toBe(0);
  });

  it('secondes affichables à une décimale', () => {
    expect(secondsForDisplay(2349)).toBe(2.3);
    expect(secondsForDisplay(-5)).toBe(0);
    expect(secondsForDisplay(Number.NaN)).toBe(0);
  });

  it('fourchette lisible : centimes pour les petites valeurs, euros sinon', () => {
    const plain = (s: string) => s.replace(/[  ]/g, ' ');
    expect(plain(formatEstimateRange({ low: 40, high: 90, currency: 'EUR' }, 'fr'))).toBe('40 € – 90 €');
    expect(plain(formatEstimateRange({ low: 0.3, high: 0.8, currency: 'EUR' }, 'fr'))).toBe('0,30 € – 0,80 €');
    expect(plain(formatEstimateRange({ low: 1200, high: 1500, currency: 'EUR' }, 'en'))).toBe('€1,200 – €1,500');
    // Borne basse en centimes : jamais arrondie à « 0 € » parce que la borne haute dépasse 10 €.
    expect(plain(formatEstimateRange({ low: 0.3, high: 12, currency: 'EUR' }, 'fr'))).toBe('0,30 € – 12,00 €'.replace(/[  ]/g, ' '));
    expect(plain(formatEstimateRange({ low: 5, high: 50, currency: 'EUR' }, 'fr'))).toBe('5 € – 50 €');
  });

  it('classement en fil d’Ariane', () => {
    expect(classificationText(['France', ' ', 'Cérès', '1849–1850'])).toBe('France › Cérès › 1849–1850');
    expect(classificationText(undefined)).toBe('');
  });

  it('résolution native plafonnée : la plus grande taille du capteur sous le grand côté visé', () => {
    // Android : liste « LxH » propre à l'appareil.
    expect(pictureSizeWithin(['4000x3000', '2592x1944', '2048x1536', '1600x1200', '640x480'], 2600)).toBe(
      '2592x1944',
    );
    // iOS : préréglages nommés ignorés, tailles vidéo retenues si elles tiennent.
    expect(pictureSizeWithin(['3840x2160', '1920x1080', '1280x720', 'Photo', 'High'], 2600)).toBe('1920x1080');
    // Rien d'exploitable sous la borne : résolution par défaut (aucune taille imposée).
    expect(pictureSizeWithin(['Photo', 'High', '4032x3024'], 2600)).toBeUndefined();
    expect(pictureSizeWithin([], 2600)).toBeUndefined();
  });

  it('qualité plus élevée pour une planche ; cliché principal par domaine', () => {
    expect(SHEET_JPEG_QUALITY).toBeGreaterThan(QUICK_JPEG_QUALITY);
    expect(PRIMARY_ROLE.stamp).toBe('front');
    expect(PRIMARY_ROLE.coin).toBe('obverse');
  });
});
