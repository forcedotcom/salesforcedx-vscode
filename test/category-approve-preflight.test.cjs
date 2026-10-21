const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { parse } = require('yaml');
const preflight = require('../scripts/category-approve-preflight.cjs');
const { BOT_LOGIN, preClassifyDecision } = require('../scripts/shared/categoryGates.cjs');

const pull = {
  reviewDecision: 'REVIEW_REQUIRED',
  isDraft: false,
  state: 'OPEN',
  baseRefName: 'develop',
  headRefOid: 'abc123',
  author: { login: 'mshanemc' },
  headRepository: { nameWithOwner: 'forcedotcom/salesforcedx-vscode' },
  baseRepository: { nameWithOwner: 'forcedotcom/salesforcedx-vscode' }
};
const context = {
  repo: { owner: 'forcedotcom', repo: 'salesforcedx-vscode' },
  runId: 9,
  payload: { action: 'submitted', pull_request: { number: 8314 } }
};
const facts = {
  pull,
  teamMembershipState: 'active',
  files: [{ filename: 'README.md' }],
  statuses: [],
  checkRuns: [],
  reviews: [],
  botLogin: BOT_LOGIN
};

const fixture = (overrides = {}) => {
  const calls = [];
  const github = {
    graphql: async () => ({ repository: { pullRequest: overrides.pull ?? pull } }),
    paginate: async route => {
      calls.push(route);
      if (route.endsWith('/files')) return overrides.files ?? [{ filename: 'README.md' }];
      if (route.endsWith('/reviews')) return overrides.reviews ?? [];
      if (route.endsWith('/check-runs')) return overrides.runs ?? [];
      if (route.endsWith('/pulls')) return overrides.pulls ?? [];
      throw new Error(`unexpected route ${route}`);
    },
    request: async route => {
      calls.push(route);
      if (route.includes('/memberships/')) {
        if (overrides.membership === 'not found') throw Object.assign(new Error('not found'), { status: 404 });
        return { data: { state: overrides.membership ?? 'active' } };
      }
      if (route.endsWith('/status')) return { data: { statuses: overrides.statuses ?? [] } };
      throw new Error(`unexpected route ${route}`);
    }
  };
  return { github, calls };
};

test('denylisted file skips before reviews and checks are fetched', async () => {
  const { github, calls } = fixture({ files: [{ filename: '.github/workflows/apexLspE2E.yml' }] });
  assert.equal(await preflight({ github, context }), false);
  assert.equal(
    calls.some(route => route.endsWith('/reviews') || route.endsWith('/check-runs')),
    false
  );
});

test('shared pre-classify policy decides from facts without GitHub calls', () => {
  const approved = { user: { login: 'svc-idee-bot' }, state: 'APPROVED', commit_id: 'abc123' };
  const cases = [
    [{ pull: undefined }, 'Skip'],
    [{ pull: { ...pull, baseRefName: 'main' } }, 'Skip'],
    [{ pull: { ...pull, state: 'CLOSED' } }, 'Skip'],
    [{ pull: { ...pull, isDraft: true } }, 'Skip'],
    [{ pull: { ...pull, reviewDecision: 'CHANGES_REQUESTED' } }, 'Skip'],
    [{ pull: { ...pull, author: { login: 'dependabot[bot]' } } }, 'Skip'],
    [{ pull: { ...pull, headRepository: { nameWithOwner: 'someone/else' } } }, 'Skip'],
    [{ teamMembershipState: 'none' }, 'Skip'],
    [{ pull: { ...pull, headRefOid: '' } }, 'Skip'],
    [{ files: [{ filename: 'packages/foo/CODEOWNERS' }] }, 'Skip'],
    [{ checkRuns: [{ conclusion: 'failure' }] }, 'Skip'],
    [{ reviews: [approved] }, 'Skip'],
    [{ reviews: [approved], checkRuns: [{ conclusion: 'failure' }] }, 'Dismiss'],
    [{ reviews: [{ ...approved, commit_id: 'old-head' }] }, 'Classify'],
    [{ checkRuns: [{ conclusion: null, status: 'in_progress' }] }, 'Classify'],
    [{}, 'Classify']
  ];
  for (const [changes, expected] of cases) {
    assert.equal(preClassifyDecision({ ...facts, ...changes })._tag, expected, JSON.stringify(changes));
  }
});

test('preflight fetches a pull and returns the shared gate decision', async () => {
  const { github } = fixture({ reviews: [{ user: { login: BOT_LOGIN }, state: 'APPROVED', commit_id: 'abc123' }] });
  assert.equal(await preflight({ github, context }), false);
});

test('a failed check after approval must run the approver to dismiss', async () => {
  const { github } = fixture({
    reviews: [{ user: { login: BOT_LOGIN }, state: 'APPROVED', commit_id: 'abc123' }],
    runs: [{ conclusion: 'failure' }]
  });
  assert.equal(await preflight({ github, context }), true);
});

test('check run with no attached pulls looks up open develop pulls', async () => {
  const { github, calls } = fixture({
    pulls: [
      { number: 8314, base: { ref: 'develop' }, state: 'open' },
      { number: 8315, base: { ref: 'main' }, state: 'open' }
    ]
  });
  assert.equal(
    await preflight({ github, context: { ...context, payload: { check_run: { head_sha: 'abc123' } } } }),
    true
  );
  assert.equal(
    calls.some(route => route.endsWith('/pulls')),
    true
  );
});

test('own check run does not start the approver', async () => {
  const { github, calls } = fixture();
  assert.equal(
    await preflight({ github, context: { ...context, payload: { check_run: { name: 'category-approve' } } } }),
    false
  );
  assert.deepEqual(calls, []);
});

test('bot approval reviews do not start the job', () => {
  const workflow = parse(readFileSync(join(__dirname, '../.github/workflows/categoryApprove.yml'), 'utf8'));
  assert.match(workflow.jobs['category-approve'].if, /github\.event\.review\.user\.login != 'svc-idee-bot'/);
});

test(
  'dependency retries install only in the trusted approver worktree and propagate failures',
  { skip: process.platform === 'win32' && 'Tests the Ubuntu-only workflow Bash command' },
  t => {
    const workflow = parse(readFileSync(join(__dirname, '../.github/workflows/categoryApprove.yml'), 'utf8'));
    const install = workflow.jobs['category-approve'].steps.find(
      step => step.name === 'Install trusted approver dependencies'
    );
    assert.equal(install.if, "steps.preflight.outputs.result == 'true'");
    assert.equal(install.with['working-directory'], '${{ runner.temp }}/trusted-approver');
    const action = parse(readFileSync(join(__dirname, '..', install.uses, 'action.yml'), 'utf8'));
    const retry = action.runs.steps[0];
    assert.equal(retry.uses, 'salesforcecli/github-workflows/.github/actions/retry@main');
    assert.equal(retry.env.PNPM_INSTALL_WORKING_DIRECTORY, '${{ inputs.working-directory }}');

    const directory = mkdtempSync(join(tmpdir(), 'trusted-approver-install-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const trusted = join(directory, 'trusted approver');
    const bin = join(directory, 'bin');
    mkdirSync(trusted);
    mkdirSync(bin);
    writeFileSync(join(bin, 'pnpm'), '#!/bin/bash\npwd -P\nprintf "%s\\n" "$@"\nexit "$INSTALL_EXIT_CODE"\n', {
      mode: 0o755
    });
    for (const status of [0, 42]) {
      const result = spawnSync('bash', ['-e', '-c', retry.with.command], {
        cwd: __dirname,
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          PNPM_INSTALL_WORKING_DIRECTORY: trusted,
          INSTALL_EXIT_CODE: String(status)
        },
        encoding: 'utf8'
      });
      assert.equal(result.status, status, result.stderr);
      assert.equal(result.stdout, `${realpathSync(trusted)}\ninstall\n--frozen-lockfile\n`);
    }
  }
);

test('workflow runs trusted approver when develop does not yet contain the preflight helper', async () => {
  const workflow = parse(readFileSync(join(__dirname, '../.github/workflows/categoryApprove.yml'), 'utf8'));
  const script = workflow.jobs['category-approve'].steps.find(step => step.id === 'preflight').with.script;
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const run = new AsyncFunction('require', 'process', 'github', 'context', script);
  const absent = moduleName => {
    if (moduleName === 'node:fs') return { existsSync: () => false };
    throw new Error(`unexpected require ${moduleName}`);
  };
  assert.equal(await run(absent, { env: { RUNNER_TEMP: '/runner' } }, {}, context), true);
});
