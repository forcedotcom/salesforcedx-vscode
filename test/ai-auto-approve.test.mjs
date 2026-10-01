import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  allChecksGreen,
  decideAiAutoApprove,
  hasBotApprovalOnHead,
  isStandaloneAiAutoApprove
} from '../scripts/ai-auto-approve.mjs';

const green = { key: 'workflow:.github/workflows/ci.yml', id: 1, status: 'completed', conclusion: 'SUCCESS' };
const base = {
  isPullRequestComment: true,
  commentBody: '/ai-auto approve',
  commenterLogin: 'mshanemc',
  prAuthorLogin: 'mshanemc',
  teamMembershipState: 'active',
  prState: 'open',
  prDraft: false,
  headSha: 'abc123',
  checks: [green],
  reviews: []
};

test('token is exact standalone /ai-auto approve', () => {
  assert.equal(isStandaloneAiAutoApprove('/ai-auto approve'), true);
  assert.equal(isStandaloneAiAutoApprove('/ai-auto approve\n'), true);
  assert.equal(isStandaloneAiAutoApprove('  /ai-auto approve  '), true);
  assert.equal(isStandaloneAiAutoApprove('/ai-auto approve please'), false);
  assert.equal(isStandaloneAiAutoApprove('please /ai-auto approve'), false);
  assert.equal(isStandaloneAiAutoApprove('/ai-auto  approve'), false);
  assert.equal(isStandaloneAiAutoApprove('/ai-autoapprove'), false);
  assert.equal(isStandaloneAiAutoApprove('/AI-AUTO APPROVE'), false);
});

test('approves when all gates pass', () => {
  assert.deepEqual(decideAiAutoApprove(base), { action: 'approve', reason: 'gates passed' });
});

test('skips issue comments that are not on a pull request', () => {
  assert.equal(decideAiAutoApprove({ ...base, isPullRequestComment: false }).action, 'skip');
});

test('skips when commenter is not the PR author', () => {
  const decision = decideAiAutoApprove({ ...base, commenterLogin: 'other' });
  assert.equal(decision.action, 'skip');
  assert.match(decision.reason, /not the pull request author/);
});

test('skips when commenter is not an active ide-experience member', () => {
  assert.equal(decideAiAutoApprove({ ...base, teamMembershipState: 'none' }).action, 'skip');
  assert.equal(decideAiAutoApprove({ ...base, teamMembershipState: 'pending' }).action, 'skip');
});

test('skips draft and closed PRs', () => {
  assert.equal(decideAiAutoApprove({ ...base, prDraft: true }).action, 'skip');
  assert.equal(decideAiAutoApprove({ ...base, prState: 'closed' }).action, 'skip');
});

test('skips when CI is empty, pending, or failed', () => {
  assert.equal(allChecksGreen([]), false);
  assert.equal(decideAiAutoApprove({ ...base, checks: [] }).action, 'skip');
  assert.equal(decideAiAutoApprove({ ...base, checks: [{ status: 'in_progress', conclusion: null }] }).action, 'skip');
  assert.equal(
    decideAiAutoApprove({ ...base, checks: [{ status: 'completed', conclusion: 'FAILURE' }] }).action,
    'skip'
  );
});

test('treats skipped and neutral as green', () => {
  assert.equal(allChecksGreen([{ status: 'completed', conclusion: 'SKIPPED' }]), true);
  assert.equal(allChecksGreen([{ status: 'completed', conclusion: 'NEUTRAL' }]), true);
});

test('latest success supersedes a cancelled workflow run', () => {
  const checks = [
    { key: 'workflow:.github/workflows/e2e.yml', id: 10, status: 'completed', conclusion: 'CANCELLED' },
    { key: 'workflow:.github/workflows/e2e.yml', id: 11, status: 'completed', conclusion: 'SUCCESS' }
  ];
  assert.equal(decideAiAutoApprove({ ...base, checks }).action, 'approve');
});

test('latest cancelled workflow run blocks approval', () => {
  const checks = [
    { key: 'workflow:.github/workflows/e2e.yml', id: 11, status: 'completed', conclusion: 'CANCELLED' },
    { key: 'workflow:.github/workflows/e2e.yml', id: 10, status: 'completed', conclusion: 'SUCCESS' }
  ];
  assert.equal(decideAiAutoApprove({ ...base, checks }).action, 'skip');
  assert.equal(decideAiAutoApprove({ ...base, checks: [checks[0]] }).action, 'skip');
});

test('same job name in another workflow does not hide its cancellation', () => {
  const checks = [
    {
      key: 'workflow:.github/workflows/metadataE2E.yml',
      name: 'e2e-web',
      id: 10,
      status: 'completed',
      conclusion: 'CANCELLED'
    },
    { ...green, key: 'workflow:.github/workflows/e2e.yml', name: 'e2e-web', id: 11 }
  ];
  assert.equal(decideAiAutoApprove({ ...base, checks }).action, 'skip');
});

test('latest in-progress workflow run after cancellation blocks approval', () => {
  const checks = [
    { key: 'workflow:.github/workflows/e2e.yml', id: 10, status: 'completed', conclusion: 'CANCELLED' },
    { key: 'workflow:.github/workflows/e2e.yml', id: 11, status: 'in_progress', conclusion: null }
  ];
  assert.equal(decideAiAutoApprove({ ...base, checks }).action, 'skip');
});

const runCli = ({ workflows, checkRuns }) => {
  const directory = mkdtempSync(join(tmpdir(), 'ai-auto-approve-'));
  const eventPath = join(directory, 'event.json');
  writeFileSync(
    eventPath,
    JSON.stringify({
      comment: { user: { login: 'mshanemc' }, body: '/ai-auto approve' },
      issue: { number: 8303, pull_request: {} }
    })
  );
  try {
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
      const { workflows, checkRuns } = JSON.parse(process.env.MOCK_CHECKS);
      globalThis.fetch = async (url, { method = 'GET' } = {}) => {
        const { pathname, search, searchParams } = new URL(url);
        const page = Number(searchParams.get('page') ?? 1);
        console.log(method, pathname + search);
        let body;
        if (pathname.endsWith('/actions/runs')) body = { total_count: workflows.length, workflow_runs: workflows.slice((page - 1) * 100, page * 100) };
        else if (pathname.endsWith('/check-runs')) {
          const visible = searchParams.get('filter') === 'all' ? checkRuns : checkRuns.filter(run => run.status === 'completed');
          body = { total_count: visible.length, check_runs: visible.slice((page - 1) * 100, page * 100) };
        }
        else if (pathname.endsWith('/status')) body = { statuses: [{ id: 1, context: 'security', state: 'success' }] };
        else if (pathname.endsWith('/memberships/mshanemc')) body = { state: 'active' };
        else if (pathname.endsWith('/pulls/8303')) body = { head: { sha: 'abc123' }, user: { login: 'mshanemc' }, state: 'open' };
        else if (pathname.endsWith('/pulls/8303/reviews')) body = method === 'POST' ? {} : [];
        else throw new Error('Unexpected API request: ' + pathname);
        return Response.json(body);
      };
      await import('./scripts/ai-auto-approve-cli.mjs');
    `
      ],
      {
        cwd: new URL('..', import.meta.url),
        encoding: 'utf8',
        env: {
          ...process.env,
          IDEE_GH_TOKEN: 'test-token',
          GITHUB_REPOSITORY: 'forcedotcom/salesforcedx-vscode',
          GITHUB_EVENT_PATH: eventPath,
          MOCK_CHECKS: JSON.stringify({ workflows, checkRuns })
        }
      }
    );
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  } finally {
    unlinkSync(eventPath);
    rmdirSync(directory);
  }
};

test('CLI pages workflow runs and ignores cancelled Actions jobs from superseded runs', () => {
  const path = '.github/workflows/metadataE2E.yml';
  const workflows = [
    { id: 10, path, status: 'completed', conclusion: 'cancelled' },
    ...Array.from({ length: 99 }, (_, i) => ({
      id: 11 + i,
      path: `.github/workflows/other-${i}.yml`,
      status: 'completed',
      conclusion: 'success'
    })),
    { id: 110, path, status: 'completed', conclusion: 'success' }
  ];
  const checkRuns = [
    ...Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      name: 'e2e-web',
      app: { id: 15368, slug: 'github-actions' },
      status: 'completed',
      conclusion: 'cancelled'
    })),
    { id: 101, name: 'SAST', app: { id: 42, slug: 'security' }, status: 'completed', conclusion: 'success' }
  ];
  const output = runCli({ workflows, checkRuns });
  assert.match(output, /\/actions\/runs\?head_sha=abc123&per_page=100&page=2/);
  assert.match(output, /\/check-runs\?filter=all&per_page=100&page=2/);
  assert.match(output, /decision: approve \(gates passed\)/);
});

test('CLI sees a failing non-Actions check on the second page', () => {
  const workflows = [{ id: 1, path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success' }];
  const checkRuns = [
    ...Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      name: 'e2e-web',
      app: { id: 15368, slug: 'github-actions' },
      status: 'completed',
      conclusion: 'success'
    })),
    { id: 101, name: 'SAST', app: { id: 42, slug: 'security' }, status: 'completed', conclusion: 'failure' }
  ];
  const output = runCli({ workflows, checkRuns });
  assert.match(output, /\/check-runs\?filter=all&per_page=100&page=2/);
  assert.match(output, /decision: skip \(CI is not green on head\)/);
});

test('CLI keeps workflows with the same job name separate by path', () => {
  const workflows = [
    {
      id: 10,
      path: '.github/workflows/metadataE2E.yml',
      name: 'e2e-web',
      status: 'completed',
      conclusion: 'cancelled'
    },
    { id: 11, path: '.github/workflows/otherE2E.yml', name: 'e2e-web', status: 'completed', conclusion: 'success' }
  ];
  assert.match(runCli({ workflows, checkRuns: [] }), /decision: skip \(CI is not green on head\)/);
});

test('CLI uses the latest check per app and name without merging apps', () => {
  const workflows = [{ id: 1, path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success' }];
  const checkRuns = [
    { id: 10, name: 'scan', app: { id: 42, slug: 'security' }, status: 'completed', conclusion: 'cancelled' },
    { id: 11, name: 'scan', app: { id: 42, slug: 'security' }, status: 'completed', conclusion: 'success' },
    { id: 12, name: 'scan', app: { id: 43, slug: 'credentials' }, status: 'completed', conclusion: 'failure' }
  ];
  assert.match(runCli({ workflows, checkRuns: checkRuns.slice(0, 2) }), /decision: approve \(gates passed\)/);
  assert.match(runCli({ workflows, checkRuns }), /decision: skip \(CI is not green on head\)/);
});

test('CLI includes a newer in-progress non-Actions check omitted by the default filter', () => {
  const workflows = [{ id: 1, path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success' }];
  const checkRuns = [
    { id: 10, name: 'SAST', app: { id: 42, slug: 'security' }, status: 'completed', conclusion: 'success' },
    { id: 11, name: 'SAST', app: { id: 42, slug: 'security' }, status: 'in_progress', conclusion: null }
  ];
  const output = runCli({ workflows, checkRuns });
  assert.match(output, /\/check-runs\?filter=all&per_page=100&page=1/);
  assert.match(output, /decision: skip \(CI is not green on head\)/);
});

test('CLI keeps checks from different apps without slugs separate by app id', () => {
  const workflows = [{ id: 1, path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success' }];
  const checkRuns = [
    { id: 10, name: 'scan', app: { id: 42 }, status: 'completed', conclusion: 'failure' },
    { id: 11, name: 'scan', app: { id: 43 }, status: 'completed', conclusion: 'success' }
  ];
  assert.match(runCli({ workflows, checkRuns }), /decision: skip \(CI is not green on head\)/);
});

test('CLI skips approval when a check run has no app', () => {
  const workflows = [{ id: 1, path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success' }];
  const checkRuns = [{ id: 10, name: 'scan', app: null, status: 'completed', conclusion: 'success' }];
  assert.match(runCli({ workflows, checkRuns }), /decision: skip \(CI is not green on head\)/);
});

test('skips when bot already approved this head', () => {
  const reviews = [{ authorLogin: 'svc-idee-bot', state: 'APPROVED', commitOid: 'abc123' }];
  assert.equal(hasBotApprovalOnHead(reviews, 'abc123'), true);
  assert.equal(hasBotApprovalOnHead(reviews, 'other'), false);
  assert.equal(decideAiAutoApprove({ ...base, reviews }).action, 'skip');
});
