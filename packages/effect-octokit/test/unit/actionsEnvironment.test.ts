/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as ConfigProvider from 'effect/ConfigProvider';
import * as Result from 'effect/Result';
import { actionsEnvironment } from '../../src/actionsEnvironment.js';

const sample = {
  CI: 'true',
  GITHUB_ACTION: '__run',
  GITHUB_ACTIONS: 'true',
  GITHUB_ACTOR: 'octocat',
  GITHUB_ACTOR_ID: '1',
  GITHUB_API_URL: 'https://api.github.com',
  GITHUB_ARTIFACTS: '/tmp/artifacts',
  GITHUB_ARTIFACTS_LIST: '/tmp/artifacts-list',
  GITHUB_ENV: '/tmp/env',
  GITHUB_EVENT_NAME: 'check_run',
  GITHUB_EVENT_PATH: '/tmp/event.json',
  GITHUB_GRAPHQL_URL: 'https://api.github.com/graphql',
  GITHUB_JOB: 'category-approve',
  GITHUB_OUTPUT: '/tmp/output',
  GITHUB_PATH: '/tmp/path',
  GITHUB_REPOSITORY: 'forcedotcom/salesforcedx-vscode',
  GITHUB_REPOSITORY_ID: '2',
  GITHUB_REPOSITORY_OWNER: 'forcedotcom',
  GITHUB_REPOSITORY_OWNER_ID: '3',
  GITHUB_RETENTION_DAYS: '90',
  GITHUB_RUN_ATTEMPT: '1',
  GITHUB_RUN_ID: '1658821493',
  GITHUB_RUN_NUMBER: '4',
  GITHUB_SERVER_URL: 'https://github.com',
  GITHUB_SHA: 'abc',
  GITHUB_STEP_SUMMARY: '/tmp/summary',
  GITHUB_TRIGGERING_ACTOR: 'octocat',
  GITHUB_WORKFLOW: 'Category Approve',
  GITHUB_WORKFLOW_REF: 'forcedotcom/salesforcedx-vscode/.github/workflows/categoryApprove.yml@refs/heads/develop',
  GITHUB_WORKFLOW_SHA: 'def',
  GITHUB_WORKSPACE: '/tmp/workspace',
  RUNNER_ARCH: 'ARM64',
  RUNNER_ENVIRONMENT: 'github-hosted',
  RUNNER_NAME: 'Hosted Agent',
  RUNNER_OS: 'Linux',
  RUNNER_TEMP: '/tmp',
  RUNNER_TOOL_CACHE: '/tmp/tool-cache'
};

const withSample = <A, E>(effect: Effect.Effect<A, E, never>, patch?: Record<string, string>): Promise<A> => {
  const provider = ConfigProvider.fromEnvRecord({ ...sample, ...patch });
  return Effect.runPromise(Effect.provide(effect, ConfigProvider.layer(provider)));
};

describe('actionsEnvironment', () => {
  it('parses the workflow environment', async () => {
    const env = await withSample(actionsEnvironment());
    expect(env.owner).toBe('forcedotcom');
    expect(env.repo).toBe('salesforcedx-vscode');
    expect(env.runId).toBe(1_658_821_493);
    expect(env.apiUrl.hostname).toBe('api.github.com');
    expect(Option.isNone(env.baseRef)).toBe(true);
  });

  it('rejects a repository that is not owner/repo', async () => {
    const exit = await withSample(actionsEnvironment().pipe(Effect.result), { GITHUB_REPOSITORY: 'nope' });
    expect(
      Result.isFailure(exit) && exit.failure._tag === 'InvalidActionsEnvironmentError'
        ? exit.failure.message
        : undefined
    ).toContain('owner/repo');
  });
});
