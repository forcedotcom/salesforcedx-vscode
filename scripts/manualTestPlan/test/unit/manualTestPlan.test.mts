/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as NodeContext from '@effect/platform-node/NodeContext';
import { GitHub } from '@salesforce/effect-octokit';
import { ConfigProvider, Effect, Layer, Schema } from 'effect';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { commands, config as openCodeConfig, nodeCommand } from '../../../../test/ciAiFixtures.mts';
import { OpenCodeRunFailed } from '../../../shared/openCode.mts';
import {
  judgmentError,
  manualTestPlanPrompt,
  manualTestPlanProgram,
  renderManualTestPlan,
  spliceManualTestPlan,
  type PromptInput
} from '../../manualTestPlan.mts';

const repoRoot = join(import.meta.dirname, '..', '..', '..', '..');

const eventPath = join(mkdtempSync(join(tmpdir(), 'manual-test-plan-event-')), 'event.json');
writeFileSync(eventPath, JSON.stringify({ pull_request: { number: 12 } }));

const config = ConfigProvider.fromMap(
  new Map(
    Object.entries({
      CI: 'true',
      IDEE_GH_TOKEN: 'test-token',
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

const gitEnv: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com'
};
// Git exports repository-local variables to hooks. Without clearing them, a
// pre-push test run can commit to the real worktree instead of this fixture.
for (const name of execFileSync('git', ['rev-parse', '--local-env-vars'], { encoding: 'utf8' }).trim().split('\n')) {
  delete gitEnv[name];
}

const git = (cwd: string, args: readonly string[]) => {
  execFileSync('git', args, { cwd, env: gitEnv, stdio: 'ignore' });
};

const initRepo = (skill: boolean) => {
  const remote = mkdtempSync(join(tmpdir(), 'manual-test-plan-remote-'));
  const cwd = mkdtempSync(join(tmpdir(), 'manual-test-plan-repo-'));
  git(remote, ['init', '--bare', '-b', 'develop']);
  git(cwd, ['init', '-b', 'develop']);
  if (skill) {
    const skillDir = join(cwd, '.opencode', 'skills', 'manual-test-plan-judgment');
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
  prompt: (input: PromptInput) => Effect.Effect<string, OpenCodeRunFailed>,
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
  }).pipe(Effect.provide([NodeContext.layer, GitHub.Default]), Effect.withConfigProvider(config), Effect.runPromise);

const replies =
  (lines: readonly string[]) =>
  (input: PromptInput): Effect.Effect<string, OpenCodeRunFailed> => {
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

test('inherited pre-push Git variables cannot redirect fixture Git commands', () => {
  const hookRepo = mkdtempSync(join(tmpdir(), 'manual-test-plan-hook-'));
  git(hookRepo, ['init', '-b', 'test']);
  git(hookRepo, ['commit', '--allow-empty', '-m', 'fixture']);
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: hookRepo, env: gitEnv, encoding: 'utf8' });
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_DIR: join(hookRepo, '.git'),
    GIT_WORK_TREE: hookRepo,
    GIT_INDEX_FILE: join(hookRepo, '.git', 'index')
  };
  delete childEnv.NODE_TEST_CONTEXT;

  const output = execFileSync(
    process.execPath,
    ['--test', '--test-name-pattern', '^missing skill ref leaves the body unchanged$', import.meta.filename],
    {
      cwd: repoRoot,
      env: childEnv,
      encoding: 'utf8'
    }
  );

  assert.match(output, /pass 1/);
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: hookRepo, env: gitEnv, encoding: 'utf8' }), head);
  assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: hookRepo, env: gitEnv, encoding: 'utf8' }), '');
});

test('an OpenCode failure does not retry', async () => {
  const calls = { n: 0 };
  const state: { body: string; writes: string[] } = { body: '## Summary\n\nkept\n', writes: [] };
  const outcome = await run(
    initRepo(true),
    () => {
      calls.n += 1;
      return Effect.fail(new OpenCodeRunFailed({ message: 'boom' }));
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

test('workflow uses the OpenCode secret and model variable with the actions token and skips without a key', () => {
  const workflow = readFileSync(join(repoRoot, '.github', 'workflows', 'manual-test-plan.yml'), 'utf8');
  assert.match(workflow, /types: \[opened, synchronize\]/);
  assert.match(workflow, /group: manual-test-plan-\$\{\{ github\.event\.pull_request\.number \|\| github\.run_id \}\}/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /if: github\.event_name == 'pull_request' && needs\.secret\.outputs\.has_key == 'true'/);
  assert.match(workflow, /has_key=false/);
  assert.match(workflow, /OPENCODE_API_KEY: \$\{\{ secrets\.OPENCODE_API_KEY \}\}/);
  assert.match(workflow, /OPENCODE_MODELS: \$\{\{ vars\.OPENCODE_MODELS \}\}/);
  assert.match(workflow, /uses: \.\/\.github\/actions\/setup-opencode/);
  assert.equal(workflow.includes('CURSOR'), false);
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

test('OpenCode subprocess receives isolated read-only configuration, stdin prompt, and no GitHub token', async () => {
  const result = await manualTestPlanPrompt(repoRoot, {
    skill: 'judge this diff',
    diff: '+change',
    correction: 'invalid JSON'
  }).pipe(
    Effect.provide(
      Layer.mergeAll(
        NodeContext.layer,
        commands(command =>
          nodeCommand(
            command,
            `
const fs = require('node:fs');
const config = JSON.parse(fs.readFileSync('opencode.json', 'utf8'));
const prompt = fs.readFileSync(0, 'utf8');
const text = JSON.stringify({
  args:process.argv.slice(1),
  cwd:process.cwd(),
  config,
  prompt,
  githubToken:process.env.GITHUB_TOKEN,
  apiKey:process.env.OPENCODE_API_KEY
});
process.stdout.write([
  {type:'step_start'},
  {type:'text',part:{text}},
  {type:'step_finish',part:{reason:'stop'}}
].map(event => JSON.stringify(event)).join('\\n') + '\\n');
`
          )
        )
      )
    ),
    Effect.withConfigProvider(openCodeConfig()),
    Effect.flatMap(
      Schema.decodeUnknown(
        Schema.parseJson(
          Schema.Struct({
            args: Schema.Array(Schema.String),
            cwd: Schema.String,
            config: Schema.Struct({
              agents: Schema.Struct({
                judgment: Schema.Struct({
                  permissions: Schema.Array(
                    Schema.Struct({ action: Schema.String, resource: Schema.String, effect: Schema.String })
                  )
                })
              })
            }),
            prompt: Schema.String,
            githubToken: Schema.optional(Schema.String),
            apiKey: Schema.String
          })
        )
      )
    ),
    Effect.runPromise
  );
  assert.deepEqual(result.args, [
    '--standalone',
    'run',
    '--agent',
    'judgment',
    '--format',
    'json',
    '--model',
    'opencode/first'
  ]);
  assert.notEqual(result.cwd, repoRoot);
  const readDirectory = realpathSync(repoRoot);
  assert.deepEqual(result.config.agents.judgment.permissions, [
    { action: '*', resource: '*', effect: 'deny' },
    { action: 'external_directory', resource: `${readDirectory}/*`, effect: 'allow' },
    { action: 'read', resource: readDirectory, effect: 'allow' },
    { action: 'read', resource: `${readDirectory}/*`, effect: 'allow' }
  ]);
  assert.equal(result.githubToken === undefined || result.githubToken === '', true);
  assert.equal(result.apiKey, 'test-key');
  assert.match(result.prompt, /judge this diff/);
  assert.match(result.prompt, /\+change/);
  assert.match(result.prompt, /Previous reply failed validation:\ninvalid JSON/);
  assert.equal(existsSync(result.cwd), false);
});
