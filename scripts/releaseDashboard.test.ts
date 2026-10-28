/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/// <reference types="vitest/globals" />
/// <reference types="node" />

import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(process.cwd(), 'scripts', 'releaseDashboard.sh');

const runDashboard = (runs: unknown, releases: unknown, trackingTags = '', checks: unknown = { check_runs: [] }) => {
  const directory = mkdtempSync(join(tmpdir(), 'release-dashboard-'));
  const summary = join(directory, 'summary.md');
  const gh = join(directory, 'gh');
  writeFileSync(
    gh,
    '#!/usr/bin/env bash\nif [[ "$*" == *"/releases?"* ]]; then printf \'%s\' "$RELEASES"; elif [[ "$*" == *"/branches/develop"* ]]; then printf \'%s\' \'{"commit":{"sha":"develop-sha"}}\'; elif [[ "$*" == *"/check-runs"* ]]; then printf \'%s\' "$CHECKS" | jq -c \'.check_runs[]\'; else printf \'%s\' "$RUNS"; fi\n'
  );
  chmodSync(gh, 0o755);
  const result = spawnSync('bash', [script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
      REPO: 'forcedotcom/salesforcedx-vscode',
      GITHUB_STEP_SUMMARY: summary,
      RELEASE_DASHBOARD_TRACKING_TAGS: trackingTags || ' ',
      RUNS: JSON.stringify(runs),
      RELEASES: JSON.stringify(releases),
      CHECKS: JSON.stringify(checks)
    }
  });
  return { result, summary: readFileSync(summary, 'utf8') };
};

// Bash and jq subprocess startup can exceed Vitest's 5s default on Windows runners.
describe('releaseDashboard', { timeout: 15_000 }, () => {
  it('identifies a failed nightly as the prerequisite blocker', () => {
    const { result, summary } = runDashboard(
      {
        workflow_runs: [
          {
            name: 'Nightly Release',
            status: 'completed',
            conclusion: 'failure',
            created_at: '2026-10-23T04:00:00Z',
            html_url: 'https://example.test/nightly'
          },
          {
            name: 'Promote to Pre-release',
            status: 'completed',
            conclusion: 'failure',
            created_at: '2026-10-23T08:00:00Z',
            html_url: 'https://example.test/promotion'
          }
        ]
      },
      []
    );

    expect(result.status).toBe(0);
    expect(summary).toContain('| Nightly | failure | [run](https://example.test/nightly) |');
    expect(summary).toContain(
      'Latest nightly failed. Promotion cannot pass its required nightly package/release checks'
    );
    expect(summary).toContain('do not rerun the stable build until a new prerelease tracking tag exists');
  });

  it('still flags a failed nightly when the last promotion run predates it and was a stale success', () => {
    const { result, summary } = runDashboard(
      {
        workflow_runs: [
          {
            name: 'Nightly Release',
            status: 'completed',
            conclusion: 'failure',
            created_at: '2026-10-26T04:00:00Z',
            html_url: 'https://example.test/nightly'
          },
          {
            name: 'Promote to Pre-release',
            status: 'completed',
            conclusion: 'success',
            created_at: '2026-10-21T08:00:00Z',
            html_url: 'https://example.test/promotion'
          }
        ]
      },
      []
    );

    expect(result.status).toBe(0);
    expect(summary).toContain('| Nightly | failure | [run](https://example.test/nightly) |');
    expect(summary).toContain(
      'Latest nightly failed. Promotion cannot pass its required nightly package/release checks'
    );
  });

  it('surfaces a stable candidate as awaiting manual QA', () => {
    const { result, summary } = runDashboard({ workflow_runs: [] }, [
      {
        prerelease: true,
        name: 'Release 68.6.0 - Ready for Testing',
        tag_name: 'v68.6.0'
      },
      {
        prerelease: true,
        name: 'salesforcedx-vscode v68.5.5 (Nightly develop 20261021) - published',
        tag_name: 'v68.5.5-nightly.develop.20261021'
      }
    ]);

    expect(result.status).toBe(0);
    expect(summary).toContain('| Stable candidate awaiting QA | v68.6.0 |');
    expect(summary).toContain('Complete recorded manual QA for v68.6.0');
  });

  it('tells the release manager to inspect a failed stable build', () => {
    const { result, summary } = runDashboard(
      {
        workflow_runs: [
          {
            name: 'Build GitHub Release',
            status: 'completed',
            conclusion: 'failure',
            created_at: '2026-10-23T07:00:00Z',
            html_url: 'https://example.test/stable'
          }
        ]
      },
      []
    );

    expect(result.status).toBe(0);
    expect(summary).toContain('Latest stable-candidate build failed.');
    expect(summary).toContain('Do not use an emergency source override');
  });

  it('ignores a newer skipped npm publication run', () => {
    const { result, summary } = runDashboard(
      {
        workflow_runs: [
          {
            name: 'Publish Release to Marketplace',
            display_title: 'Release playwright-vscode-ext-v1.7.2',
            status: 'completed',
            conclusion: 'skipped',
            created_at: '2026-10-23T09:00:00Z'
          },
          {
            name: 'Publish Release to Marketplace',
            display_title: 'Release v68.6.0',
            status: 'completed',
            conclusion: 'failure',
            created_at: '2026-10-23T08:00:00Z'
          }
        ]
      },
      []
    );

    expect(result.status).toBe(0);
    expect(summary).toContain('At least one registry publication workflow requires inspection.');
  });

  it('reports explicit develop unit failures as hard-no and E2E as advisory', () => {
    const { result, summary } = runDashboard(
      {
        workflow_runs: [
          {
            name: 'End to End Tests',
            status: 'completed',
            conclusion: 'failure',
            head_sha: 'older-develop-sha',
            created_at: '2026-10-20T08:00:00Z',
            html_url: 'https://example.test/e2e'
          }
        ]
      },
      [],
      '',
      {
        check_runs: [
          {
            name: 'build-and-test / build-all / build-all',
            app: { id: 15_368 },
            status: 'completed',
            conclusion: 'success'
          },
          {
            name: 'build-and-test / unit-tests / linux-unit-tests / linux-unit-tests',
            app: { id: 15_368 },
            status: 'completed',
            conclusion: 'failure'
          },
          {
            name: 'build-and-test / unit-tests / windows-unit-tests / windows-unit-tests',
            app: { id: 15_368 },
            status: 'completed',
            conclusion: 'success'
          }
        ]
      }
    );

    expect(result.status).toBe(0);
    expect(summary).toContain('| Unit tests (Linux) | Hard no | failure |');
    expect(summary).toContain('**Develop hard-gate verdict:** hard no');
    expect(summary).toContain('The current develop commit has an explicit failed build or unit-test check.');
    expect(summary).toContain('| End-to-end aggregate | Advisory | failure (historical)');
    expect(summary).toContain('E2E failures are an investigation signal, not an automatic release stop.');
  });

  it('keeps an E2E-only failure advisory when hard checks passed', () => {
    const { result, summary } = runDashboard(
      {
        workflow_runs: [
          {
            name: 'End to End Tests',
            status: 'completed',
            conclusion: 'failure',
            head_sha: 'develop-sha',
            created_at: '2026-10-23T08:00:00Z',
            html_url: 'https://example.test/e2e'
          }
        ]
      },
      [],
      '',
      {
        check_runs: [
          {
            name: 'build-and-test / build-all / build-all',
            app: { id: 15_368 },
            status: 'completed',
            conclusion: 'success'
          },
          {
            name: 'build-and-test / unit-tests / linux-unit-tests / linux-unit-tests',
            app: { id: 15_368 },
            status: 'completed',
            conclusion: 'success'
          },
          {
            name: 'build-and-test / unit-tests / windows-unit-tests / windows-unit-tests',
            app: { id: 15_368 },
            status: 'completed',
            conclusion: 'success'
          }
        ]
      }
    );

    expect(result.status).toBe(0);
    expect(summary).toContain('**Develop hard-gate verdict:** verified');
    expect(summary).toContain('| End-to-end aggregate | Advisory | failure ([run](https://example.test/e2e)) |');
    expect(summary).toContain('**Blocker:** None detected from the latest workflow snapshots.');
  });
});
