import assert from 'node:assert/strict';
import test from 'node:test';
import * as FetchHttpClient from 'effect/http/FetchHttpClient';
import { ConfigProvider, Effect, Option } from 'effect';
import { readFileSync } from 'node:fs';
import { classifyWithJev, categoryQuestions } from '../scripts/shared/categoryJev.mts';
import { config, decisionResponse } from './ciAiFixtures.mts';

const policy = readFileSync(new URL('../APPROVAL_POLICY.md', import.meta.url), 'utf8');
const diff =
  'diff --git a/test/a.test.ts b/test/a.test.ts\n--- a/test/a.test.ts\n+++ b/test/a.test.ts\n@@ -1 +1 @@\n-assert.ok(false);\n+assert.ok(true);\n';
const answer = (choice = 'tests-only') => ({
  answers: { 'hunk-0': { type: 'choice', choice, confidence: 0.9, probabilities: { [choice]: 0.9, uncovered: 0.1 } } }
});

test('criteria come from policy and text hunks retain file headers', () => {
  const request = categoryQuestions(policy, diff, false);
  assert.deepEqual(Object.keys(request.questions), ['hunk-0']);
  assert.match(request.questions['hunk-0'].criteria['format-or-comments'], /any other token/);
  assert.match(request.questions['hunk-0'].instructions, /test\/a.test.ts/);
});

for (const status of [200, 404, 410, 429, 503, 400, 401, 500]) {
  test(`HTTP ${status} falls back only for unavailable/rate-limited models`, async () => {
    const models: string[] = [];
    const result = await classifyWithJev({ policy, diff, hasCoveredHunks: false }).pipe(
      Effect.provideService(FetchHttpClient.Fetch, async (_url, init) => {
        models.push(JSON.parse(await new Response(init?.body).text()).model.id);
        return models.length === 1 && status !== 200
          ? Response.json(
              {
                _tag: 'ProviderRequestError',
                message: `HTTP ${status}`,
                providerID: 'opencode',
                reason: 'provider',
                status
              },
              { status: 502 }
            )
          : decisionResponse(answer());
      }),
      Effect.provide(ConfigProvider.layer(config())),
      Effect.runPromise
    );
    assert.deepEqual(models, [404, 410, 429, 503].includes(status) ? ['jev-1.13-free', 'jev-1.14'] : ['jev-1.13-free']);
    assert.deepEqual(result, [400, 401, 500].includes(status) ? Option.none() : Option.some(['tests-only']));
  });
}

const invalidBodies: readonly (Parameters<typeof decisionResponse>[0] | string)[] = [
  answer('toString'),
  answer('uncovered'),
  answer('unknown'),
  { answers: {} },
  { answers: { 'hunk-0': { type: 'error' } } },
  'invalid'
];
test('duplicate answer names reject the diff without fallback', async () => {
  let calls = 0;
  const result = await classifyWithJev({ policy, diff, hasCoveredHunks: false }).pipe(
    Effect.provideService(FetchHttpClient.Fetch, async () => {
      calls += 1;
      const response = await decisionResponse(answer()).json();
      return Response.json({ data: { answers: [...response.data.answers, ...response.data.answers] } });
    }),
    Effect.runPromise
  );
  assert.equal(calls, 1);
  assert.deepEqual(result, Option.none());
});
for (const body of invalidBodies) {
  test(`rejects uncovered, missing, or invalid answers without paid fallback: ${JSON.stringify(body)}`, async () => {
    let calls = 0;
    const result = await classifyWithJev({ policy, diff, hasCoveredHunks: false }).pipe(
      Effect.provideService(FetchHttpClient.Fetch, async () => {
        calls += 1;
        return typeof body === 'string' ? Response.json(body) : decisionResponse(body);
      }),
      Effect.provide(ConfigProvider.layer(config())),
      Effect.runPromise
    );
    assert.equal(calls, 1);
    assert.deepEqual(result, Option.none());
  });
}
