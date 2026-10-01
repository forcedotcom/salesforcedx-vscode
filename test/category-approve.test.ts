import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { preflight } from '../scripts/category-approve-preflight.mjs';
import { buildPrompt, categoryIdsFromPolicy, parseAgentResult } from '../scripts/shared/categoryDecision.mts';
import {
  BASE_BRANCH,
  BOT_LOGIN,
  decideCategoryApprove,
  deniedFile,
  withoutOwnRun
} from '../scripts/shared/categoryGates.mts';
import { createCategoryReads, readCategoryFacts } from '../scripts/shared/categoryReads.mts';

const policy = readFileSync(new URL('../APPROVAL_POLICY.md', import.meta.url), 'utf8');
const allowed = categoryIdsFromPolicy(policy);
const file = (filename: string) => ({ filename });
const pull = {
  reviewDecision: 'REVIEW_REQUIRED',
  isDraft: false,
  state: 'open',
  baseRefName: 'develop',
  headRefOid: 'abc123',
  author: { login: 'mshanemc' },
  headRepository: { nameWithOwner: 'forcedotcom/salesforcedx-vscode' },
  baseRepository: { nameWithOwner: 'forcedotcom/salesforcedx-vscode' }
};
const green = { status: 'completed', conclusion: 'success' };

const base = {
  pull,
  teamMembershipState: 'active',
  files: [file('README.md')],
  statuses: [],
  checkRuns: [green],
  reviews: [],
  allowedCategories: allowed,
  botLogin: BOT_LOGIN
};

test('policy category ids match the headings', () => {
  assert.deepEqual(allowed, [
    'claude',
    'eslint',
    'vscode',
    'metadata-types',
    'effect-diagnostics',
    'changelog-constants',
    'plans',
    'prose',
    'tests-only',
    'dep-bump',
    'dep-move',
    'lockfile',
    'messages',
    'format-or-comments',
    'sha256',
    'dependabot',
    'services-types'
  ]);
});

test('prompt names the diff file and carries no pull request body', () => {
  const prompt = buildPrompt(policy, '/tmp/category-approve/pr.diff');
  assert.match(prompt, /\/tmp\/category-approve\/pr\.diff/);
  assert.match(prompt, /Read that file and no other file/);
  assert.equal(prompt.includes('pull request body'), false);
});

test('classifies when the gates pass', () => {
  assert.equal(decideCategoryApprove(base)._tag, 'Classify');
});

test('approves a non-empty known category union', () => {
  const decision = decideCategoryApprove({ ...base, categories: ['prose', 'tests-only'] });
  assert.equal(decision._tag, 'Approve');
  assert.match(decision.reason, /prose, tests-only/);
});

test('skips an empty union and an unknown category', () => {
  assert.equal(decideCategoryApprove({ ...base, categories: [] })._tag, 'Skip');
  assert.equal(decideCategoryApprove({ ...base, categories: ['ship-it'] })._tag, 'Skip');
});

test('skips denylist paths before classify', () => {
  assert.equal(
    deniedFile([file('packages/foo/src/a.ts'), file('.github/workflows/ci.yml')]),
    '.github/workflows/ci.yml'
  );
  assert.equal(decideCategoryApprove({ ...base, files: [file('.claude/skills/wireit/SKILL.md')] })._tag, 'Classify');
  assert.equal(decideCategoryApprove({ ...base, files: [file('.claude/plans/W-1.md')] })._tag, 'Classify');
  assert.equal(
    decideCategoryApprove({ ...base, files: [file('.claude/workflows/auto-build-wi.js')] })._tag,
    'Classify'
  );
  assert.equal(decideCategoryApprove({ ...base, files: [file('.claude/settings.json')] })._tag, 'Classify');
  assert.equal(decideCategoryApprove({ ...base, files: [file('eslint.config.mjs')] })._tag, 'Classify');
  assert.equal(
    decideCategoryApprove({ ...base, files: [file('packages/eslint-local-rules/src/index.ts')] })._tag,
    'Classify'
  );
  assert.equal(decideCategoryApprove({ ...base, files: [file('.vscode/cspell.json')] })._tag, 'Classify');
  assert.equal(
    decideCategoryApprove({
      ...base,
      files: [file('packages/salesforcedx-vscode-core/metadata_types_map_scraped.json')]
    })._tag,
    'Classify'
  );
  assert.equal(decideCategoryApprove({ ...base, files: [file('APPROVAL_POLICY.md')] })._tag, 'Skip');
  assert.equal(decideCategoryApprove({ ...base, files: [file('.cursor/rules/wireit.mdc')] })._tag, 'Skip');
});

test('skips forks, drafts, dependabot, changes requested, and a quiet rollup', () => {
  assert.equal(
    decideCategoryApprove({
      ...base,
      pull: { ...pull, headRepository: { nameWithOwner: 'other/salesforcedx-vscode' } }
    })._tag,
    'Skip'
  );
  assert.equal(decideCategoryApprove({ ...base, pull: { ...pull, isDraft: true } })._tag, 'Skip');
  assert.equal(
    decideCategoryApprove({ ...base, pull: { ...pull, author: { login: 'dependabot[bot]' } } })._tag,
    'Skip'
  );
  assert.equal(decideCategoryApprove({ ...base, pull: { ...pull, reviewDecision: 'CHANGES_REQUESTED' } })._tag, 'Skip');
  assert.equal(decideCategoryApprove({ ...base, checkRuns: [] })._tag, 'Skip');
  assert.equal(
    decideCategoryApprove({ ...base, checkRuns: [{ status: 'in_progress', conclusion: null }] })._tag,
    'Skip'
  );
});

test('dismisses a bot approval on this sha when a check failed', () => {
  const reviews = [{ user: { login: 'svc-idee-bot' }, state: 'APPROVED', commit_id: 'abc123' }];
  const decision = decideCategoryApprove({
    ...base,
    reviews,
    checkRuns: [{ status: 'completed', conclusion: 'failure' }]
  });
  assert.equal(decision._tag, 'Dismiss');
});

test('drops this workflow run from the rollup', () => {
  const runs = [
    { details_url: 'https://github.com/acme/repo/actions/runs/9/job/1', html_url: null },
    { details_url: 'https://github.com/acme/repo/actions/runs/4/job/2', html_url: null }
  ];
  assert.equal(withoutOwnRun(runs, '9').length, 1);
});

test('parses categories from the agent json envelope', () => {
  const stdout = JSON.stringify({ result: 'looks fine\n{"categories":["prose","lockfile"]}\n' });
  assert.deepEqual(parseAgentResult(stdout), ['prose', 'lockfile']);
  assert.equal(parseAgentResult('not json'), undefined);
});

test('preflight uses the same gates before installing dependencies', async t => {
  const event = { action: 'submitted', pull_request: { number: 8314 } };
  const scenarios = [
    { name: 'denylisted file', files: [{ filename: '.github/workflows/apexLspE2E.yml' }], expected: false },
    { name: 'unsettled check', runs: [{ status: 'in_progress', conclusion: null }], expected: false },
    {
      name: 'bot approval on head',
      reviews: [{ user: { login: BOT_LOGIN }, state: 'APPROVED', commit_id: 'abc123' }],
      expected: false
    },
    {
      name: 'own running check is ignored',
      runs: [
        green,
        {
          status: 'in_progress',
          conclusion: null,
          details_url: 'https://github.com/forcedotcom/salesforcedx-vscode/actions/runs/9/job/1'
        }
      ],
      expected: true
    },
    { name: 'classification', expected: true },
    {
      name: 'dismissal',
      reviews: [{ user: { login: BOT_LOGIN }, state: 'APPROVED', commit_id: 'abc123' }],
      runs: [{ status: 'completed', conclusion: 'failure' }],
      expected: true
    }
  ];
  for (const scenario of scenarios) {
    await t.test(scenario.name, async t => {
      const requests: string[] = [];
      t.mock.method(globalThis, 'fetch', async (url: string) => {
        const path = new URL(url).pathname;
        requests.push(path);
        if (path === '/graphql') return Response.json({ data: { repository: { pullRequest: pull } } });
        if (path.endsWith('/files')) return Response.json(scenario.files ?? [{ filename: 'README.md' }]);
        if (path.endsWith('/reviews')) return Response.json(scenario.reviews ?? []);
        if (path.endsWith('/status')) return Response.json({ statuses: [] });
        if (path.endsWith('/check-runs')) return Response.json({ check_runs: scenario.runs ?? [green] });
        if (path.endsWith('/memberships/mshanemc')) return Response.json({ state: 'active' });
        throw new Error(`unexpected request: ${url}`);
      });
      assert.equal(await preflight(event, 'forcedotcom', 'salesforcedx-vscode', 'token', '9'), scenario.expected);
      assert.ok(requests.includes('/repos/forcedotcom/salesforcedx-vscode/pulls/8314/files'));
    });
  }
});

test('preflight handles check runs without listed pull requests', async t => {
  const event = { check_run: { head_sha: 'abc123', pull_requests: [] } };
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    const path = new URL(url).pathname;
    if (path.endsWith('/commits/abc123/pulls')) {
      return Response.json([{ number: 8314, base: { ref: BASE_BRANCH }, state: 'open' }]);
    }
    if (path === '/graphql') return Response.json({ data: { repository: { pullRequest: pull } } });
    if (path.endsWith('/files')) return Response.json([{ filename: '.github/workflows/apexLspE2E.yml' }]);
    if (path.endsWith('/reviews')) return Response.json([]);
    if (path.endsWith('/status')) return Response.json({ statuses: [] });
    if (path.endsWith('/check-runs')) return Response.json({ check_runs: [green] });
    if (path.endsWith('/memberships/mshanemc')) return Response.json({ state: 'active' });
    throw new Error(`unexpected request: ${url}`);
  });
  assert.equal(await preflight(event, 'forcedotcom', 'salesforcedx-vscode', 'token', '9'), false);
});

test('preflight checks all pages of changed files for denylisted paths', async t => {
  const requests: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    const parsed = new URL(url);
    const path = parsed.pathname;
    requests.push(path);
    if (path === '/graphql') return Response.json({ data: { repository: { pullRequest: pull } } });
    if (path.endsWith('/files') && parsed.searchParams.has('page')) {
      return Response.json([{ filename: '.github/workflows/apexLspE2E.yml' }]);
    }
    if (path.endsWith('/files')) {
      return Response.json([{ filename: 'README.md' }], {
        headers: { Link: `<https://api.github.com${path}?per_page=100&page=2>; rel="next"` }
      });
    }
    if (path.endsWith('/reviews')) return Response.json([]);
    if (path.endsWith('/status') || path.endsWith('/check-runs') || path.endsWith('/memberships/mshanemc')) {
      return Response.json({ message: 'unavailable' }, { status: 503 });
    }
    throw new Error(`unexpected request: ${url}`);
  });
  assert.equal(
    await preflight(
      { action: 'opened', pull_request: { number: 8314 } },
      'forcedotcom',
      'salesforcedx-vscode',
      'token',
      '9'
    ),
    false
  );
  assert.deepEqual(requests, [
    '/graphql',
    '/repos/forcedotcom/salesforcedx-vscode/pulls/8314/files',
    '/repos/forcedotcom/salesforcedx-vscode/pulls/8314/files'
  ]);
});

test('preflight skips a pull request with no head sha before querying checks', async t => {
  const requests: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    const path = new URL(url).pathname;
    requests.push(path);
    if (path === '/graphql') {
      return Response.json({ data: { repository: { pullRequest: { ...pull, headRefOid: '' } } } });
    }
    throw new Error(`unexpected request: ${url}`);
  });
  assert.equal(
    await preflight(
      { action: 'opened', pull_request: { number: 8314 } },
      'forcedotcom',
      'salesforcedx-vscode',
      'token',
      '9'
    ),
    false
  );
  assert.deepEqual(requests, ['/graphql']);
});

test('early preflight skips do not claim unread facts', async t => {
  const scenarios = [
    { name: 'draft', pull: { ...pull, isDraft: true }, files: [{ filename: 'README.md' }], membership: 'active' },
    { name: 'denylisted file', pull, files: [{ filename: '.github/workflows/ci.yml' }], membership: 'active' },
    { name: 'inactive member', pull, files: [{ filename: 'README.md' }], membership: 'none' }
  ];
  for (const scenario of scenarios) {
    await t.test(scenario.name, async t => {
      const requests: string[] = [];
      t.mock.method(globalThis, 'fetch', async (url: string) => {
        const path = new URL(url).pathname;
        requests.push(path);
        if (path === '/graphql') return Response.json({ data: { repository: { pullRequest: scenario.pull } } });
        if (path.endsWith('/files')) return Response.json(scenario.files);
        if (path.endsWith('/memberships/mshanemc')) return Response.json({ state: scenario.membership });
        throw new Error(`unexpected request: ${url}`);
      });
      const result = await readCategoryFacts(
        createCategoryReads('token'),
        'forcedotcom',
        'salesforcedx-vscode',
        8314,
        '9'
      );
      assert.equal(result.decision._tag, 'Skip');
      assert.equal(result.facts, undefined);
      assert.equal(
        requests.some(path => path.endsWith('/reviews') || path.endsWith('/status')),
        false
      );
    });
  }
});

test('surviving preflight returns facts after all reads', async t => {
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    const path = new URL(url).pathname;
    if (path === '/graphql') return Response.json({ data: { repository: { pullRequest: pull } } });
    if (path.endsWith('/files')) return Response.json([{ filename: 'README.md' }]);
    if (path.endsWith('/memberships/mshanemc')) return Response.json({ state: 'active' });
    if (path.endsWith('/reviews')) return Response.json([]);
    if (path.endsWith('/status')) return Response.json({ statuses: [] });
    if (path.endsWith('/check-runs')) return Response.json({ check_runs: [green] });
    throw new Error(`unexpected request: ${url}`);
  });
  const result = await readCategoryFacts(createCategoryReads('token'), 'forcedotcom', 'salesforcedx-vscode', 8314, '9');
  assert.equal(result.decision._tag, 'Classify');
  assert.equal(result.facts?.teamMembershipState, 'active');
  assert.deepEqual(
    result.facts?.files.map(item => item.filename),
    ['README.md']
  );
  assert.deepEqual(result.facts?.checkRuns, [green]);
});

test('malformed GraphQL responses fail instead of skipping', async t => {
  const event = { action: 'opened', pull_request: { number: 8314 } };
  t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  await assert.rejects(
    preflight(event, 'forcedotcom', 'salesforcedx-vscode', 'token', '9'),
    /invalid GraphQL pull request response/
  );
});

test('a valid null GraphQL pull request skips', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ data: { repository: { pullRequest: null } } }));
  assert.equal(
    await preflight(
      { action: 'opened', pull_request: { number: 8314 } },
      'forcedotcom',
      'salesforcedx-vscode',
      'token',
      '9'
    ),
    false
  );
});

test('preflight retries a GitHub rate limit response', async t => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    assert.equal(new URL(url).pathname, '/graphql');
    requests++;
    return requests === 1
      ? Response.json({ message: 'rate limited' }, { status: 429, headers: { 'retry-after': '0' } })
      : Response.json({ data: { repository: { pullRequest: { ...pull, isDraft: true } } } });
  });
  assert.equal(
    await preflight(
      { action: 'opened', pull_request: { number: 8314 } },
      'forcedotcom',
      'salesforcedx-vscode',
      'token',
      '9'
    ),
    false
  );
  assert.equal(requests, 2);
});

test('workflow excludes bot approval and gates installation on preflight', () => {
  const workflow = parse(readFileSync(new URL('../.github/workflows/categoryApprove.yml', import.meta.url), 'utf8'));
  const job = workflow.jobs['category-approve'];
  assert.match(job.if, /github\.event\.review\.user\.login != 'svc-idee-bot'/);
  const steps = job.steps;
  assert.equal(steps[0].with.ref, '${{ github.workflow_sha }}');
  assert.ok(steps.find(step => step.id === 'preflight'));
  const prCheckout = steps[3];
  assert.equal(prCheckout.with.ref, '${{ github.event.check_run.head_sha || github.event.pull_request.head.sha }}');
  assert.equal(prCheckout.with.path, 'pr');
  assert.ok(steps.slice(3).every(step => step.if === "steps.preflight.outputs.run == 'true'"));
  assert.equal(steps.at(-1)['working-directory'], 'pr');
  assert.equal(steps.at(-1).run, 'node ../scripts/categoryApprove.mts');
  assert.ok(steps.indexOf(prCheckout) < steps.findIndex(step => step.name === 'Decide and approve'));
});
