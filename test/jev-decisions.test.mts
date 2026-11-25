import assert from 'node:assert/strict';
import test from 'node:test';
import * as FetchHttpClient from '@effect/platform/FetchHttpClient';
import { Effect, Option } from 'effect';
import { readFileSync } from 'node:fs';
import { classifyWithJev, categoryQuestions } from '../scripts/shared/categoryJev.mts';
import { config } from './ciAiFixtures.mts';

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
        assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-key');
        models.push(JSON.parse(await new Response(init?.body).text()).model);
        return models.length === 1 && status !== 200 ? new Response('', { status }) : Response.json(answer());
      }),
      Effect.withConfigProvider(config()),
      Effect.either,
      Effect.runPromise
    );
    assert.deepEqual(models, [404, 410, 429, 503].includes(status) ? ['jev-1.13-free', 'jev-1.14'] : ['jev-1.13-free']);
    assert.equal(result._tag, [400, 401, 500].includes(status) ? 'Left' : 'Right');
    if (result._tag === 'Right') assert.deepEqual(result.right, Option.some(['tests-only']));
  });
}

for (const body of [
  answer('toString'),
  answer('uncovered'),
  answer('unknown'),
  { answers: {} },
  { answers: { 'hunk-0': { type: 'error' } } },
  'invalid'
]) {
  test(`rejects uncovered, missing, or invalid answers without paid fallback: ${JSON.stringify(body)}`, async () => {
    let calls = 0;
    const result = await classifyWithJev({ policy, diff, hasCoveredHunks: false }).pipe(
      Effect.provideService(FetchHttpClient.Fetch, async () => {
        calls += 1;
        return Response.json(body);
      }),
      Effect.withConfigProvider(config()),
      Effect.either,
      Effect.runPromise
    );
    assert.equal(calls, 1);
    if (result._tag === 'Right') assert.deepEqual(result.right, Option.none());
  });
}
