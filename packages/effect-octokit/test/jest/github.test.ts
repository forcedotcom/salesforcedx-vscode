/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { GitHub } from '../../src/github.js';

const originalFetch = globalThis.fetch;

const json = (body: unknown, status = 200, headers?: Record<string, string>) => {
  const response = new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers }
  });
  // paginate-rest reads response.url when the payload has total_count. fetch() sets it; Response does not.
  Object.defineProperty(response, 'url', { value: 'https://api.github.com/repos/o/r?per_page=100' });
  return response;
};

const run = <A, E>(effect: Effect.Effect<A, E, GitHub>) => {
  process.env.IDEE_GH_TOKEN = 'test-token';
  return effect.pipe(
    Effect.provide(GitHub.Default),
    Effect.ensuring(
      Effect.sync(() => {
        globalThis.fetch = originalFetch;
        delete process.env.IDEE_GH_TOKEN;
      })
    ),
    Effect.runPromise
  );
};

describe('GitHub', () => {
  it('maps an HTTP error onto GitHubRequestError', async () => {
    globalThis.fetch = async () => json({ message: 'nope' }, 500);
    const exit = await run(GitHub.teamMembership('forcedotcom', 'ide-experience', 'someone').pipe(Effect.either));
    expect(exit._tag === 'Left' && exit.left.status === 500 ? exit.left.message : undefined).toContain('nope');
  });

  it('treats a missing team membership as none', async () => {
    globalThis.fetch = async () => json({ message: 'Not Found' }, 404);
    const state = await run(GitHub.teamMembership('forcedotcom', 'ide-experience', 'someone'));
    expect(state).toBe('none');
  });

  it('maps a GraphQL error payload onto GitHubRequestError', async () => {
    globalThis.fetch = async () => json({ data: undefined, errors: [{ message: 'boom' }] });
    const exit = await run(GitHub.graphql('query { viewer { login } }').pipe(Effect.either));
    expect(exit._tag === 'Left' && exit.left.status === 200 ? exit.left.message : undefined).toContain('boom');
  });

  it('follows the Link header when listing pull files', async () => {
    globalThis.fetch = async input => {
      const url = String(input);
      return url.includes('page=2')
        ? json([{ filename: 'b.ts' }])
        : json([{ filename: 'a.ts' }], 200, {
            link: '<https://api.github.com/repos/o/r/pulls/1/files?page=2>; rel="next"'
          });
    };
    const files = await run(GitHub.pullFiles('o', 'r', 1));
    expect(files.map(file => file.filename)).toEqual(['a.ts', 'b.ts']);
  });

  it('unwraps check_runs from the list response', async () => {
    globalThis.fetch = async () =>
      json({
        total_count: 1,
        check_runs: [{ name: 'lint', status: 'completed', conclusion: 'success', details_url: 'https://example.test' }]
      });
    const runs = await run(GitHub.checkRuns('o', 'r', 'abc'));
    expect(runs).toEqual([
      { name: 'lint', status: 'completed', conclusion: 'success', details_url: 'https://example.test' }
    ]);
  });

  it('retries once when GitHub sends retry-after', async () => {
    const attempts: number[] = [];
    globalThis.fetch = async () => {
      attempts.push(attempts.length);
      return attempts.length === 1
        ? json({ message: 'slow down' }, 429, { 'retry-after': '0' })
        : json({ state: 'active' });
    };
    const state = await run(GitHub.teamMembership('forcedotcom', 'ide-experience', 'someone'));
    expect(state).toBe('active');
    expect(attempts).toEqual([0, 1]);
  });
});
