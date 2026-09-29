/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as NodeContext from '@effect/platform-node/NodeContext';
import { ConfigProvider, Effect, Option } from 'effect';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  CursorRunFailed,
  bindJudgment,
  dependentsFor,
  isLeafE2EWorkflow,
  jobReferencesPackage,
  manualTestPlanProgram,
  parseWorkflowText,
  renderManualTestPlan,
  serviceChange,
  spliceManualTestPlan,
  type Facts,
  type ParsedWorkflow
} from './manualTestPlan.mts';

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
  prompt: (skill: string, factsJson: string) => Effect.Effect<string>,
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
  assert.equal(
    renderManualTestPlan({ kind: 'nothing' }).includes('Nothing worth manually testing.'),
    true
  );
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

test('leaf workflows reference packages by -w, matrix, or upload path', () => {
  assert.equal(isLeafE2EWorkflow('e2e.yml'), false);
  assert.equal(isLeafE2EWorkflow('playwrightE2EFullSuite.yml'), false);
  assert.equal(isLeafE2EWorkflow('rerunPushE2E.yml'), false);
  assert.equal(isLeafE2EWorkflow('coreE2E.yml'), true);
  const parsed = (name: string) => {
    const workflow = parseWorkflowText(readFileSync(join(repoRoot, '.github', 'workflows', name), 'utf8'));
    assert.equal(Option.isSome(workflow), true);
    return Option.isSome(workflow) ? workflow.value : undefined;
  };
  const references = (workflow: ParsedWorkflow | undefined, dir: string, npmName: string) =>
    workflow?.jobs.some(job => jobReferencesPackage(job, dir, npmName)) === true;
  const core = parsed('coreE2E.yml');
  assert.equal(core?.name, 'Core E2E (Playwright)');
  assert.equal(references(core, 'salesforcedx-vscode-core', 'salesforcedx-vscode-core'), true);
  const aura = parsed('auraE2E.yml');
  assert.equal(references(aura, 'salesforcedx-vscode-lightning', 'salesforcedx-vscode-lightning'), true);
  assert.equal(references(aura, 'salesforcedx-vscode-core', 'salesforcedx-vscode-core'), false);
  const codeBuilder = parsed('codeBuilderE2E.yml');
  assert.equal(codeBuilder?.name, 'Code Builder E2E (Playwright)');
  assert.equal(codeBuilder?.jobs.map(job => job.key).includes('code-builder-e2e'), true);
  assert.equal(references(codeBuilder, 'salesforcedx-vscode-core', 'salesforcedx-vscode-core'), true);
  const lwc = parsed('lwcPlaywrightE2E.yml');
  assert.equal(references(lwc, 'salesforcedx-vscode-lwc', 'salesforcedx-vscode-lwc'), true);
  const soql = parsed('soqlE2E.yml');
  assert.equal(references(soql, 'soql-builder-ui', '@salesforce/soql-builder-ui'), true);
});

test('service names follow the services index, not basename equality', () => {
  const indexSource = readFileSync(join(repoRoot, servicesIndex), 'utf8');
  assert.deepEqual(
    serviceChange(
      indexSource,
      [],
      ['packages/salesforcedx-vscode-services/src/core/connectionService.ts'],
      ''
    ),
    { kind: 'services', names: ['ConnectionService'] }
  );
  assert.deepEqual(
    serviceChange(indexSource, [], ['packages/salesforcedx-vscode-services/src/core/defaultOrgRef.ts'], ''),
    { kind: 'services', names: ['ClearDefaultOrgRef', 'TargetOrgRef'] }
  );
  assert.deepEqual(
    serviceChange(
      indexSource,
      [
        {
          path: 'packages/salesforcedx-vscode-services/src/core/connectionService.ts',
          text: "import { helper } from './helper';\n"
        }
      ],
      ['packages/salesforcedx-vscode-services/src/core/helper.ts'],
      ''
    ),
    { kind: 'services', names: ['ConnectionService'] }
  );
  const sharedDiff = [
    'diff --git a/packages/salesforcedx-vscode-services/src/index.ts b/packages/salesforcedx-vscode-services/src/index.ts',
    '--- a/packages/salesforcedx-vscode-services/src/index.ts',
    '+++ b/packages/salesforcedx-vscode-services/src/index.ts',
    '@@',
    '+const prebuiltServicesLayer = Layer.merge()'
  ].join('\n');
  assert.deepEqual(
    serviceChange(indexSource, [], ['packages/salesforcedx-vscode-services/src/index.ts'], sharedDiff),
    { kind: 'shared' }
  );
  const layersDiff = [
    'diff --git a/packages/salesforcedx-vscode-services/src/servicesLayers.ts b/packages/salesforcedx-vscode-services/src/servicesLayers.ts',
    '--- a/packages/salesforcedx-vscode-services/src/servicesLayers.ts',
    '+++ b/packages/salesforcedx-vscode-services/src/servicesLayers.ts',
    '@@',
    '+  EditorService.Default,'
  ].join('\n');
  assert.deepEqual(
    serviceChange(indexSource, [], ['packages/salesforcedx-vscode-services/src/servicesLayers.ts'], layersDiff),
    { kind: 'shared' }
  );
  const wiringDiff = [
    'diff --git a/packages/salesforcedx-vscode-services/src/index.ts b/packages/salesforcedx-vscode-services/src/index.ts',
    '--- a/packages/salesforcedx-vscode-services/src/index.ts',
    '+++ b/packages/salesforcedx-vscode-services/src/index.ts',
    '@@',
    '     const internalLayers = Layer.mergeAll(',
    '-      FileWatcherLayer,',
    '+      FileWatcherLayer,'
  ].join('\n');
  assert.deepEqual(
    serviceChange(indexSource, [], ['packages/salesforcedx-vscode-services/src/index.ts'], wiringDiff),
    { kind: 'shared' }
  );
});

const servicesIndex = 'packages/salesforcedx-vscode-services/src/index.ts';

const writePackage = (root: string, dir: string, source: string, deps?: Readonly<Record<string, string>>) => {
  const src = join(root, 'packages', dir, 'src');
  mkdirSync(src, { recursive: true });
  writeFileSync(join(src, 'extension.ts'), source);
  writeFileSync(
    join(root, 'packages', dir, 'package.json'),
    JSON.stringify({ name: dir, ...(deps === undefined ? {} : { dependencies: deps }) })
  );
};

test('dependents are service callers or language-server package consumers', async () => {
  const root = mkdtempSync(join(tmpdir(), 'manual-test-plan-deps-'));
  mkdirSync(join(root, 'packages', 'salesforcedx-vscode-services', 'src', 'core'), { recursive: true });
  writeFileSync(
    join(root, 'packages', 'salesforcedx-vscode-services', 'src', 'index.ts'),
    [
      "import { ConnectionService } from './core/connectionService';",
      'export const activate = () => ({',
      '      services: {',
      '        ConnectionService,',
      '      }',
      '});',
      ''
    ].join('\n')
  );
  writeFileSync(join(root, 'packages', 'salesforcedx-vscode-services', 'src', 'core', 'connectionService.ts'), 'export class ConnectionService {}\n');
  writeFileSync(join(root, 'packages', 'salesforcedx-vscode-services', 'package.json'), JSON.stringify({ name: 'salesforcedx-vscode-services' }));
  writePackage(root, 'consumer', 'export const use = (api) => api.services.ConnectionService;\n');
  writePackage(root, 'other', 'export const use = (api) => api.services.ChannelService;\n');
  writePackage(root, 'mocked', 'export const use = Layer.succeed(api.services.ConnectionService);\n');
  mkdirSync(join(root, 'packages', 'consumer', 'test', 'playwright', 'specs'), { recursive: true });
  writeFileSync(
    join(root, 'packages', 'consumer', 'test', 'playwright', 'specs', 'open.spec.ts'),
    "test('opens', () => {});\n"
  );
  mkdirSync(join(root, '.github', 'workflows'), { recursive: true });
  writeFileSync(
    join(root, '.github', 'workflows', 'consumerE2E.yml'),
    'name: Consumer E2E (Playwright)\njobs:\n  e2e-desktop:\n    steps:\n      - run: npm run test:desktop -w consumer\n'
  );
  const workflows = parseWorkflowText(
    readFileSync(join(root, '.github', 'workflows', 'consumerE2E.yml'), 'utf8')
  );
  const records = await dependentsFor(
    root,
    ['packages/salesforcedx-vscode-services/src/core/connectionService.ts'],
    '',
    Option.isSome(workflows) ? [workflows.value] : []
  ).pipe(Effect.provide(NodeContext.layer), Effect.runPromise);
  assert.deepEqual(
    records.map(record => record.package),
    ['consumer']
  );
  assert.equal(records[0]?.workflow, 'Consumer E2E (Playwright)');
  assert.deepEqual(records[0]?.jobs, ['e2e-desktop']);
  assert.deepEqual(records[0]?.specs, ['packages/consumer/test/playwright/specs/open.spec.ts']);
  assert.equal(records[0]?.excerpt?.includes('opens'), true);
  assert.equal(records[0]?.excerpt?.includes('export const use'), false);

  writePackage(root, 'bound', 'export const use = (servicesApi) => servicesApi.services.ConnectionService;\n');
  const bound = await dependentsFor(
    root,
    ['packages/salesforcedx-vscode-services/src/core/connectionService.ts'],
    '',
    Option.isSome(workflows) ? [workflows.value] : []
  ).pipe(Effect.provide(NodeContext.layer), Effect.runPromise);
  assert.equal(bound.some(record => record.package === 'bound'), true);

  const setup = Array.from({ length: 40 }, () => `// ${'x'.repeat(60)}`).join('\n');
  writeFileSync(
    join(root, 'packages', 'consumer', 'test', 'playwright', 'specs', 'open.spec.ts'),
    `${setup}\ntest('opens', () => {});\nawait expect(row).toBeVisible();\n`
  );
  writeFileSync(
    join(root, 'packages', 'consumer', 'test', 'playwright', 'specs', 'rename.spec.ts'),
    "await expect(other).toContainText('renamed');\n"
  );
  mkdirSync(join(root, 'packages', 'consumer', 'test', 'browser'), { recursive: true });
  writeFileSync(
    join(root, 'packages', 'consumer', 'test', 'browser', 'limit.spec.ts'),
    "await expect(limit).toHaveAttribute('aria-label', 'rows');\n"
  );
  const asserted = await dependentsFor(
    root,
    ['packages/salesforcedx-vscode-services/src/core/connectionService.ts'],
    '',
    Option.isSome(workflows) ? [workflows.value] : []
  ).pipe(Effect.provide(NodeContext.layer), Effect.runPromise);
  const excerpt = asserted.find(record => record.package === 'consumer')?.excerpt ?? '';
  assert.equal(excerpt.includes('toBeVisible'), true);
  assert.equal(excerpt.includes("toContainText('renamed')"), true);
  assert.deepEqual(asserted.find(record => record.package === 'consumer')?.specs, [
    'packages/consumer/test/browser/limit.spec.ts',
    'packages/consumer/test/playwright/specs/open.spec.ts',
    'packages/consumer/test/playwright/specs/rename.spec.ts'
  ]);

  writePackage(root, 'layered', "setAllServicesLayer(buildAllServicesLayer(context, 'Layered'));\n");
  const shared = await dependentsFor(
    root,
    ['packages/salesforcedx-vscode-services/src/index.ts'],
    [
      'diff --git a/packages/salesforcedx-vscode-services/src/index.ts b/packages/salesforcedx-vscode-services/src/index.ts',
      '--- a/packages/salesforcedx-vscode-services/src/index.ts',
      '+++ b/packages/salesforcedx-vscode-services/src/index.ts',
      '@@',
      '+const prebuiltServicesLayer = Layer.merge()'
    ].join('\n'),
    []
  ).pipe(Effect.provide(NodeContext.layer), Effect.runPromise);
  assert.deepEqual(shared.map(record => record.package).toSorted(), ['layered']);

  writePackage(root, 'salesforcedx-vscode-lightning', 'export const lightning = 1;\n', {
    '@salesforce/salesforcedx-aura-language-server': '*'
  });
  writePackage(root, 'salesforcedx-vscode-lwc', 'export const lwc = 1;\n', {
    '@salesforce/salesforcedx-lwc-language-server': '*'
  });
  mkdirSync(join(root, 'packages', 'salesforcedx-aura-language-server', 'src'), { recursive: true });
  writeFileSync(join(root, 'packages', 'salesforcedx-aura-language-server', 'src', 'server.ts'), 'export const server = 1;\n');
  writeFileSync(
    join(root, 'packages', 'salesforcedx-aura-language-server', 'package.json'),
    JSON.stringify({ name: '@salesforce/salesforcedx-aura-language-server' })
  );
  const language = await dependentsFor(
    root,
    ['packages/salesforcedx-aura-language-server/src/server.ts'],
    '',
    []
  ).pipe(Effect.provide(NodeContext.layer), Effect.runPromise);
  assert.deepEqual(
    language.map(record => record.package),
    ['salesforcedx-vscode-lightning']
  );
});

test('missing skill ref leaves the body unchanged', async () => {
  const cwd = initRepo(false);
  const state = { body: '## Summary\n\nkept\n', writes: [] as string[] };
  let prompted = false;
  const outcome = await run(cwd, () => {
    prompted = true;
    return Effect.succeed('{"kind":"nothing"}');
  }, state);
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
  assert.equal(state.writes[0]?.slice(0, '## Summary\n\nkept\n\n## Plan\n\nlink\n'.length), '## Summary\n\nkept\n\n## Plan\n\nlink\n');
  assert.equal(state.body.includes('- [ ] Open the org browser'), true);
  const second = await run(cwd, () => Effect.succeed(prompts[1] ?? ''), state);
  assert.deepEqual(second, { edited: true });
  assert.equal(state.body.slice(0, '## Summary\n\nkept\n\n## Plan\n\nlink\n'.length), '## Summary\n\nkept\n\n## Plan\n\nlink\n');
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
  assert.equal(readFileSync(join(repoRoot, 'scripts', 'manualTestPlan', 'package-lock.json'), 'utf8').includes('"lockfileVersion": 3'), true);
});
