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
  'if [[ "$*" == *"run rerun"* ]]; then',
  '  echo "live rerun" >&2',
  '  exit 99',
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
  'bash "$SCRIPT"',
  'if [[ -s "$log" ]]; then',
  "  printf '%s\\n' 'GH_INVOKED=yes'",
  'else',
  "  printf '%s\\n' 'GH_INVOKED=no'",
  'fi'
].join('\n');

const baseEnv: Readonly<Record<string, string>> = {
  EVENT: 'push',
  ACTOR: 'svc-idee-bot',
  CONCLUSION: 'failure',
  RUN_STARTED_AT: '2026-01-01T00:00:00Z',
  UPDATED_AT: '2026-01-01T00:10:00Z',
  RUN_ATTEMPT: '1',
  RUN_ID: '99',
  REPO: 'forcedotcom/salesforcedx-vscode'
};

type Decision = 'rerun' | 'skip';
type MembershipKind = 'pending' | 'active' | 'blank';

type GateCase = {
  readonly name: string;
  readonly env: Readonly<Record<string, string>>;
  readonly membership?: MembershipKind;
  readonly decision: Decision;
  readonly ghInvoked: boolean;
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
    name: 'cancelled at 2999s skips',
    env: { ...baseEnv, CONCLUSION: 'cancelled', UPDATED_AT: '2026-01-01T00:49:59Z' },
    decision: 'skip',
    ghInvoked: false
  },
  {
    name: 'cancelled at 3000s reruns',
    env: { ...baseEnv, CONCLUSION: 'cancelled', UPDATED_AT: '2026-01-01T00:50:00Z' },
    decision: 'rerun',
    ghInvoked: false
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
    env: { ...baseEnv, CONCLUSION: 'cancelled', UPDATED_AT: 'not-a-date' },
    decision: 'skip',
    ghInvoked: false
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
      RERUN_PUSH_E2E_DECIDE_ONLY: '1',
      ...(gateCase.membership === undefined ? {} : { MEMBERSHIP_KIND: gateCase.membership }),
      ...gateCase.env
    }
  });
  const lines = typeof result.stdout === 'string' ? result.stdout.split('\n') : [];
  return {
    status: result.status,
    decisionLine: lines.find(line => line === 'rerun' || line.startsWith('skip:')),
    ghInvoked: lines.includes('GH_INVOKED=yes'),
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
    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain('live rerun');
    expect(result.ghInvoked).toBe(gateCase.ghInvoked);
    expect(result.decisionLine).toEqual(expect.stringMatching(gateCase.decision === 'rerun' ? /^rerun$/ : /^skip:/));
  });
});

describe('rerunPushE2E workflow', () => {
  test('lists the push E2E workflow names and reruns failed jobs only', () => {
    const text = readText(WORKFLOW);
    const script = readText(SCRIPT);
    expect(text.split('\n').filter(line => line.trim() === 'name: Rerun Push E2E')).toHaveLength(1);
    expect(pushE2ENames.filter(name => text.includes(`- ${name}`))).toEqual([...pushE2ENames]);
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
    expect(script).toContain('gh run rerun "$RUN_ID" --failed --repo "$REPO"');
  });
});
