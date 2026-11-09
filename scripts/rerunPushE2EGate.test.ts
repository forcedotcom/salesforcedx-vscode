/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/// <reference types="vitest/globals" />
/// <reference types="node" />

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts', 'rerunPushE2EGate.mts');
const WORKFLOW = join(process.cwd(), '.github', 'workflows', 'rerunPushE2E.yml');

// Exercise the real effect-octokit reads without permitting any network request.
const FETCH_WRAPPER = `
  import { appendFileSync } from 'node:fs';
  import { pathToFileURL } from 'node:url';
  globalThis.fetch = async input => {
    const url = String(input);
    const path = new URL(url).pathname;
    appendFileSync(process.env.GH_CALL_LOG, 'GET ' + url + '\\n');
    let body;
    let status = 200;
    let headers = { 'content-type': 'application/json' };
    if (path === '/repos/forcedotcom/salesforcedx-vscode/actions/runs/99/jobs') {
      status = Number(process.env.JOBS_STATUS ?? 200);
      const pages = JSON.parse(process.env.JOBS_PAGES ?? '[[]]');
      const page = Number(new URL(url).searchParams.get('page') ?? 1);
      body = { total_count: pages.flat().length, jobs: pages[page - 1] };
      if (page < pages.length) {
        const next = new URL(url);
        next.searchParams.set('page', String(page + 1));
        headers.link = '<' + next + '>; rel="next"';
      }
    } else if (path === '/orgs/forcedotcom/teams/ide-foundations/memberships/octocat') {
      status = Number(process.env.MEMBERSHIP_STATUS ?? 200);
      body = { state: process.env.MEMBERSHIP_KIND === 'blank' ? '' : process.env.MEMBERSHIP_KIND ?? '' };
    } else {
      throw new Error('Unexpected GitHub request: ' + url);
    }
    const response = new Response(JSON.stringify(body), { status, headers });
    Object.defineProperty(response, 'url', { value: url });
    return response;
  };
  await import(pathToFileURL(process.env.SCRIPT).href);
`;

const WRAPPER = [
  'set -euo pipefail',
  'dir=$(mktemp -d)',
  'log="$dir/calls"',
  'touch "$log"',
  'cat > "$dir/gh" <<\'EOF\'',
  '#!/usr/bin/env bash',
  'printf \'%s\\n\' "$*" >> "$GH_CALL_LOG"',
  'if [[ "$*" == *"run rerun"* ]]; then',
  '  if [ "${STUB_RERUN_EXIT:-99}" != "0" ]; then',
  '    echo "stub rerun failure" >&2',
  '    exit "${STUB_RERUN_EXIT:-99}"',
  '  fi',
  '  exit 0',
  'fi',
  'echo "unexpected gh invocation" >&2',
  'exit 98',
  'EOF',
  'chmod +x "$dir/gh"',
  'export PATH="$dir:$PATH"',
  'export GH_CALL_LOG="$log"',
  'set +e',
  '"$NODE" --input-type=module --eval "$FETCH_WRAPPER"',
  'status=$?',
  'set -e',
  'if [[ -s "$log" ]]; then',
  "  printf '%s\\n' 'GH_INVOKED=yes'",
  '  sed \'s/^/GH_CALL /\' "$log"',
  'else',
  "  printf '%s\\n' 'GH_INVOKED=no'",
  'fi',
  'rm -r "$dir"',
  'exit "$status"'
].join('\n');

const baseEnv: Readonly<Record<string, string>> = {
  EVENT: 'push',
  ACTOR: 'svc-idee-bot',
  CONCLUSION: 'failure',
  RUN_ATTEMPT: '1',
  RUN_ID: '99',
  REPO: 'forcedotcom/salesforcedx-vscode'
};

const job = (row: {
  readonly id: string;
  readonly name: string;
  readonly conclusion: string;
  readonly started: string | null;
  readonly completed: string | null;
}) => ({
  id: Number(row.id),
  name: row.name,
  conclusion: row.conclusion,
  started_at: row.started,
  completed_at: row.completed
});

const timedOutJob = job({
  id: '61',
  name: 'e2e-desktop (ubuntu-latest)',
  conclusion: 'cancelled',
  started: '2026-01-01T00:00:00Z',
  completed: '2026-01-01T01:00:00Z'
});

type Decision = 'rerun' | 'skip';
type MembershipKind = 'pending' | 'active' | 'blank';

type GateCase = {
  readonly name: string;
  readonly env: Readonly<Record<string, string>>;
  readonly membership?: MembershipKind;
  readonly jobs?: readonly ReturnType<typeof job>[];
  readonly jobsPages?: readonly (readonly ReturnType<typeof job>[])[];
  readonly membershipStatus?: number;
  readonly jobsStatus?: number;
  readonly decision: Decision;
  readonly ghInvoked: boolean;
  readonly rerunArgs?: readonly string[];
  readonly expectStatus?: number;
};

const cases: readonly GateCase[] = [
  {
    name: 'push failure reruns',
    env: baseEnv,
    decision: 'rerun',
    ghInvoked: false
  },
  {
    name: 'schedule skips',
    env: { ...baseEnv, EVENT: 'schedule' },
    decision: 'skip',
    ghInvoked: false
  },
  {
    name: 'timed_out reruns',
    env: { ...baseEnv, CONCLUSION: 'timed_out' },
    decision: 'rerun',
    ghInvoked: false
  },
  {
    name: 'cancelled job at 3000s skips',
    env: { ...baseEnv, CONCLUSION: 'cancelled', WORKFLOW_NAME: 'Core E2E (Playwright)' },
    jobs: [
      job({
        id: '11',
        name: 'e2e-desktop (ubuntu-latest)',
        conclusion: 'cancelled',
        started: '2026-01-01T00:00:00Z',
        completed: '2026-01-01T00:50:00Z'
      })
    ],
    decision: 'skip',
    ghInvoked: true
  },
  {
    name: 'cancelled job at 60m reruns that job',
    env: { ...baseEnv, CONCLUSION: 'cancelled', WORKFLOW_NAME: 'Core E2E (Playwright)' },
    jobs: [
      job({
        id: '61',
        name: 'e2e-desktop (ubuntu-latest)',
        conclusion: 'cancelled',
        started: '2026-01-01T00:00:00Z',
        completed: '2026-01-01T01:00:00Z'
      })
    ],
    decision: 'rerun',
    ghInvoked: true,
    rerunArgs: ['run rerun --job 61 --repo forcedotcom/salesforcedx-vscode']
  },
  {
    name: 'LWC run-tests cancel under 90m skips',
    env: { ...baseEnv, CONCLUSION: 'cancelled', WORKFLOW_NAME: 'LWC E2E (Playwright)' },
    jobs: [
      job({
        id: '90',
        name: 'e2e-desktop-run-tests (ubuntu-latest)',
        conclusion: 'cancelled',
        started: '2026-01-01T00:00:00Z',
        completed: '2026-01-01T01:10:00Z'
      })
    ],
    decision: 'skip',
    ghInvoked: true
  },
  {
    name: 'LWC timeout cancel reruns only jobs that reached their timeout',
    env: { ...baseEnv, CONCLUSION: 'cancelled', WORKFLOW_NAME: 'LWC E2E (Playwright)' },
    jobs: [
      job({
        id: '60',
        name: 'e2e-desktop-lsp (ubuntu-latest)',
        conclusion: 'cancelled',
        started: '2026-01-01T00:00:00Z',
        completed: '2026-01-01T01:00:00Z'
      }),
      job({
        id: '70',
        name: 'e2e-desktop-run-tests (ubuntu-latest)',
        conclusion: 'cancelled',
        started: '2026-01-01T00:00:00Z',
        completed: '2026-01-01T01:10:00Z'
      }),
      job({
        id: '71',
        name: 'e2e-web (ubuntu-latest)',
        conclusion: 'success',
        started: '2026-01-01T00:00:00Z',
        completed: '2026-01-01T00:10:00Z'
      })
    ],
    decision: 'rerun',
    ghInvoked: true,
    rerunArgs: ['run rerun --job 60 --repo forcedotcom/salesforcedx-vscode']
  },
  {
    name: 'LWC run-tests cancel at 90m reruns one timed-out job',
    env: { ...baseEnv, CONCLUSION: 'cancelled', WORKFLOW_NAME: 'LWC E2E (Playwright)' },
    jobs: [
      job({
        id: '91',
        name: 'e2e-desktop-run-tests (macos-latest)',
        conclusion: 'cancelled',
        started: '2026-01-01T00:00:00Z',
        completed: '2026-01-01T01:30:00Z'
      }),
      job({
        id: '92',
        name: 'e2e-desktop-run-tests (ubuntu-latest)',
        conclusion: 'cancelled',
        started: '2026-01-01T00:00:00Z',
        completed: '2026-01-01T01:30:00Z'
      })
    ],
    decision: 'rerun',
    ghInvoked: true,
    rerunArgs: ['run rerun --job 91 --repo forcedotcom/salesforcedx-vscode']
  },
  {
    name: 'timeout cancel plus a failed job reruns one timed-out job',
    env: { ...baseEnv, CONCLUSION: 'cancelled', WORKFLOW_NAME: 'LWC E2E (Playwright)' },
    jobs: [
      job({
        id: '3',
        name: 'e2e-desktop-run-tests (windows-latest)',
        conclusion: 'failure',
        started: '2026-01-01T00:00:00Z',
        completed: '2026-01-01T00:04:00Z'
      }),
      job({
        id: '91',
        name: 'e2e-desktop-run-tests (macos-latest)',
        conclusion: 'cancelled',
        started: '2026-01-01T00:00:00Z',
        completed: '2026-01-01T01:30:00Z'
      })
    ],
    decision: 'rerun',
    ghInvoked: true,
    rerunArgs: ['run rerun --job 91 --repo forcedotcom/salesforcedx-vscode']
  },
  {
    name: 'cancelled run with only an early failure skips',
    env: { ...baseEnv, CONCLUSION: 'cancelled', WORKFLOW_NAME: 'Core E2E (Playwright)' },
    jobs: [
      job({
        id: '4',
        name: 'e2e-desktop (ubuntu-latest)',
        conclusion: 'failure',
        started: '2026-01-01T00:00:00Z',
        completed: '2026-01-01T00:04:00Z'
      })
    ],
    decision: 'skip',
    ghInvoked: true
  },
  {
    name: 'run_attempt 3 reruns',
    env: { ...baseEnv, RUN_ATTEMPT: '3' },
    decision: 'rerun',
    ghInvoked: false
  },
  {
    name: 'run_attempt 4 skips',
    env: { ...baseEnv, RUN_ATTEMPT: '4' },
    decision: 'skip',
    ghInvoked: false
  },
  {
    name: 'actor svc-idee-bot passes',
    env: baseEnv,
    decision: 'rerun',
    ghInvoked: false
  },
  {
    name: 'actor dependabot[bot] passes',
    env: { ...baseEnv, ACTOR: 'dependabot[bot]' },
    decision: 'rerun',
    ghInvoked: false
  },
  {
    name: 'pending membership skips',
    env: { ...baseEnv, ACTOR: 'octocat' },
    membership: 'pending',
    decision: 'skip',
    ghInvoked: true
  },
  {
    name: 'blank membership skips',
    env: { ...baseEnv, ACTOR: 'octocat' },
    membership: 'blank',
    decision: 'skip',
    ghInvoked: true
  },
  {
    name: 'active membership reruns',
    env: { ...baseEnv, ACTOR: 'octocat' },
    membership: 'active',
    decision: 'rerun',
    ghInvoked: true
  },
  {
    name: 'bad cancel timestamp skips',
    env: { ...baseEnv, CONCLUSION: 'cancelled', WORKFLOW_NAME: 'Core E2E (Playwright)' },
    jobs: [
      job({
        id: '12',
        name: 'e2e-desktop (ubuntu-latest)',
        conclusion: 'cancelled',
        started: '2026-01-01T00:00:00Z',
        completed: 'not-a-date'
      })
    ],
    decision: 'skip',
    ghInvoked: true
  },
  {
    name: 'failed gh run rerun fails the job',
    env: baseEnv,
    decision: 'rerun',
    ghInvoked: true,
    rerunArgs: ['run rerun 99 --failed --repo forcedotcom/salesforcedx-vscode'],
    expectStatus: 99
  },
  ...['failure', 'timed_out'].map(conclusion => ({
    name: `${conclusion} reruns failed jobs only`,
    env: { ...baseEnv, CONCLUSION: conclusion },
    decision: 'rerun' as const,
    ghInvoked: true,
    rerunArgs: ['run rerun 99 --failed --repo forcedotcom/salesforcedx-vscode']
  })),
  ...['success', 'neutral', 'skipped', ''].map(conclusion => ({
    name: `conclusion ${conclusion || '(empty)'} skips`,
    env: { ...baseEnv, CONCLUSION: conclusion },
    decision: 'skip' as const,
    ghInvoked: false
  })),
  ...['', 'bad', '-1', '1.5'].map(runAttempt => ({
    name: `run_attempt ${runAttempt || '(empty)'} skips`,
    env: { ...baseEnv, RUN_ATTEMPT: runAttempt },
    decision: 'skip' as const,
    ghInvoked: false
  })),
  ...[403, 404, 500].map(membershipStatus => ({
    name: `membership HTTP ${membershipStatus} skips`,
    env: { ...baseEnv, ACTOR: 'octocat' },
    membershipStatus,
    decision: 'skip' as const,
    ghInvoked: true
  })),
  {
    name: 'reads subsequent jobs pages before selecting a timeout',
    env: { ...baseEnv, CONCLUSION: 'cancelled' },
    jobsPages: [[{ ...timedOutJob, completed_at: '2026-01-01T00:59:59Z' }], [timedOutJob]],
    decision: 'rerun',
    ghInvoked: true,
    rerunArgs: ['run rerun --job 61 --repo forcedotcom/salesforcedx-vscode']
  },
  {
    name: 'decide-only timeout does not invoke gh rerun',
    env: { ...baseEnv, CONCLUSION: 'cancelled' },
    jobs: [timedOutJob],
    decision: 'rerun',
    ghInvoked: true
  },
  {
    name: 'empty jobs list skips',
    env: { ...baseEnv, CONCLUSION: 'cancelled' },
    decision: 'skip',
    ghInvoked: true
  },
  {
    name: 'null job timestamps skip',
    env: { ...baseEnv, CONCLUSION: 'cancelled' },
    jobs: [
      { ...timedOutJob, started_at: null },
      { ...timedOutJob, completed_at: null }
    ],
    decision: 'skip',
    ghInvoked: true
  },
  {
    name: 'jobs API failure fails without rerunning',
    env: { ...baseEnv, CONCLUSION: 'cancelled' },
    jobsStatus: 500,
    decision: 'skip',
    ghInvoked: true,
    expectStatus: 1
  },
  {
    name: 'failed timeout job rerun fails the job',
    env: { ...baseEnv, CONCLUSION: 'cancelled' },
    jobs: [timedOutJob],
    decision: 'rerun',
    ghInvoked: true,
    rerunArgs: ['run rerun --job 61 --repo forcedotcom/salesforcedx-vscode'],
    expectStatus: 99
  }
];

const runGate = (gateCase: GateCase) => {
  const result = spawnSync('bash', ['-c', WRAPPER], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR,
      NODE: process.execPath,
      SCRIPT,
      FETCH_WRAPPER,
      IDEE_GH_TOKEN: 'test-token',
      ...gateCase.env,
      ...(gateCase.membership === undefined ? {} : { MEMBERSHIP_KIND: gateCase.membership }),
      JOBS_PAGES: JSON.stringify(gateCase.jobsPages ?? [gateCase.jobs ?? []]),
      ...(gateCase.membershipStatus === undefined ? {} : { MEMBERSHIP_STATUS: String(gateCase.membershipStatus) }),
      ...(gateCase.jobsStatus === undefined ? {} : { JOBS_STATUS: String(gateCase.jobsStatus) }),
      ...(gateCase.rerunArgs === undefined
        ? { RERUN_PUSH_E2E_DECIDE_ONLY: '1' }
        : { STUB_RERUN_EXIT: String(gateCase.expectStatus ?? 0) })
    }
  });
  const lines = typeof result.stdout === 'string' ? result.stdout.split('\n') : [];
  return {
    status: result.status,
    decisionLine: lines.find(line => line === 'rerun' || line.startsWith('skip:')),
    ghInvoked: lines.includes('GH_INVOKED=yes'),
    ghCalls: lines.flatMap(line => (line.startsWith('GH_CALL ') ? [line.slice('GH_CALL '.length)] : [])),
    stderr: typeof result.stderr === 'string' ? result.stderr : ' '
  };
};

const readText = (path: string): string => {
  const stdout = spawnSync('cat', [path], { encoding: 'utf8' }).stdout;
  return typeof stdout === 'string' ? stdout : `missing ${path}`;
};

const pushE2ENames = [
  'Apex Debugger E2E (Playwright)',
  'Apex Log E2E (Playwright)',
  'Apex LSP E2E (Playwright)',
  'Apex OAS E2E (Playwright)',
  'Apex Replay Debugger E2E (Playwright)',
  'Apex Testing E2E (Playwright)',
  'Aura E2E (Playwright)',
  'Core E2E (Playwright)',
  'LWC E2E (Playwright)',
  'Metadata E2E (Playwright)',
  'Org E2E (Playwright)',
  'OrgBrowser E2E (Playwright)',
  'Playwright VS Code Ext E2E Tests',
  'Services E2E (Playwright)',
  'SOQL E2E (Playwright)',
  'Visualforce E2E (Playwright)'
] as const;

describe('rerunPushE2EGate', () => {
  test.each(cases)('$name', gateCase => {
    const result = runGate(gateCase);
    expect(result.status).toBe(gateCase.expectStatus ?? 0);
    if (gateCase.expectStatus === undefined) expect(result.stderr).toBe('');
    expect(result.ghInvoked).toBe(gateCase.ghInvoked);
    expect(result.ghCalls.some(call => call.startsWith('api '))).toBe(false);
    expect(result.ghCalls.filter(call => call.startsWith('run rerun'))).toEqual(gateCase.rerunArgs ?? []);
    if (gateCase.expectStatus !== undefined || gateCase.rerunArgs !== undefined) {
      expect(result.decisionLine).toBeUndefined();
    } else {
      expect(result.decisionLine).toEqual(expect.stringMatching(gateCase.decision === 'rerun' ? /^rerun$/ : /^skip:/));
    }
  });
});

describe('rerunPushE2E workflow', () => {
  test('lists the push Playwright workflow names', () => {
    const text = readText(WORKFLOW);
    const workflowItemPrefix = '      - ';
    const workflowsBlock = text.split('workflows:\n')[1]?.split('\n    types:')[0];
    const listed =
      workflowsBlock === undefined
        ? []
        : workflowsBlock
            .split('\n')
            .flatMap(line => (line.startsWith(workflowItemPrefix) ? [line.slice(workflowItemPrefix.length)] : []));
    expect(text.split('\n').filter(line => line.trim() === 'name: Rerun Push E2E')).toHaveLength(1);
    expect(listed).toEqual([...pushE2ENames]);
    expect(text).toContain('WORKFLOW_NAME: ${{ github.event.workflow_run.name }}');
    expect(text).toContain('types: [completed]');
    expect(text).toContain('timeout-minutes: 5');
    expect(text).toContain('group: rerun-push-e2e-${{ github.event.workflow_run.id }}');
    expect(text).toContain('cancel-in-progress: false');
    expect(text).toContain('secrets.IDEE_GH_TOKEN');
    expect(text).not.toContain('secrets.GITHUB_TOKEN');
    expect(text).toContain('ref: ${{ github.event.repository.default_branch }}');
    expect(text).toContain('run: node scripts/rerunPushE2EGate.mts');
    expect(text).toContain('uses: ./.github/actions/setup-pnpm');
    expect(text).toContain('node-version: 24');
    expect(text).toContain('uses: ./.github/actions/pnpmInstallWithRetries');
    expect(text).toContain('run: pnpm --filter @salesforce/effect-octokit compile');
    expect(text).toContain('IDEE_GH_TOKEN: ${{ secrets.IDEE_GH_TOKEN }}');
    expect(text).not.toContain('rerunPushE2EGate.sh');
    expect(text).not.toContain('head_sha');
    expect(text).not.toContain('workflow_dispatch:');
    expect(text).not.toContain('pull_request:');
    expect(text).not.toContain('schedule:');
  });
});
