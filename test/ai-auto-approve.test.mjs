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

test('accepts the uppercase state returned by the pull request GraphQL API', () => {
  assert.equal(decideAiAutoApprove({ ...base, prState: 'OPEN' }).action, 'approve');
});

test('skips issue comments that are not on a pull request', () => {
  assert.equal(decideAiAutoApprove({ ...base, isPullRequestComment: false }).action, 'skip');
});

test('skips when commenter is not the PR author', () => {
  const decision = decideAiAutoApprove({ ...base, commenterLogin: 'other' });
  assert.equal(decision.action, 'skip');
  assert.match(decision.reason, /not the pull request author/);
  assert.equal(decideAiAutoApprove({ ...base, commenterLogin: undefined, prAuthorLogin: undefined }).action, 'skip');
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

const runCli = ({ workflows, checkRuns, reviews = [], membershipState = 'active' }) => {
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
      const { workflows, checkRuns, reviews, membershipState } = JSON.parse(process.env.MOCK_CHECKS);
      const pull = {
        reviewDecision: null,
        isDraft: false,
        state: 'OPEN',
        baseRefName: 'develop',
        headRefOid: 'abc123',
        author: { login: 'mshanemc' },
        headRepository: { nameWithOwner: 'forcedotcom/salesforcedx-vscode' },
        baseRepository: { nameWithOwner: 'forcedotcom/salesforcedx-vscode' }
      };
      const response = (url, body, headers = {}) => {
        const result = Response.json(body, { headers: { 'content-type': 'application/json', ...headers } });
        Object.defineProperty(result, 'url', { value: url.href });
        return result;
      };
      const pageResponse = (url, rows, field) => {
        const page = Number(url.searchParams.get('page') ?? 1);
        const headers = {};
        if (page * 100 < rows.length) {
          const next = new URL(url);
          next.searchParams.set('page', String(page + 1));
          headers.link = '<' + next.href + '>; rel="next"';
        }
        return response(url, { total_count: rows.length, [field]: rows.slice((page - 1) * 100, page * 100) }, headers);
      };
      globalThis.fetch = async (input, { method = 'GET', body: requestBody } = {}) => {
        const url = new URL(String(input));
        const { pathname, search } = url;
        console.log(method, pathname + search);
        let result;
        if (pathname === '/graphql') result = response(url, { data: { repository: { pullRequest: pull } } });
        else if (pathname.endsWith('/actions/runs')) result = pageResponse(url, workflows, 'workflow_runs');
        else if (pathname.endsWith('/check-runs')) result = pageResponse(url, checkRuns, 'check_runs');
        else if (pathname.endsWith('/status')) result = response(url, { statuses: [{ id: 1, context: 'security', state: 'success' }] });
        else if (pathname.endsWith('/memberships/mshanemc')) result = response(url, { state: membershipState });
        else if (pathname.endsWith('/pulls/8303/reviews')) result = response(url, method === 'POST' ? {} : reviews);
        else throw new Error('Unexpected API request: ' + pathname + ' ' + method + ' ' + String(requestBody ?? ''));
        return result;
      };
      const { aiAutoApproveMain } = await import('./scripts/ai-auto-approve-cli.mjs');
      const { runPromise } = await import('effect/Effect');
      await runPromise(aiAutoApproveMain);
    `
      ],
      {
        cwd: new URL('..', import.meta.url),
        encoding: 'utf8',
        env: {
          ...process.env,
          IDEE_GH_TOKEN: 'test-token',
          CI: 'true',
          GITHUB_REPOSITORY: 'forcedotcom/salesforcedx-vscode',
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_REPOSITORY_OWNER: 'forcedotcom',
          GITHUB_ACTION: '__run',
          GITHUB_ACTIONS: 'true',
          GITHUB_ACTOR: 'mshanemc',
          GITHUB_ACTOR_ID: '1',
          GITHUB_API_URL: 'https://api.github.com',
          GITHUB_ARTIFACTS: '/tmp/artifacts',
          GITHUB_ARTIFACTS_LIST: '/tmp/artifacts-list',
          GITHUB_ENV: '/tmp/env',
          GITHUB_EVENT_NAME: 'issue_comment',
          GITHUB_GRAPHQL_URL: 'https://api.github.com/graphql',
          GITHUB_JOB: 'ai-auto-approve',
          GITHUB_OUTPUT: '/tmp/output',
          GITHUB_PATH: '/tmp/path',
          GITHUB_REPOSITORY_ID: '1',
          GITHUB_REPOSITORY_OWNER_ID: '1',
          GITHUB_RETENTION_DAYS: '90',
          GITHUB_RUN_ATTEMPT: '1',
          GITHUB_RUN_ID: '1',
          GITHUB_RUN_NUMBER: '1',
          GITHUB_SERVER_URL: 'https://github.com',
          GITHUB_SHA: 'abc123',
          GITHUB_STEP_SUMMARY: '/tmp/summary',
          GITHUB_TRIGGERING_ACTOR: 'mshanemc',
          GITHUB_WORKFLOW: 'AI Auto Approve',
          GITHUB_WORKFLOW_REF:
            'forcedotcom/salesforcedx-vscode/.github/workflows/ai-auto-approve.yml@refs/heads/develop',
          GITHUB_WORKFLOW_SHA: 'abc123',
          GITHUB_WORKSPACE: '/workspace',
          RUNNER_ARCH: 'ARM64',
          RUNNER_ENVIRONMENT: 'github-hosted',
          RUNNER_NAME: 'Hosted Agent',
          RUNNER_OS: 'Linux',
          RUNNER_TEMP: '/tmp',
          RUNNER_TOOL_CACHE: '/tmp/tool-cache',
          GITHUB_REF_PROTECTED: 'false',
          GITHUB_REF_TYPE: 'branch',
          RUNNER_DEBUG: '1',
          MOCK_CHECKS: JSON.stringify({ workflows, checkRuns, reviews, membershipState })
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
  assert.match(output, /\/actions\/runs\?.*page=2/);
  assert.match(output, /\/check-runs\?.*filter=all.*page=2/);
  assert.match(output, /decision: approve \(gates passed\)/);
});

test('CLI blocks approval when the latest run for a workflow was cancelled', () => {
  const path = '.github/workflows/ci.yml';
  const workflows = [
    { id: 11, path, status: 'completed', conclusion: 'cancelled' },
    { id: 10, path, status: 'completed', conclusion: 'success' }
  ];
  assert.match(runCli({ workflows, checkRuns: [] }), /decision: skip \(CI is not green on head\)/);
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
  assert.match(output, /\/check-runs\?.*filter=all.*page=2/);
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
  assert.match(output, /\/check-runs\?.*filter=all/);
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

test('CLI skips when the bot already approved the head', () => {
  const workflows = [{ id: 1, path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success' }];
  const reviews = [{ user: { login: 'svc-idee-bot' }, state: 'APPROVED', commit_id: 'abc123' }];
  const output = runCli({ workflows, checkRuns: [], reviews });
  assert.match(output, /decision: skip \(bot already approved this head\)/);
  assert.doesNotMatch(output, /approved forcedotcom\/salesforcedx-vscode#8303/);
});

test('skips when bot already approved this head', () => {
  const reviews = [{ user: { login: 'svc-idee-bot' }, state: 'APPROVED', commit_id: 'abc123' }];
  assert.equal(hasBotApprovalOnHead(reviews, 'abc123'), true);
  assert.equal(hasBotApprovalOnHead(reviews, 'other'), false);
  assert.equal(decideAiAutoApprove({ ...base, reviews }).action, 'skip');
});
