import {
  assertEquals,
  assertRejects,
  assertStringIncludes,
  assertThrows,
} from 'jsr:@std/assert@1';
import { VelumError, type CaptureInput } from '@velum/core';
import type { AuthContext } from '../_shared/auth.ts';
import {
  base64ByteLength,
  hydrateMedia,
  type MediaHydrationLimits,
} from '../_shared/media.ts';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function authWithDownload(
  download: (path: string) => Promise<{ data: Blob | null; error: { message: string } | null }>,
): AuthContext {
  return {
    user: { id: USER_ID } as AuthContext['user'],
    supabase: {
      storage: {
        from(bucket: string) {
          if (bucket !== 'item-media') throw new Error(`Bucket inattendu : ${bucket}`);
          return { download };
        },
      },
    } as unknown as AuthContext['supabase'],
  };
}

function limits(overrides: Partial<MediaHydrationLimits> = {}): MediaHydrationLimits {
  return {
    maxMediaCount: 4,
    maxBytesPerMedia: 10,
    maxTotalBytes: 20,
    ...overrides,
  };
}

function photo(media: CaptureInput['media']): CaptureInput {
  return { kind: 'photo', media };
}

Deno.test('base64ByteLength mesure les formes paddées, non paddées et data URL', () => {
  assertEquals(base64ByteLength('TQ=='), 1);
  assertEquals(base64ByteLength('TWE='), 2);
  assertEquals(base64ByteLength('TWFu'), 3);
  assertEquals(base64ByteLength('TQ'), 1);
  assertEquals(base64ByteLength('data:image/png;base64,VEVTVA=='), 4);
  assertEquals(base64ByteLength(' VE\nVUVA== '), 4);
});

Deno.test('base64ByteLength refuse les types et paddings malformés', () => {
  assertThrows(
    () => base64ByteLength('data:text/plain;base64,VEVTVA=='),
    VelumError,
    'Type de média non pris en charge',
  );
  assertThrows(() => base64ByteLength('A='), VelumError, 'Contenu base64 image invalide');
  assertThrows(() => base64ByteLength('@@@'), VelumError, 'Contenu base64 image invalide');
});

Deno.test('hydrateMedia refuse trop de clichés avant tout téléchargement', async () => {
  let downloads = 0;
  const auth = authWithDownload(async () => {
    downloads += 1;
    return { data: new Blob(['x'], { type: 'image/jpeg' }), error: null };
  });

  await assertRejects(
    () =>
      hydrateMedia(
        auth,
        photo([
          { role: 'front', storagePath: `${USER_ID}/1.jpg` },
          { role: 'signature', storagePath: `${USER_ID}/2.jpg` },
          { role: 'back', storagePath: `${USER_ID}/3.jpg` },
        ]),
        limits({ maxMediaCount: 2 }),
      ),
    VelumError,
    'Trop de photos',
  );
  assertEquals(downloads, 0);
});

Deno.test('hydrateMedia applique les limites aux anciens clients base64', async () => {
  const auth = authWithDownload(async () => {
    throw new Error('Aucun téléchargement attendu');
  });

  await assertRejects(
    () =>
      hydrateMedia(
        auth,
        photo([
          {
            role: 'label',
            storagePath: '',
            base64: 'data:image/jpeg;base64,VEVTVA==',
          },
        ]),
        limits({ maxBytesPerMedia: 3, maxTotalBytes: 6 }),
      ),
    VelumError,
    'Photo 1 trop volumineuse',
  );
});

Deno.test('hydrateMedia télécharge séquentiellement, conserve l’ordre et le type', async () => {
  let active = 0;
  let maxActive = 0;
  const paths: string[] = [];
  const auth = authWithDownload(async (path) => {
    paths.push(path);
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active -= 1;
    return {
      data: new Blob([new Uint8Array([1, 2, 3])], {
        type: path.endsWith('.png') ? 'image/png' : 'image/jpeg',
      }),
      error: null,
    };
  });

  const result = await hydrateMedia(
    auth,
    photo([
      { role: 'label', storagePath: `${USER_ID}/label.jpg` },
      { role: 'capsule', storagePath: `${USER_ID}/capsule.png` },
    ]),
    limits(),
  );

  assertEquals(maxActive, 1);
  assertEquals(paths, [`${USER_ID}/label.jpg`, `${USER_ID}/capsule.png`]);
  assertStringIncludes(result.media?.[0]?.base64 ?? '', 'data:image/jpeg;base64,');
  assertStringIncludes(result.media?.[1]?.base64 ?? '', 'data:image/png;base64,');
  assertEquals(result.media?.map((entry) => entry.role), ['label', 'capsule']);
});

Deno.test('hydrateMedia borne le volume cumulé avant de convertir le second blob', async () => {
  let downloads = 0;
  const auth = authWithDownload(async () => {
    downloads += 1;
    return {
      data: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
      error: null,
    };
  });

  await assertRejects(
    () =>
      hydrateMedia(
        auth,
        photo([
          { role: 'label', storagePath: `${USER_ID}/1.jpg` },
          { role: 'capsule', storagePath: `${USER_ID}/2.jpg` },
        ]),
        limits({ maxBytesPerMedia: 4, maxTotalBytes: 5 }),
      ),
    VelumError,
    'Volume cumulé',
  );
  assertEquals(downloads, 2);
});

Deno.test("hydrateMedia refuse le chemin d'un autre utilisateur sans accès Storage", async () => {
  let downloads = 0;
  const auth = authWithDownload(async () => {
    downloads += 1;
    return { data: null, error: { message: 'interdit' } };
  });

  await assertRejects(
    () =>
      hydrateMedia(
        auth,
        photo([{ role: 'label', storagePath: '99999999-9999-4999-8999-999999999999/x.jpg' }]),
        limits(),
      ),
    VelumError,
    "n'appartient pas",
  );
  assertEquals(downloads, 0);
});

Deno.test('hydrateMedia refuse un contenu Storage qui ne serait pas une image', async () => {
  const auth = authWithDownload(async () => ({
    data: new Blob(['script'], { type: 'text/javascript' }),
    error: null,
  }));

  await assertRejects(
    () =>
      hydrateMedia(
        auth,
        photo([{ role: 'front', storagePath: `${USER_ID}/front.jpg` }]),
        limits(),
      ),
    VelumError,
    'Type de média stocké non pris en charge',
  );
});
