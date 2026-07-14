import {
  validateCandidate,
  validateCaptureInput,
  validateJsonObject,
  type ValidationResult,
} from '../_shared/input.ts';

function expectOk<T>(result: ValidationResult<T>): T {
  if (!result.ok) throw new Error(`Résultat valide attendu : ${result.message}`);
  return result.value;
}

function expectError<T>(result: ValidationResult<T>, fragment: string): void {
  if (result.ok) throw new Error(`Erreur contenant « ${fragment} » attendue`);
  if (!result.message.includes(fragment)) {
    throw new Error(`Message inattendu : « ${result.message} »`);
  }
}

Deno.test('validateJsonObject refuse les corps primitifs et les tableaux', () => {
  expectError(validateJsonObject(null), 'objet attendu');
  expectError(validateJsonObject('texte'), 'objet attendu');
  expectError(validateJsonObject([]), 'objet attendu');
  expectOk(validateJsonObject({}));
});

Deno.test('validateCaptureInput accepte une photo Storage', () => {
  const input = expectOk(
    validateCaptureInput({
      kind: 'photo',
      media: [{ role: 'label', storagePath: 'user-id/photo.jpg' }],
      locale: 'fr',
    }),
  );
  if (input.kind !== 'photo') throw new Error('Kind photo attendu');
});

Deno.test('validateCaptureInput conserve le repli base64 avec storagePath vide', () => {
  expectOk(
    validateCaptureInput({
      kind: 'photo',
      media: [{ role: 'detail', storagePath: '', base64: 'data:image/jpeg;base64,AA==' }],
    }),
  );
});

Deno.test('validateCaptureInput accepte texte vide et fichier vide pour la saisie assistée', () => {
  expectOk(validateCaptureInput({ kind: 'text', text: '' }));
  expectOk(validateCaptureInput({ kind: 'file', fileRows: [] }));
});

Deno.test('validateCaptureInput refuse les formes qui provoqueraient une erreur runtime', () => {
  expectError(validateCaptureInput({ kind: 'video' }), 'input.kind');
  expectError(validateCaptureInput({ kind: 'photo', media: 'photo' }), 'input.media');
  expectError(
    validateCaptureInput({ kind: 'photo', media: [{ role: 'inconnu', storagePath: 'x.jpg' }] }),
    'role',
  );
  expectError(
    validateCaptureInput({ kind: 'photo', media: [{ role: 'label' }] }),
    'storagePath',
  );
  expectError(validateCaptureInput({ kind: 'file', fileRows: ['ligne'] }), 'fileRows[0]');
});

Deno.test('validateCandidate accepte un candidat conforme', () => {
  const candidate = expectOk(
    validateCandidate(
      {
        id: 'wine-1',
        domain: 'wine',
        label: 'Château Exemple 2019',
        confidence: 0.82,
        attributes: { vintage: 2019 },
      },
      'wine',
    ),
  );
  if (candidate.confidence !== 0.82) throw new Error('Confiance conservée attendue');
});

Deno.test('validateCandidate refuse domaine, confiance et attributs invalides', () => {
  const base = {
    id: 'wine-1',
    domain: 'wine',
    label: 'Château Exemple 2019',
    confidence: 0.82,
    attributes: {},
  };

  expectError(validateCandidate(base, 'coin'), 'appartient au domaine');
  expectError(validateCandidate({ ...base, confidence: '0.82' }, 'wine'), 'confidence');
  expectError(validateCandidate({ ...base, confidence: 1.2 }, 'wine'), 'confidence');
  expectError(validateCandidate({ ...base, attributes: null }, 'wine'), 'attributes');
  expectError(validateCandidate({ ...base, label: '   ' }, 'wine'), 'label');
});
