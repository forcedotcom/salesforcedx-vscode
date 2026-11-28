import assert from 'node:assert/strict';
import test from 'node:test';
import * as FetchHttpClient from '@effect/platform/FetchHttpClient';
import { Effect } from 'effect';
import { readFileSync } from 'node:fs';
import { classifyWithJev, categoryQuestions } from '../scripts/shared/categoryJev.mts';
import { config, decisionResponse } from './ciAiFixtures.mts';

const policy = readFileSync(new URL('../APPROVAL_POLICY.md', import.meta.url), 'utf8');
const diff =
  'diff --git a/test/a.test.ts b/test/a.test.ts\n--- a/test/a.test.ts\n+++ b/test/a.test.ts\n@@ -1 +1 @@\n-assert.ok(false);\n+assert.ok(true);\n';
const files = [{ filename: 'test/a.test.ts', diff }];
const answer = (choice = 'tests-only') => ({
  answers: { 'hunk-0': { type: 'choice', choice, confidence: 0.9, probabilities: { [choice]: 0.9, uncovered: 0.1 } } }
});

test('criteria come from policy and text hunks retain file headers', () => {
  const request = categoryQuestions(policy, files, false);
  assert.deepEqual(Object.keys(request.questions), ['hunk-0']);
  assert.match(request.questions['hunk-0'].criteria['format-or-comments'], /any other token/);
  assert.match(request.questions['hunk-0'].instructions, /test\/a.test.ts/);
  assert.deepEqual(request.filenames, ['test/a.test.ts']);
});

for (const status of [200, 404, 410, 429, 503, 400, 401, 500]) {
  test(`HTTP ${status} falls back only for unavailable/rate-limited models`, async () => {
    const models: string[] = [];
    const result = await classifyWithJev({ policy, files, hasCoveredHunks: false }).pipe(
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
      Effect.withConfigProvider(config()),
      Effect.either,
      Effect.runPromise
    );
    assert.deepEqual(models, [404, 410, 429, 503].includes(status) ? ['jev-1.13-free', 'jev-1.14'] : ['jev-1.13-free']);
    if ([400, 401, 500].includes(status)) {
      assert.equal(result._tag, 'Left');
      if (result._tag === 'Left') assert.equal(result.left._tag, 'JevRequestFailed');
    } else {
      assert.equal(result._tag, 'Right');
      if (result._tag === 'Right') assert.deepEqual(result.right, { categories: ['tests-only'], uncoveredFiles: [] });
    }
  });
}

const invalidBodies: readonly (Parameters<typeof decisionResponse>[0] | string)[] = [
  answer('toString'),
  answer('unknown'),
  { answers: {} },
  { answers: { 'hunk-0': { type: 'error' } } },
  'invalid'
];
test('duplicate answer names reject the diff without fallback', async () => {
  let calls = 0;
  const result = await classifyWithJev({ policy, files, hasCoveredHunks: false }).pipe(
    Effect.provideService(FetchHttpClient.Fetch, async () => {
      calls += 1;
      const response = await decisionResponse(answer()).json();
      return Response.json({ data: { answers: [...response.data.answers, ...response.data.answers] } });
    }),
    Effect.flip,
    Effect.runPromise
  );
  assert.equal(calls, 1);
  assert.equal(result._tag, 'JevRequestFailed');
  assert.match(result.message, /missing or duplicate answers/);
});
for (const body of invalidBodies) {
  test(`reports missing or invalid answers as classification failures without paid fallback: ${JSON.stringify(body)}`, async () => {
    let calls = 0;
    const result = await classifyWithJev({ policy, files, hasCoveredHunks: false }).pipe(
      Effect.provideService(FetchHttpClient.Fetch, async () => {
        calls += 1;
        return typeof body === 'string' ? Response.json(body) : decisionResponse(body);
      }),
      Effect.withConfigProvider(config()),
      Effect.flip,
      Effect.runPromise
    );
    assert.equal(calls, 1);
    assert.equal(result._tag, 'JevRequestFailed');
  });
}

test('reports an uncovered answer as content, not a classification failure', async () => {
  const result = await classifyWithJev({ policy, files, hasCoveredHunks: false }).pipe(
    Effect.provideService(FetchHttpClient.Fetch, async () => decisionResponse(answer('uncovered'))),
    Effect.runPromise
  );
  assert.deepEqual(result, { categories: [], uncoveredFiles: ['test/a.test.ts'] });
});

test('reports files without text hunks without calling Jev', async () => {
  const filenames = ['image.png', 'empty.txt', 'executable.sh'];
  const result = await classifyWithJev({
    policy,
    files: filenames.map(filename => ({ filename, diff: `diff --git a/${filename} b/${filename}\n` })),
    hasCoveredHunks: true
  }).pipe(
    Effect.provideService(FetchHttpClient.Fetch, async () => assert.fail('No text hunks to classify')),
    Effect.runPromise
  );
  assert.deepEqual(result, { categories: [], uncoveredFiles: filenames });
});

test('keeps files without text hunks uncovered alongside covered text hunks', async () => {
  const result = await classifyWithJev({
    policy,
    files: [
      ...files,
      { filename: 'image.png', diff: 'diff --git a/image.png b/image.png\nBinary files differ\n' },
      { filename: 'empty.txt', diff: '' }
    ],
    hasCoveredHunks: false
  }).pipe(
    Effect.provideService(FetchHttpClient.Fetch, async () => decisionResponse(answer())),
    Effect.runPromise
  );
  assert.deepEqual(result, { categories: ['tests-only'], uncoveredFiles: ['image.png', 'empty.txt'] });
});
