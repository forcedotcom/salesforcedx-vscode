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
import { bindJudgment, manualTestPlanProgram, renderManualTestPlan, spliceManualTestPlan } from './manualTestPlan.mts';
import { CursorRunFailed, type Facts } from './schema.mts';

const repoRoot = join(import.meta.dirname, '..', '..');

const facts = (specs: readonly string[], workflows: Facts['packages'][number]['workflows']): Facts => ({
  packages: [
    {
      package: 'salesforcedx-vscode-core',
      name: 'salesforcedx-vscode-core',
      diff: 'diff',
      playwright: specs.map(path => ({ path, text: 'test' })),
      unitTests: [],
      workflows
    }
  ],
  dependents: [
    {
      package: 'salesforcedx-vscode-lightning',
      workflow: 'Aura E2E (Playwright)',
      jobs: ['e2e-desktop'],
      specs: ['packages/salesforcedx-vscode-lightning/test/playwright/specs/aura.spec.ts'],
      excerpt: 'test'
    }
  ]
});

const sampleFacts = facts(
  ['packages/salesforcedx-vscode-core/test/playwright/specs/core.spec.ts'],
  [{ name: 'Core E2E (Playwright)', jobs: ['e2e-desktop'] }]
);

const config = ConfigProvider.fromMap(
  new Map([
    ['PR_NUMBER', '12'],
    ['BASE_REF', 'develop'],
    ['CURSOR_API_KEY', 'test-key']
  ])
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
  git(remote, ['init', '--bare']);
  git(cwd, ['init']);
  git(cwd, ['checkout', '-b', 'develop']);
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
  prompt: (skill: string, factsJson: string) => Effect.Effect<string, CursorRunFailed>,
  state: { body: string; writes: string[] }
) =>
  manualTestPlanProgram({
    cwd,
    prompt: (skill, factsJson) => prompt(skill, factsJson),
    readBody: () => Effect.succeed(state.body),
    writeBody: (_pr, body) =>
      Effect.sync(() => {
        state.body = body;
        state.writes.push(body);
      })
  }).pipe(Effect.provide(NodeContext.layer), Effect.withConfigProvider(config), Effect.runPromise);

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
  assert.equal(first.split('<!-- manual-test-plan -->').length, 2);
  const second = spliceManualTestPlan(
    first,
    renderManualTestPlan({
      kind: 'checklist',
      items: [{ kind: 'manual', step: 'Check the status bar' }]
    })
  );
  assert.equal(second.slice(0, prefix.length), prefix);
  assert.equal(second.includes('Open the org browser'), false);
  assert.equal(second.includes('- [ ] Check the status bar'), true);
  assert.equal(second.split('<!-- manual-test-plan -->').length, 2);
});

test('nothing renders the fixed sentence', () => {
  assert.equal(renderManualTestPlan({ kind: 'nothing' }).includes('Nothing worth manually testing.'), true);
});

test('watch-video drops when spec, workflow, or job is absent', () => {
  const kept = bindJudgment(
    {
      kind: 'checklist',
      items: [
        {
          kind: 'watch-video',
          spec: 'packages/salesforcedx-vscode-lightning/test/playwright/specs/aura.spec.ts',
          workflow: 'Aura E2E (Playwright)',
          job: 'e2e-desktop'
        },
        {
          kind: 'watch-video',
          spec: 'missing.spec.ts',
          workflow: 'Core E2E (Playwright)',
          job: 'e2e-desktop'
        },
        { kind: 'manual', step: 'Look at the editor' }
      ]
    },
    sampleFacts
  );
  assert.equal(kept?.kind, 'checklist');
  const rendered = kept === undefined ? '' : renderManualTestPlan(kept);
  assert.match(
    rendered,
    /- \[ \] Watch video: `packages\/salesforcedx-vscode-lightning\/test\/playwright\/specs\/aura\.spec\.ts` in `Aura E2E \(Playwright\)` \(`e2e-desktop`\)/
  );
  assert.equal(rendered.includes('missing.spec.ts'), false);
  assert.equal(rendered.includes('- [ ] Look at the editor'), true);
  assert.equal(
    bindJudgment(
      {
        kind: 'checklist',
        items: [
          {
            kind: 'watch-video',
            spec: 'missing.spec.ts',
            workflow: 'Core E2E (Playwright)',
            job: 'e2e-web'
          }
        ]
      },
      sampleFacts
    ),
    undefined
  );
  const auraSpec = 'packages/salesforcedx-vscode-lightning/test/playwright/specs/aura.spec.ts';
  assert.equal(
    bindJudgment(
      {
        kind: 'checklist',
        items: [{ kind: 'watch-video', spec: auraSpec, workflow: 'Nope', job: 'e2e-desktop' }]
      },
      sampleFacts
    ),
    undefined
  );
  assert.equal(
    bindJudgment(
      {
        kind: 'checklist',
        items: [{ kind: 'watch-video', spec: auraSpec, workflow: 'Aura E2E (Playwright)', job: 'e2e-web' }]
      },
      sampleFacts
    ),
    undefined
  );
});

test('missing skill ref leaves the body unchanged', async () => {
  const cwd = initRepo(false);
  const state = { body: '## Summary\n\nkept\n', writes: [] as string[] };
  let prompted = false;
  const outcome = await run(
    cwd,
    () => {
      prompted = true;
      return Effect.succeed('{"kind":"nothing"}');
    },
    state
  );
  assert.deepEqual(outcome, { edited: false });
  assert.equal(prompted, false);
  assert.deepEqual(state.writes, []);
  assert.equal(state.body, '## Summary\n\nkept\n');
});

test('judgment failures leave the body unchanged', async () => {
  const cwd = initRepo(true);
  const cases = [
    () => Effect.succeed('not-json'),
    () => Effect.fail(new CursorRunFailed({ status: 'error', message: 'boom' })),
    () => Effect.succeed('{"kind":"checklist","items":[]}'),
    () =>
      Effect.succeed(
        JSON.stringify({
          kind: 'checklist',
          items: [{ kind: 'watch-video', spec: 'missing.spec.ts', workflow: 'Nope', job: 'e2e-web' }]
        })
      )
  ];
  for (const prompt of cases) {
    const state = { body: '## Summary\n\nkept\n', writes: [] as string[] };
    const outcome = await run(cwd, () => prompt(), state);
    assert.deepEqual(outcome, { edited: false });
    assert.deepEqual(state.writes, []);
  }
});

test('a checklist splices once and a second run replaces that block', async () => {
  const cwd = initRepo(true);
  const state = { body: '## Summary\n\nkept\n\n## Plan\n\nlink\n', writes: [] as string[] };
  const prompts = [
    '{"kind":"checklist","items":[{"kind":"manual","step":"Open the org browser"}]}',
    '{"kind":"nothing"}'
  ];
  const first = await run(cwd, () => Effect.succeed(prompts[0] ?? ''), state);
  assert.deepEqual(first, { edited: true });
  assert.equal(
    state.writes[0]?.slice(0, '## Summary\n\nkept\n\n## Plan\n\nlink\n'.length),
    '## Summary\n\nkept\n\n## Plan\n\nlink\n'
  );
  assert.equal(state.body.includes('- [ ] Open the org browser'), true);
  const second = await run(cwd, () => Effect.succeed(prompts[1] ?? ''), state);
  assert.deepEqual(second, { edited: true });
  assert.equal(
    state.body.slice(0, '## Summary\n\nkept\n\n## Plan\n\nlink\n'.length),
    '## Summary\n\nkept\n\n## Plan\n\nlink\n'
  );
  assert.equal(state.body.includes('Open the org browser'), false);
  assert.equal(state.body.includes('Nothing worth manually testing.'), true);
  assert.equal(state.body.split('<!-- manual-test-plan -->').length, 2);
});

test('workflow uses github.token and skips when the cursor key is empty', () => {
  const workflow = readFileSync(join(repoRoot, '.github', 'workflows', 'manual-test-plan.yml'), 'utf8');
  assert.match(workflow, /types: \[opened, synchronize\]/);
  assert.match(workflow, /group: manual-test-plan-\$\{\{ github\.event\.pull_request\.number \}\}/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /if: needs\.secret\.outputs\.has_key == 'true'/);
  assert.match(workflow, /has_key=false/);
  assert.match(workflow, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(workflow, /fetch-depth: 0/);
  const manifest = JSON.parse(readFileSync(join(repoRoot, 'scripts', 'manualTestPlan', 'package.json'), 'utf8')) as {
    name: string;
    private: boolean;
  };
  assert.equal(manifest.name, '@salesforce/manual-test-plan');
  assert.equal(manifest.private, true);
  assert.equal(
    readFileSync(join(repoRoot, 'scripts', 'manualTestPlan', 'package-lock.json'), 'utf8').includes(
      '"lockfileVersion": 3'
    ),
    true
  );
});
