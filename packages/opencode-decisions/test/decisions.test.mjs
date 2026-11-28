import assert from 'node:assert/strict';
import test from 'node:test';
import { decisions } from '../out/decisions.js';

test('a failed paid fallback is never retried', async () => {
  const models = [];
  await assert.rejects(
    decisions(
      { input: [], questions: [{ type: 'predicate', name: 'covered', instructions: 'Covered?' }] },
      {
        baseUrl: 'http://127.0.0.1:4096',
        fetch: async (_url, init) => {
          models.push(JSON.parse(await new Response(init.body).text()).model.id);
          return models.length === 1
            ? Response.json(
                {
                  _tag: 'ProviderRequestError',
                  providerID: 'opencode',
                  reason: 'rate_limit',
                  message: 'limited',
                  status: 429
                },
                { status: 502 }
              )
            : Response.json(
                { _tag: 'ModelNotFoundError', providerID: 'opencode', modelID: 'jev-1.14', message: 'missing' },
                { status: 404 }
              );
        }
      }
    )
  );
  assert.deepEqual(models, ['jev-1.13-free', 'jev-1.14']);
});

test('returns plain data across the Effect 4 Promise boundary', async () => {
  const result = await decisions(
    {
      input: [{ type: 'text', text: 'test' }],
      questions: [{ type: 'choice', name: 'category', instructions: 'Classify', choices: [{ value: 'tests-only' }] }]
    },
    {
      baseUrl: 'http://127.0.0.1:4096',
      fetch: async () =>
        Response.json({
          data: {
            answers: [
              {
                type: 'choice',
                name: 'category',
                choice: 'tests-only',
                confidence: 1,
                probabilities: [{ value: 'tests-only', probability: 1 }]
              }
            ]
          }
        })
    }
  );
  assert.equal(result.answers[0].choice, 'tests-only');
});

test('cancellation aborts the Effect 4 request', async () => {
  const controller = new AbortController();
  const pending = decisions(
    { input: [], questions: [{ type: 'predicate', name: 'covered', instructions: 'Covered?' }] },
    {
      baseUrl: 'http://127.0.0.1:4096',
      signal: controller.signal,
      fetch: (_url, init) =>
        new Promise((_resolve, reject) =>
          init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
        )
    }
  );
  controller.abort();
  await assert.rejects(pending);
});
