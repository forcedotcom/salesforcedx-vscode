/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/// <reference types="jest" />
/// <reference types="node" />

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts', 'rerunPushE2EGate.sh');
const WORKFLOW = join(process.cwd(), '.github', 'workflows', 'rerunPushE2E.yml');

const WRAPPER = [
  'set -euo pipefail',
  'dir=$(mktemp -d)',
  'log="$dir/calls"',
  'touch "$log"',
  'cat > "$dir/gh" <<\'EOF\'',
  '#!/usr/bin/env bash',
  'printf \'%s\\n\' "$*" >> "$GH_CALL_LOG"',
  'if [[ "$*" == *"/jobs"* ]]; then',
  '  printf \'%s\\n\' "${JOBS_TSV-}"',
  '  exit 0',
  'fi',
  'if [[ "$*" == *"run rerun"* ]]; then',
  '  if [ "${STUB_RERUN_EXIT:-99}" != "0" ]; then',
  '    echo "live rerun" >&2',
  '    exit 99',
  '  fi',
  '  exit 0',
  'fi',
  'case "${MEMBERSHIP_KIND:-}" in',
  "  pending) printf '%s\\n' pending ;;",
  "  active) printf '%s\\n' active ;;",
  "  blank) printf '\\n' ;;",
  'esac',
  'exit 0',
  'EOF',
  'chmod +x "$dir/gh"',
  'export PATH="$dir:$PATH"',
  'export GH_CALL_LOG="$log"',
  'set +e',
  'bash "$SCRIPT"',
  'status=$?',
  'set -e',
  'if [[ -s "$log" ]]; then',
  "  printf '%s\\n' 'GH_INVOKED=yes'",
  '  sed \'s/^/GH_CALL /\' "$log"',
  'else',
  "  printf '%s\\n' 'GH_INVOKED=no'",
  'fi',
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

const jobTsv = (row: {
  readonly id: string;
  readonly name: string;
  readonly conclusion: string;
  readonly started: string;
  readonly completed: string;
}) => `${row.id}\t${row.name}\t${row.conclusion}\t${row.started}\t${row.completed}`;

type Decision = 'rerun' | 'skip';
type MembershipKind = 'pending' | 'active' | 'blank';

type GateCase = {
  readonly name: string;
  readonly env: Readonly<Record<string, string>>;
  readonly membership?: MembershipKind;
  readonly jobsTsv?: string;
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
    jobsTsv: jobTsv({
      id: '11',
      name: 'e2e-desktop (ubuntu-latest)',
      conclusion: 'cancelled',
      started: '2026-01-01T00:00:00Z',
      completed: '2026-01-01T00:50:00Z'
    }),
    decision: 'skip',
    ghInvoked: true
  },
  {
    name: 'cancelled job at 60m reruns that job',
    env: { ...baseEnv, CONCLUSION: 'cancelled', WORKFLOW_NAME: 'Core E2E (Playwright)' },
    jobsTsv: jobTsv({
      id: '61',
      name: 'e2e-desktop (ubuntu-latest)',
      conclusion: 'cancelled',
      started: '2026-01-01T00:00:00Z',
      completed: '2026-01-01T01:00:00Z'
    }),
    decision: 'rerun',
    ghInvoked: true,
    rerunArgs: ['run rerun --job 61 --repo forcedotcom/salesforcedx-vscode']
  },
  {
    name: 'LWC run-tests cancel under 90m skips',
    env: { ...baseEnv, CONCLUSION: 'cancelled', WORKFLOW_NAME: 'LWC E2E (Playwright)' },
    jobsTsv: jobTsv({
      id: '90',
      name: 'e2e-desktop-run-tests (ubuntu-latest)',
      conclusion: 'cancelled',
      started: '2026-01-01T00:00:00Z',
      completed: '2026-01-01T01:10:00Z'
    }),
    decision: 'skip',
    ghInvoked: true
  },
  {
    name: 'LWC timeout cancel reruns only jobs that reached their timeout',
    env: { ...baseEnv, CONCLUSION: 'cancelled', WORKFLOW_NAME: 'LWC E2E (Playwright)' },
    jobsTsv: [
      jobTsv({
        id: '60',
        name: 'e2e-desktop-lsp (ubuntu-latest)',
        conclusion: 'cancelled',
        started: '2026-01-01T00:00:00Z',
        completed: '2026-01-01T01:00:00Z'
      }),
      jobTsv({
        id: '70',
        name: 'e2e-desktop-run-tests (ubuntu-latest)',
        conclusion: 'cancelled',
        started: '2026-01-01T00:00:00Z',
        completed: '2026-01-01T01:10:00Z'
      }),
      jobTsv({
        id: '71',
        name: 'e2e-web (ubuntu-latest)',
        conclusion: 'success',
        started: '2026-01-01T00:00:00Z',
        completed: '2026-01-01T00:10:00Z'
      })
    ].join('\n'),
    decision: 'rerun',
    ghInvoked: true,
    rerunArgs: ['run rerun --job 60 --repo forcedotcom/salesforcedx-vscode']
  },
  {
    name: 'LWC run-tests cancel at 90m reruns one timed-out job',
    env: { ...baseEnv, CONCLUSION: 'cancelled', WORKFLOW_NAME: 'LWC E2E (Playwright)' },
    jobsTsv: [
      jobTsv({
        id: '91',
        name: 'e2e-desktop-run-tests (macos-latest)',
        conclusion: 'cancelled',
        started: '2026-01-01T00:00:00Z',
        completed: '2026-01-01T01:30:00Z'
      }),
      jobTsv({
        id: '92',
        name: 'e2e-desktop-run-tests (ubuntu-latest)',
        conclusion: 'cancelled',
        started: '2026-01-01T00:00:00Z',
        completed: '2026-01-01T01:30:00Z'
      })
    ].join('\n'),
    decision: 'rerun',
    ghInvoked: true,
    rerunArgs: ['run rerun --job 91 --repo forcedotcom/salesforcedx-vscode']
  },
  {
    name: 'timeout cancel plus a failed job reruns one timed-out job',
    env: { ...baseEnv, CONCLUSION: 'cancelled', WORKFLOW_NAME: 'LWC E2E (Playwright)' },
    jobsTsv: [
      jobTsv({
        id: '3',
        name: 'e2e-desktop-run-tests (windows-latest)',
        conclusion: 'failure',
        started: '2026-01-01T00:00:00Z',
        completed: '2026-01-01T00:04:00Z'
      }),
      jobTsv({
        id: '91',
        name: 'e2e-desktop-run-tests (macos-latest)',
        conclusion: 'cancelled',
        started: '2026-01-01T00:00:00Z',
        completed: '2026-01-01T01:30:00Z'
      })
    ].join('\n'),
    decision: 'rerun',
    ghInvoked: true,
    rerunArgs: ['run rerun --job 91 --repo forcedotcom/salesforcedx-vscode']
  },
  {
    name: 'cancelled run with only an early failure skips',
    env: { ...baseEnv, CONCLUSION: 'cancelled', WORKFLOW_NAME: 'Core E2E (Playwright)' },
    jobsTsv: jobTsv({
      id: '4',
      name: 'e2e-desktop (ubuntu-latest)',
      conclusion: 'failure',
      started: '2026-01-01T00:00:00Z',
      completed: '2026-01-01T00:04:00Z'
    }),
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
    jobsTsv: jobTsv({
      id: '12',
      name: 'e2e-desktop (ubuntu-latest)',
      conclusion: 'cancelled',
      started: '2026-01-01T00:00:00Z',
      completed: 'not-a-date'
    }),
    decision: 'skip',
    ghInvoked: true
  },
  {
    name: 'failed gh run rerun fails the job',
    env: baseEnv,
    decision: 'rerun',
    ghInvoked: true,
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
      SCRIPT,
      ...gateCase.env,
      ...(gateCase.membership === undefined ? {} : { MEMBERSHIP_KIND: gateCase.membership }),
      ...(gateCase.jobsTsv === undefined ? {} : { JOBS_TSV: gateCase.jobsTsv }),
      ...(gateCase.rerunArgs === undefined && gateCase.expectStatus === undefined
        ? { RERUN_PUSH_E2E_DECIDE_ONLY: '1' }
        : gateCase.expectStatus === undefined
          ? { STUB_RERUN_EXIT: '0' }
          : {})
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
    gateCase.expectStatus === undefined
      ? expect(result.stderr).not.toContain('live rerun')
      : expect(result.ghCalls.some(call => call.includes('--failed'))).toBe(true);
    expect(result.ghInvoked).toBe(gateCase.ghInvoked);
    gateCase.expectStatus !== undefined
      ? expect(result.decisionLine).toBeUndefined()
      : gateCase.rerunArgs === undefined
        ? expect(result.decisionLine).toEqual(
            expect.stringMatching(gateCase.decision === 'rerun' ? /^rerun$/ : /^skip:/)
          )
        : expect(result.ghCalls.filter(call => call.includes('run rerun'))).toEqual([...gateCase.rerunArgs]);
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
    expect(text).not.toContain('head_sha');
    expect(text).not.toContain('workflow_dispatch:');
    expect(text).not.toContain('pull_request:');
    expect(text).not.toContain('schedule:');
  });
});
