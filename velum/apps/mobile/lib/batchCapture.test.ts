import { describe, expect, it, vi } from 'vitest';

import {
  PRIMARY_ROLE,
  QUICK_JPEG_QUALITY,
  SHEET_JPEG_QUALITY,
  classificationText,
  createUploadTracker,
  formatEstimateRange,
  mediaForRecognition,
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
  it('attend les téléversements en cours ; un échec n’attache rien', async () => {
    const { upload, resolve } = deferredUploads();
    const tracker = createUploadTracker(upload);
    void tracker.start('data:slow');
    void tracker.start('data:ko');
    const settled = settledStoragePaths(
      [
        { role: 'front', base64: 'data:x', storagePath: 'user/x.jpg' },
        { role: 'back', base64: 'data:slow' },
        { role: 'detail', base64: 'data:ko' },
        { role: 'edge', base64: 'data:jamais' },
      ],
      tracker,
    );
    resolve('data:slow', 'user/slow.jpg');
    resolve('data:ko', null);
    await expect(settled).resolves.toEqual([
      { role: 'front', storagePath: 'user/x.jpg' },
      { role: 'back', storagePath: 'user/slow.jpg' },
      { role: 'detail' },
      { role: 'edge' },
    ]);
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
  });

  it('classement en fil d’Ariane', () => {
    expect(classificationText(['France', ' ', 'Cérès', '1849–1850'])).toBe('France › Cérès › 1849–1850');
    expect(classificationText(undefined)).toBe('');
  });

  it('qualité plus élevée pour une planche ; cliché principal par domaine', () => {
    expect(SHEET_JPEG_QUALITY).toBeGreaterThan(QUICK_JPEG_QUALITY);
    expect(PRIMARY_ROLE.stamp).toBe('front');
    expect(PRIMARY_ROLE.coin).toBe('obverse');
  });
});
