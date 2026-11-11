/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as NodeContext from '@effect/platform-node/NodeContext';
import { GitHub } from '@salesforce/effect-octokit';
import { ConfigProvider, Effect, Option, Schema } from 'effect';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mock, test } from 'node:test';
import { parse } from 'yaml';
import { validateWorkflow } from '../../../shared/validateWorkflow.mts';
import { renderManualTestPlan } from '../../manualTestPlan.mts';
import {
  downloadArtifact,
  readPullResolution,
  resolveVideoPulls,
  updateManualTestPlanVideos
} from '../../manualTestPlanVideos.mts';
import {
  appendVideoSection,
  readVideoManifest,
  removeVideoSection,
  renderVideoManifest,
  videoSection,
  videosEnd,
  videosStart
} from '../../videoManifest.mts';
import { jobArtifact, latestTargetRun, targetLanes, Workflow } from '../../videoTargets.mts';

const repository = 'forcedotcom/salesforcedx-vscode';
const target = {
  spec: 'packages/salesforcedx-vscode-apex-log/test/playwright/specs/executeAnonymous.headless.spec.ts',
  workflow: 'Apex Log E2E (Playwright)',
  job: 'e2e-web'
};
const testingTarget = {
  spec: 'packages/salesforcedx-vscode-apex-testing/test/playwright/specs/runApexTestsCommandPalette.headless.spec.ts',
  workflow: 'Apex Testing E2E (Playwright)',
  job: 'e2e-web'
};
const checklist = 'Human summary\n\n- [x] Keep manual checklist\n';
const plan = renderManualTestPlan(
  {
    kind: 'checklist',
    items: [
      { ...target, kind: 'watch-video' },
      { ...testingTarget, kind: 'watch-video' }
    ]
  },
  'head'
);
const initialBody = `${checklist}${plan}\n`;
const run = (id: number, name = target.workflow, path = 'apexLogE2E.yml') => ({
  id,
  name,
  path: `.github/workflows/${path}`,
  head_sha: 'head',
  status: 'completed',
  conclusion: 'success',
  run_attempt: 1
});
const job = (id: number, name: string) => ({
  id,
  name,
  conclusion: 'success',
  started_at: '2026-11-01T00:00:00Z',
  completed_at: '2026-11-01T01:00:00Z'
});
const artifact = (id: number, name: string) => ({
  id,
  name,
  expired: false,
  created_at: '2026-11-01T00:59:00Z',
  workflow_run: { head_sha: 'head' }
});

const fixture = () => ({
  body: initialBody,
  state: 'OPEN',
  sha: 'head',
  nextSha: 'head',
  readCount: 0,
  external: 'success',
  status: 'success',
  runs: [run(10), run(20, testingTarget.workflow, 'apexTestingE2E.yml')],
  artifacts: [
    artifact(1, 'playwright-report-apex-log-web'),
    artifact(2, 'playwright-test-results-apex-log-web'),
    ...['org-wide', 'class-scoped', 'ride-along'].flatMap((lane, i) => [
      artifact(i * 2 + 3, `playwright-report-apex-testing-web-${lane}`),
      artifact(i * 2 + 4, `playwright-test-results-apex-testing-web-${lane}`)
    ])
  ],
  jobs: [
    job(1, 'e2e-web'),
    ...['org-wide', 'class-scoped', 'ride-along'].map((lane, i) => job(i + 2, `e2e-web (${lane})`))
  ],
  writes: new Array<string>(),
  downloads: new Array<number>(),
  publishes: new Array<string>(),
  urls: new Array<string>()
});

const withGitHub = async <A, E>(state: ReturnType<typeof fixture>, program: Effect.Effect<A, E, GitHub>) => {
  const fetchMock = mock.method(globalThis, 'fetch', (request: string | URL | Request, options?: RequestInit) => {
    const url = new URL(typeof request === 'string' ? request : request instanceof URL ? request.href : request.url);
    state.urls.push(url.href);
    const path = url.pathname;
    const data = (() => {
      if (path === '/graphql') {
        state.readCount += 1;
        return {
          data: {
            repository: {
              pullRequest: {
                reviewDecision: null,
                isDraft: false,
                state: state.state,
                body: state.body,
                baseRefName: 'develop',
                headRefOid: state.readCount > 1 ? state.nextSha : state.sha,
                author: { login: 'test-user' },
                headRepository: { nameWithOwner: repository },
                baseRepository: { nameWithOwner: repository }
              }
            }
          }
        };
      }
      if (path.endsWith('/pulls/8497') && options?.method === 'PATCH') {
        const changed = Schema.decodeUnknownSync(Schema.parseJson(Schema.Struct({ body: Schema.String })))(
          options.body
        );
        state.body = changed.body;
        state.writes.push(changed.body);
        return {};
      }
      if (path.endsWith('/commits/head/pulls') || path.endsWith('/commits/old/pulls')) return [{ number: 8497 }];
      if (path.endsWith('/status')) return { statuses: [{ id: 1, context: 'external-status', state: state.status }] };
      if (path.endsWith('/check-runs'))
        return {
          total_count: 1,
          check_runs: [
            {
              id: 1,
              name: 'external',
              app: { id: 2, slug: 'external' },
              status: state.external === 'pending' ? 'queued' : 'completed',
              conclusion: state.external
            }
          ]
        };
      if (path.endsWith('/actions/runs')) {
        assert.equal(url.searchParams.get('head_sha'), 'head');
        return { total_count: state.runs.length, workflow_runs: state.runs };
      }
      if (path.endsWith('/artifacts')) return { total_count: state.artifacts.length, artifacts: state.artifacts };
      if (path.endsWith('/jobs')) return { total_count: state.jobs.length, jobs: state.jobs };
      assert.fail(`Unexpected request: ${url.href}`);
    })();
    const response = new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
    Object.defineProperty(response, 'url', { value: url.href });
    return Promise.resolve(response);
  });
  try {
    return await program.pipe(
      Effect.provide(GitHub.Default),
      Effect.withConfigProvider(
        ConfigProvider.fromMap(
          new Map([
            ['GITHUB_REPOSITORY', repository],
            ['IDEE_GH_TOKEN', 'test-token']
          ])
        )
      ),
      Effect.runPromise
    );
  } finally {
    fetchMock.mock.restore();
  }
};

test('streams artifact bytes to disk through the local Octokit client', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'manual-test-plan-artifact-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, '7.zip');
  const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const fetchMock = mock.method(globalThis, 'fetch', (request: string | URL | Request) => {
    const url = new URL(typeof request === 'string' ? request : request instanceof URL ? request.href : request.url);
    assert.match(url.pathname, /\/repos\/forcedotcom\/salesforcedx-vscode\/actions\/artifacts\/7\/zip$/);
    const response = new Response(bytes, { headers: { 'content-type': 'application/zip' } });
    Object.defineProperty(response, 'url', { value: url.href });
    return Promise.resolve(response);
  });
  try {
    await downloadArtifact(repository, 7, path).pipe(
      Effect.provide(GitHub.Default),
      Effect.withConfigProvider(ConfigProvider.fromMap(new Map([['IDEE_GH_TOKEN', 'test-token']]))),
      Effect.runPromise
    );
    assert.deepEqual(readFileSync(path), bytes);
  } finally {
    fetchMock.mock.restore();
  }
});

const update = (state: ReturnType<typeof fixture>, clear = false, duringCollect?: () => void) =>
  withGitHub(
    state,
    updateManualTestPlanVideos(
      { pr: 8497, sha: 'head', clear },
      {
        collect: input =>
          Effect.sync(() => {
            duringCollect?.();
            state.downloads.push(...input.pairs.map(pair => pair.results));
            return [
              { path: `${input.dir}/${input.pairs[0].results}.webm`, title: 'test', project: 'chromium', retry: 1 }
            ];
          }),
        publish: input =>
          Effect.sync(() => {
            state.publishes.push(input.body);
            // Model the documented gh transformation of standalone video image references to bare URLs.
            state.body = input.body.replaceAll(
              /!\[\]\([^)]+\.webm\)/g,
              'https://github.com/user-attachments/assets/video'
            );
          })
      }
    ).pipe(Effect.scoped, Effect.provide(NodeContext.layer))
  );

test('completion gate rereads all workflows, external checks and commit statuses', async () => {
  for (const outcome of ['queued', 'in_progress', 'failure', 'cancelled']) {
    const state = fixture();
    state.runs[1] = {
      ...state.runs[1],
      status: outcome === 'queued' || outcome === 'in_progress' ? outcome : 'completed',
      conclusion: outcome
    };
    await update(state);
    assert.equal(state.publishes.length, 0);
    assert.equal(state.downloads.length, 0);
    assert.equal(state.body, initialBody);
  }
  for (const key of ['external', 'status'] as const) {
    const state = fixture();
    state[key] = 'pending';
    await update(state);
    assert.equal(state.publishes.length, 0);
  }
});

test('one all-green batch contains both #8497 targets and successful matrix lane labels', async () => {
  const state = fixture();
  await update(state);
  assert.equal(state.publishes.length, 1, JSON.stringify(state));
  assert.equal(state.downloads.length, 4);
  assert.ok(state.body.startsWith(initialBody));
  assert.match(state.body, /executeAnonymous\.headless\.spec\.ts/);
  assert.match(state.body, /runApexTestsCommandPalette\.headless\.spec\.ts/);
  for (const lane of ['org-wide', 'class-scoped', 'ride-along']) assert.ok(state.body.includes(`e2e-web (${lane})`));
  assert.ok(state.body.endsWith(videosEnd));
});

test('pending then out-of-order green completions publish once, reruns replace without duplicates', async () => {
  const state = fixture();
  state.status = 'pending';
  await update(state);
  state.status = 'success';
  await update(state);
  await update(state);
  assert.equal(state.publishes.length, 1);
  state.runs[1] = { ...state.runs[1], run_attempt: 2 };
  await update(state);
  assert.equal(state.publishes.length, 2);
  assert.equal(state.body.split(videosStart).length, 2);
  assert.equal(removeVideoSection(state.body), initialBody);
});

test('partial gh uploads are retried rather than accepting the published fingerprint', async () => {
  for (const path of ['/tmp/videos/test.webm', 'C:/Temp/videos/test.webm', 'C:\\Temp\\videos\\test.webm']) {
    const state = fixture();
    await update(state);
    // Unrewritten local reference left by an unsuccessful upload, independent of the test host OS.
    state.body = state.publishes[0].replaceAll(/!\[\]\([^)]+\.webm\)/g, `![](${path})`);
    await update(state);
    assert.equal(state.publishes.length, 2, path);
    assert.equal(state.body.split(videosStart).length, 2);
  }
});

test('updater excludes itself, but rereads CI and latest body after collecting videos', async () => {
  const self = fixture();
  self.runs.push({
    ...run(30, 'Manual Test Plan Videos', 'manual-test-plan-videos.yml'),
    status: 'in_progress',
    conclusion: 'pending'
  });
  await update(self);
  assert.equal(self.publishes.length, 1);

  const pending = fixture();
  await update(pending, false, () => {
    pending.status = 'pending';
  });
  assert.equal(pending.publishes.length, 0);

  const edited = fixture();
  await update(edited, false, () => {
    edited.body = `${initialBody}\nHuman footer added while downloading\n`;
  });
  assert.equal(removeVideoSection(edited.body), `${initialBody}\nHuman footer added while downloading\n`);

  const changedPlan = fixture();
  await update(changedPlan, false, () => {
    changedPlan.body = initialBody.replace('"sha":"head"', '"sha":"different"');
  });
  assert.equal(changedPlan.publishes.length, 0);
});

test('job reruns pass every correctly paired artifact attempt to metadata resolution', async () => {
  const state = fixture();
  state.jobs[0] = { ...state.jobs[0], conclusion: 'failure' };
  state.jobs.push({ ...job(10, 'e2e-web'), started_at: '2026-11-01T02:00:00Z', completed_at: '2026-11-01T03:00:00Z' });
  state.artifacts.push(
    { ...artifact(30, 'playwright-report-apex-log-web'), created_at: '2026-11-01T02:59:00Z' },
    { ...artifact(31, 'playwright-test-results-apex-log-web'), created_at: '2026-11-01T02:59:00Z' }
  );
  await update(state);
  assert.deepEqual(state.downloads.slice(0, 2), [2, 31]);
  assert.equal(state.publishes.length, 1);
});

test('only matching successful matrix lanes are attached; a missing lane preserves checklist', async () => {
  const state = fixture();
  state.jobs[2] = { ...state.jobs[2], conclusion: 'skipped' };
  state.artifacts = state.artifacts.filter(value => !value.name.endsWith('ride-along'));
  await update(state);
  assert.equal(state.publishes.length, 1);
  assert.equal(removeVideoSection(state.body), initialBody);
  const section = videoSection(state.body) ?? '';
  assert.ok(section.includes('e2e-web (org-wide)'));
  assert.equal(section.includes('e2e-web (class-scoped)'), false);
  assert.equal(section.includes('e2e-web (ride-along)'), false);
});

test('closed, stale heads and heads changing during downloads never write', async () => {
  for (const change of [{ state: 'CLOSED' }, { sha: 'old' }, { nextSha: 'new' }]) {
    const state = { ...fixture(), ...change };
    await update(state);
    assert.equal(state.publishes.length, 0);
    assert.equal(state.writes.length, 0);
  }
});

test('missing, invalid and stale video manifests skip downloads and publication', async () => {
  for (const body of [
    checklist,
    `${checklist}<!-- manual-test-plan-video-targets {invalid} -->`,
    initialBody.replace('"sha":"head"', '"sha":"old"')
  ]) {
    const state = { ...fixture(), body };
    await update(state);
    assert.equal(state.body, body);
    assert.deepEqual(state.downloads, []);
    assert.deepEqual(state.publishes, []);
    assert.deepEqual(state.writes, []);
  }
});

test('missing and expired artifacts preserve the plan, and absent videos do not write', async () => {
  for (const expired of [false, true]) {
    const state = fixture();
    state.artifacts = expired ? state.artifacts.map(value => ({ ...value, expired })) : [];
    await update(state);
    assert.equal(state.body, initialBody);
    assert.equal(state.publishes.length, 0);
  }
  const absent = fixture();
  await withGitHub(
    absent,
    updateManualTestPlanVideos(
      { pr: 8497, sha: 'head', clear: false },
      {
        collect: () => Effect.succeed([]),
        publish: () => Effect.dieMessage('Must not publish')
      }
    ).pipe(Effect.scoped, Effect.provide(NodeContext.layer))
  );
  assert.equal(absent.body, initialBody);
});

test('synchronize removes stale video block only, leaves current-SHA videos alone', async () => {
  const state = fixture();
  state.body = `${appendVideoSection(initialBody, `${videosStart}\n{"sha":"old"}\nold video\n${videosEnd}`)}\nHuman footer`;
  await update(state, true);
  assert.equal(state.body, `${initialBody}\nHuman footer`);
  state.body = appendVideoSection(initialBody, `${videosStart}\n{"sha":"head"}\ncurrent video\n${videosEnd}`);
  await update(state, true);
  assert.equal(state.writes.length, 1);
});

test('completion associations resolve through commit, excluding stale and closed PRs', async () => {
  assert.deepEqual(await withGitHub(fixture(), resolveVideoPulls({ sha: 'head', clear: false })), [
    { pr: 8497, sha: 'head', clear: false }
  ]);
  assert.deepEqual(await withGitHub(fixture(), resolveVideoPulls({ sha: 'old', clear: false })), []);
  const closed = fixture();
  closed.state = 'CLOSED';
  assert.deepEqual(await withGitHub(closed, resolveVideoPulls({ sha: 'head', clear: false })), []);
  assert.deepEqual(await withGitHub(fixture(), resolveVideoPulls({ pullNumber: 8497, clear: false })), [
    { pr: 8497, sha: 'head', clear: false }
  ]);
});

test('event resolution delegates payload decoding and keeps event-specific behavior', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'manual-test-plan-event-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const eventPath = join(directory, 'event.json');
  const resolve = (name: string) =>
    readPullResolution(name, eventPath).pipe(Effect.provide(NodeContext.layer), Effect.runPromise);
  writeFileSync(eventPath, JSON.stringify({ inputs: { pull_number: '8497' } }));
  assert.deepEqual(await resolve('workflow_dispatch'), { pullNumber: 8497, clear: false });
  writeFileSync(eventPath, JSON.stringify({ action: 'synchronize', pull_request: { number: 8497 } }));
  assert.deepEqual(await resolve('pull_request_target'), { pullNumber: 8497, clear: true });
  writeFileSync(eventPath, JSON.stringify({ check_suite: { head_sha: 'head', pull_requests: [] } }));
  assert.deepEqual(await resolve('check_suite'), { sha: 'head', clear: false });
  writeFileSync(eventPath, JSON.stringify({ workflow_run: { head_sha: 'head', pull_requests: [] } }));
  assert.deepEqual(await resolve('workflow_run'), { sha: 'head', clear: false });
});

test('artifact and workflow selection use exact SHA and successful job upload timestamps', () => {
  assert.equal(latestTargetRun([run(1), { ...run(2), head_sha: 'old' }], 'head', target.workflow)?.id, 1);
  const eligible = artifact(1, 'results');
  const older = { ...eligible, id: 99, created_at: '2026-10-01T00:00:00Z' };
  assert.equal(jobArtifact([older, eligible], 'results', 'head', job(1, 'web'))?.id, 1);
  assert.equal(
    jobArtifact([{ ...eligible, workflow_run: { head_sha: 'old' } }], 'results', 'head', job(1, 'web')),
    undefined
  );
});

test('trusted workflow matrix resolves exact artifact names', () => {
  const workflow = Schema.decodeUnknownSync(Workflow)(
    parse(readFileSync('.github/workflows/apexTestingE2E.yml', 'utf8'))
  );
  assert.deepEqual(
    targetLanes(workflow, testingTarget).map(lane => lane.results),
    ['org-wide', 'class-scoped', 'ride-along'].map(lane => `playwright-test-results-apex-testing-web-${lane}`)
  );
  assert.equal(targetLanes(workflow, { ...testingTarget, spec: target.spec }).length, 0);
});

test('manifest lookup returns one Option shape for missing and invalid manifests', () => {
  for (const body of [
    checklist,
    '<!-- manual-test-plan-video-targets {"sha":"head","targets":[]}',
    '<!-- manual-test-plan-video-targets {invalid} -->',
    '<!-- manual-test-plan-video-targets {"sha":"head","targets":[{}]} -->'
  ]) {
    assert.deepEqual(readVideoManifest(body), Option.none());
  }
  const manifest = { sha: 'head', targets: [target] };
  assert.deepEqual(readVideoManifest(renderVideoManifest(manifest)), Option.some(manifest));
});

test('manifest escapes HTML comments; updater triggers match approval workflows plus manual plan', () => {
  assert.ok(renderVideoManifest({ sha: 'head', targets: [{ ...target, workflow: '-->bad' }] }).includes('\\u003e'));
  const workflows = (path: string) =>
    Schema.decodeUnknownSync(
      Schema.Struct({ on: Schema.Struct({ workflow_run: Schema.Struct({ workflows: Schema.Array(Schema.String) }) }) })
    )(parse(readFileSync(path, 'utf8'))).on.workflow_run.workflows;
  assert.deepEqual(workflows('.github/workflows/manual-test-plan-videos.yml'), [
    ...workflows('.github/workflows/aiAutoApprove.yml'),
    'Manual test plan'
  ]);
  const workflow = readFileSync('.github/workflows/manual-test-plan-videos.yml', 'utf8');
  assert.match(workflow, /group: manual-test-plan-\$\{\{ matrix.pull.pr \}\}/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /queue: max/);
  assert.match(readFileSync('.github/workflows/manual-test-plan.yml', 'utf8'), /queue: max/);
  assert.equal(workflow.includes('pull_request.head'), false);
  assert.equal(workflow.includes('CURSOR_API_KEY'), false);
  assert.ok(videoSection(initialBody) === undefined);
});

const queuedWorkflow = (queue: string, cancel = 'false', extra = '') => `
name: Queue validation
on: workflow_dispatch
concurrency:
  group: shared-pr
  cancel-in-progress: ${cancel}
  queue: ${queue}
jobs:
  test:
    runs-on: ubuntu-latest
    concurrency:
      group: shared-job
      cancel-in-progress: ${cancel}
      queue: ${queue}
    ${extra}
    steps:
      - run: echo tested
`;

test('workflow schema compatibility accepts only explicit non-cancelling max queues', () => {
  assert.deepEqual(validateWorkflow(queuedWorkflow('max')).errors, []);
  assert.ok(validateWorkflow(queuedWorkflow('max', 'true')).errors.length > 0);
  assert.ok(validateWorkflow(queuedWorkflow('invalid')).errors.length > 0);
  assert.ok(validateWorkflow(queuedWorkflow('max', 'false', 'unexpected: true')).errors.length > 0);
});
