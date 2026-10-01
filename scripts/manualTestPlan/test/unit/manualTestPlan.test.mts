/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as NodeContext from '@effect/platform-node/NodeContext';
import { ConfigProvider, Effect } from 'effect';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  judgmentError,
  manualTestPlanProgram,
  renderManualTestPlan,
  spliceManualTestPlan,
  type PromptInput
} from '../../manualTestPlan.mts';
import { CursorRunFailed } from '../../schema.mts';

const repoRoot = join(import.meta.dirname, '..', '..', '..', '..');

const eventPath = join(mkdtempSync(join(tmpdir(), 'manual-test-plan-event-')), 'event.json');
writeFileSync(eventPath, JSON.stringify({ pull_request: { number: 12 } }));

const config = ConfigProvider.fromMap(
  new Map(
    Object.entries({
      CI: 'true',
      GITHUB_ACTION: '__run',
      GITHUB_ACTIONS: 'true',
      GITHUB_ACTOR: 'octocat',
      GITHUB_ACTOR_ID: '1',
      GITHUB_API_URL: 'https://api.github.com',
      GITHUB_ARTIFACTS: '/tmp/artifacts',
      GITHUB_ARTIFACTS_LIST: '/tmp/artifacts-list',
      GITHUB_BASE_REF: 'develop',
      GITHUB_ENV: '/tmp/env',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_GRAPHQL_URL: 'https://api.github.com/graphql',
      GITHUB_JOB: 'body',
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
      GITHUB_WORKFLOW: 'Manual test plan',
      GITHUB_WORKFLOW_REF: 'forcedotcom/salesforcedx-vscode/.github/workflows/manual-test-plan.yml@refs/heads/develop',
      GITHUB_WORKFLOW_SHA: 'def',
      GITHUB_WORKSPACE: '/tmp/workspace',
      RUNNER_ARCH: 'ARM64',
      RUNNER_ENVIRONMENT: 'github-hosted',
      RUNNER_NAME: 'Hosted Agent',
      RUNNER_OS: 'Linux',
      RUNNER_TEMP: '/tmp',
      RUNNER_TOOL_CACHE: '/tmp/tool-cache'
    })
  )
);

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com'
};

const git = (cwd: string, args: readonly string[]) => {
  execFileSync('git', args, { cwd, env: gitEnv, stdio: 'ignore' });
};

const initRepo = (skill: boolean) => {
  const remote = mkdtempSync(join(tmpdir(), 'manual-test-plan-remote-'));
  const cwd = mkdtempSync(join(tmpdir(), 'manual-test-plan-repo-'));
  git(remote, ['init', '--bare', '-b', 'develop']);
  git(cwd, ['init', '-b', 'develop']);
  if (skill) {
    const skillDir = join(cwd, '.cursor', 'skills', 'manual-test-plan-judgment');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), 'reply with json\n');
  }
  git(cwd, ['add', '-A']);
  git(cwd, ['commit', '--allow-empty', '-m', 'base']);
  git(cwd, ['remote', 'add', 'origin', remote]);
  git(cwd, ['push', '-u', 'origin', 'develop']);
  return cwd;
};

const run = (
  cwd: string,
  prompt: (input: PromptInput) => Effect.Effect<string, CursorRunFailed>,
  state: { body: string; writes: string[] }
) =>
  manualTestPlanProgram({
    cwd,
    prompt,
    readBody: () => Effect.succeed(state.body),
    writeBody: (_pr, body) =>
      Effect.sync(() => {
        state.body = body;
        state.writes.push(body);
      })
  }).pipe(Effect.provide(NodeContext.layer), Effect.withConfigProvider(config), Effect.runPromise);

const replies =
  (lines: readonly string[]) =>
  (input: PromptInput): Effect.Effect<string, CursorRunFailed> => {
    const index = input.correction === undefined ? 0 : 1;
    return Effect.succeed(lines[index] ?? '');
  };

test('splice keeps surrounding sections and replaces only the marked block', () => {
  const prefix = '## Summary\n\nkept\n\n## Plan\n\nlink\n';
  const first = spliceManualTestPlan(
    prefix,
    renderManualTestPlan({
      kind: 'checklist',
      items: [{ kind: 'manual', step: 'Open the org browser' }]
    })
  );
  assert.equal(first.slice(0, prefix.length), prefix);
  assert.equal(first.includes('## Manual test plan'), true);
  assert.equal(first.includes('- [ ] Open the org browser'), true);
  const second = spliceManualTestPlan(first, renderManualTestPlan({ kind: 'nothing' }));
  assert.equal(second.slice(0, prefix.length), prefix);
  assert.equal(second.includes('Open the org browser'), false);
  assert.equal(second.includes('Nothing worth manually testing.'), true);
  assert.equal(second.split('<!-- manual-test-plan -->').length, 2);
});

test('watch-video renders the spec, workflow, and job', () => {
  const rendered = renderManualTestPlan({
    kind: 'checklist',
    items: [
      {
        kind: 'watch-video',
        spec: 'packages/salesforcedx-vscode-core/test/playwright/specs/core.spec.ts',
        workflow: 'Core E2E (Playwright)',
        job: 'e2e-desktop'
      }
    ]
  });
  assert.match(
    rendered,
    /- \[ \] Watch video: `packages\/salesforcedx-vscode-core\/test\/playwright\/specs\/core\.spec\.ts` in `Core E2E \(Playwright\)` \(`e2e-desktop`\)/
  );
});

test('a real core spec and job pass; a missing job does not', async () => {
  const spec = 'packages/salesforcedx-vscode-core/test/playwright/specs/coreOutputChannel.headless.spec.ts';
  const ok = await judgmentError(repoRoot, {
    kind: 'checklist',
    items: [{ kind: 'watch-video', spec, workflow: 'Core E2E (Playwright)', job: 'e2e-desktop' }]
  }).pipe(Effect.provide(NodeContext.layer), Effect.runPromise);
  assert.equal(ok, undefined);
  const missing = await judgmentError(repoRoot, {
    kind: 'checklist',
    items: [{ kind: 'watch-video', spec, workflow: 'Core E2E (Playwright)', job: 'e2e-web' }]
  }).pipe(Effect.provide(NodeContext.layer), Effect.runPromise);
  assert.equal(missing, 'job e2e-web is not in Core E2E (Playwright)');
});

test('missing skill ref leaves the body unchanged', async () => {
  const calls = { n: 0 };
  const state: { body: string; writes: string[] } = { body: '## Summary\n\nkept\n', writes: [] };
  const outcome = await run(
    initRepo(false),
    () => {
      calls.n += 1;
      return Effect.succeed('{"kind":"nothing"}');
    },
    state
  );
  assert.deepEqual(outcome, { edited: false });
  assert.equal(calls.n, 0);
  assert.deepEqual(state.writes, []);
});

test('a cursor failure does not retry', async () => {
  const calls = { n: 0 };
  const state: { body: string; writes: string[] } = { body: '## Summary\n\nkept\n', writes: [] };
  const outcome = await run(
    initRepo(true),
    () => {
      calls.n += 1;
      return Effect.fail(new CursorRunFailed({ status: 'error', message: 'boom' }));
    },
    state
  );
  assert.deepEqual(outcome, { edited: false });
  assert.equal(calls.n, 1);
  assert.deepEqual(state.writes, []);
});

test('schema and watch-video failures retry once', async () => {
  const cwd = initRepo(true);
  const badVideo = JSON.stringify({
    kind: 'checklist',
    items: [{ kind: 'watch-video', spec: 'missing.spec.ts', workflow: 'Nope', job: 'e2e-web' }]
  });
  const state: { body: string; writes: string[] } = { body: '## Summary\n\nkept\n', writes: [] };
  const schema = await run(cwd, replies(['not-json', '{"kind":"nothing"}']), state);
  assert.deepEqual(schema, { edited: true });
  assert.equal(state.body.includes('Nothing worth manually testing.'), true);
  const again: { body: string; writes: string[] } = { body: '## Summary\n\nkept\n', writes: [] };
  const video = await run(cwd, replies([badVideo, '{"kind":"nothing"}']), again);
  assert.deepEqual(video, { edited: true });
  const stuck: { body: string; writes: string[] } = { body: '## Summary\n\nkept\n', writes: [] };
  const twice = await run(cwd, replies(['not-json', 'still-not-json']), stuck);
  assert.deepEqual(twice, { edited: false });
  assert.deepEqual(stuck.writes, []);
});

test('workflow uses the actions token and skips when the cursor key is empty', () => {
  const workflow = readFileSync(join(repoRoot, '.github', 'workflows', 'manual-test-plan.yml'), 'utf8');
  assert.match(workflow, /types: \[opened, synchronize\]/);
  assert.match(workflow, /group: manual-test-plan-\$\{\{ github\.event\.pull_request\.number \}\}/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /if: needs\.secret\.outputs\.has_key == 'true'/);
  assert.match(workflow, /has_key=false/);
  assert.match(workflow, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(workflow, /GITHUB_EVENT_PATH: \$\{\{ github\.event_path \}\}/);
  assert.match(workflow, /GITHUB_REPOSITORY: \$\{\{ github\.repository \}\}/);
  assert.equal(workflow.includes('IDEE_GH_TOKEN'), false);
  assert.equal(workflow.includes('GH_TOKEN'), false);
  assert.equal(workflow.includes('PR_NUMBER'), false);
  assert.equal(workflow.includes('BASE_REF'), false);
  assert.match(workflow, /pnpm --filter @salesforce\/effect-octokit compile/);
  assert.match(workflow, /uses: \.\/\.github\/actions\/setup-pnpm/);
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(workflow, /fetch-depth: 0/);
});
