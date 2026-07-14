import {
  scheduleBackgroundTask,
  type BackgroundRuntime,
} from '../_shared/background.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('scheduleBackgroundTask enregistre la promesse auprès du runtime', async () => {
  const task = Promise.resolve('terminée');
  let registered: Promise<unknown> | null = null;
  let calls = 0;
  const runtime: BackgroundRuntime = {
    waitUntil(promise) {
      calls += 1;
      registered = promise;
    },
  };

  scheduleBackgroundTask(task, runtime);

  assert(calls === 1, `waitUntil devait être appelé une fois, reçu : ${calls}`);
  assert(registered === task, 'waitUntil doit recevoir exactement la promesse de la tâche');
  await task;
});

Deno.test('scheduleBackgroundTask reste non bloquante hors du runtime Supabase', async () => {
  let completed = false;
  const task = Promise.resolve().then(() => {
    completed = true;
  });

  scheduleBackgroundTask(task, null);

  assert(!completed, 'la tâche ne doit pas être attendue par l’appelant');
  await task;
  assert(completed, 'la tâche best-effort doit pouvoir se terminer hors Supabase');
});
