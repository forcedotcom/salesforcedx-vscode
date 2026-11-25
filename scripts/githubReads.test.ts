/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type * as FileSystem from '@effect/platform/FileSystem';
import * as NodeContext from '@effect/platform-node/NodeContext';
import { GitHub } from '@salesforce/effect-octokit';
import * as ConfigProvider from 'effect/ConfigProvider';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as TestClock from 'effect/TestClock';
import * as TestContext from 'effect/TestContext';
import {
  downloadArtifacts,
  findPlaywrightWorkflows,
  handleResults,
  monitorWorkflows,
  prioritizeWorkflows
} from './analyzeE2E.mts';

const originalFetch = globalThis.fetch;
const repository = { owner: 'forcedotcom', repo: 'salesforcedx-vscode' };
const workflow = {
  id: 12,
  name: 'LWC E2E (Playwright)',
  status: 'queued',
  conclusion: null,
  created_at: '2026-11-01T00:00:00Z'
};

const json = (body: unknown, headers?: Record<string, string>, status = 200) => {
  const response = new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers }
  });
  Object.defineProperty(response, 'url', { value: 'https://api.github.com/repos/forcedotcom/salesforcedx-vscode' });
  return Promise.resolve(response);
};

const run = <A, E>(effect: Effect.Effect<A, E, GitHub | FileSystem.FileSystem>) =>
  effect.pipe(
    Effect.provide([GitHub.Default, NodeContext.layer]),
    Effect.withConfigProvider(ConfigProvider.fromMap(new Map([['GITHUB_TOKEN', 'test-token']]))),
    Effect.runPromise
  );

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('GitHub script reads', () => {
  it('passes the VSIX branch, event, success and single-run limit to the API', async () => {
    const urls: URL[] = [];
    globalThis.fetch = input => {
      urls.push(new URL(String(input)));
      return json({ workflow_runs: [workflow] });
    };

    const runs = await run(
      GitHub.workflowRuns({ ...repository, branch: 'feature/a', event: 'push', status: 'success', per_page: 1 })
    );

    expect(runs).toEqual([workflow]);
    expect(urls[0].pathname).toBe('/repos/forcedotcom/salesforcedx-vscode/actions/runs');
    expect(Object.fromEntries(urls[0].searchParams)).toEqual({
      branch: 'feature/a',
      event: 'push',
      status: 'success',
      per_page: '1'
    });
  });

  it('filters Playwright runs and prioritizes active runs over completed runs', async () => {
    globalThis.fetch = input => {
      expect(new URL(String(input)).searchParams.get('per_page')).toBe('50');
      return json({
        workflow_runs: [
          workflow,
          { ...workflow, id: 13, name: 'Compile' },
          { ...workflow, id: 14, status: 'completed', conclusion: 'success' }
        ]
      });
    };

    const runs = await run(findPlaywrightWorkflows('feature/a'));
    expect(runs.map(workflowRun => workflowRun.id)).toEqual([12, 14]);
    expect(prioritizeWorkflows(runs).map(workflowRun => workflowRun.id)).toEqual([12]);
  });

  it('uses the newest completed Playwright run when none are active', async () => {
    globalThis.fetch = () =>
      json({
        workflow_runs: [
          { ...workflow, status: 'completed' },
          { ...workflow, id: 13, status: 'completed', created_at: '2026-11-02T00:00:00Z' }
        ]
      });
    expect(
      prioritizeWorkflows(await run(findPlaywrightWorkflows('feature/a'))).map(workflowRun => workflowRun.id)
    ).toEqual([13]);
  });

  it('polls queued and in-progress runs and returns the completed status and conclusion', async () => {
    const statuses = ['in_progress', 'completed'];
    const requests: string[] = [];
    globalThis.fetch = input => {
      requests.push(new URL(String(input)).pathname);
      if (requests.length === 1) return json({ workflow_runs: [workflow] });
      const status = statuses.shift();
      return json({ ...workflow, status, conclusion: status === 'completed' ? 'failure' : null });
    };

    const result = await run(
      Effect.gen(function* () {
        const fiber = yield* findPlaywrightWorkflows('feature/a').pipe(Effect.flatMap(monitorWorkflows), Effect.fork);
        yield* TestClock.adjust(Duration.seconds(5));
        return yield* Fiber.join(fiber);
      }).pipe(Effect.provide(TestContext.TestContext))
    );

    expect(result).toEqual([{ ...workflow, status: 'completed', conclusion: 'failure' }]);
    expect(requests).toEqual([
      '/repos/forcedotcom/salesforcedx-vscode/actions/runs',
      '/repos/forcedotcom/salesforcedx-vscode/actions/runs/12',
      '/repos/forcedotcom/salesforcedx-vscode/actions/runs/12'
    ]);
  });

  it('fails on a status-read error instead of pretending the run completed', async () => {
    globalThis.fetch = input =>
      String(input).includes('/runs/12')
        ? json({ message: 'status unavailable' }, undefined, 500)
        : json({ workflow_runs: [workflow] });

    const result = await run(
      findPlaywrightWorkflows('feature/a').pipe(Effect.flatMap(monitorWorkflows), Effect.either)
    );
    expect(result._tag).toBe('Left');
    if (result._tag === 'Left') expect(result.left).toMatchObject({ _tag: 'GitHubRequestError', status: 500 });
  });

  it('paginates artifact metadata and does not download when there are no artifacts', async () => {
    globalThis.fetch = input =>
      String(input).includes('page=2')
        ? json({ total_count: 2, artifacts: [{ id: 2, name: 'second' }] })
        : json(
            { total_count: 2, artifacts: [{ id: 1, name: 'first' }] },
            {
              link: '<https://api.github.com/repos/forcedotcom/salesforcedx-vscode/actions/runs/12/artifacts?page=2>; rel="next"'
            }
          );
    expect(
      (await run(GitHub.workflowRunArtifacts({ ...repository, run_id: 12 }))).map(artifact => artifact.name)
    ).toEqual(['first', 'second']);

    globalThis.fetch = () => json({ total_count: 0, artifacts: [] });
    expect(await run(downloadArtifacts(12, 'feature/a', 'LWC E2E (Playwright)'))).toBeUndefined();
  });

  it('reports a manual-download fallback after an artifact metadata error and continues with the next workflow', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Read real run-shaped data through the same API boundary as the CLI.
    globalThis.fetch = () =>
      json({
        workflow_runs: [
          { ...workflow, status: 'completed', conclusion: 'failure' },
          { ...workflow, id: 13, status: 'completed', conclusion: 'success' }
        ]
      });
    const workflows = await run(findPlaywrightWorkflows('feature/a'));
    globalThis.fetch = () => json({ message: 'artifacts unavailable' }, undefined, 401);

    await run(handleResults(workflows, 'feature/a'));

    expect(error).toHaveBeenCalledWith('Failed to download artifacts:', 'artifacts unavailable');
    expect(log.mock.calls).toEqual([
      ['✗ E2E tests failed for workflow `LWC E2E (Playwright)` on branch `feature/a`'],
      ['Try manual download: gh run download 12'],
      ['✓ E2E tests passed for workflow `LWC E2E (Playwright)` on branch `feature/a`'],
      ['View workflow: gh run view 13 --web']
    ]);
  });
});
