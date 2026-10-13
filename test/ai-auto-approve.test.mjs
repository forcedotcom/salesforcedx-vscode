import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { allGitHubChecksSuccessful as allChecksGreen, findApprovedReviewOnHead } from '@salesforce/effect-octokit';
import {
  authorStandaloneAiAutoComments,
  decideAiAutoApprove,
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

test('immediate: identity pass + green checks approves', () => {
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

test('queue: identity pass + empty, pending, or failed CI holds, not approve', () => {
  assert.equal(allChecksGreen([]), false);
  assert.deepEqual(decideAiAutoApprove({ ...base, checks: [] }), { action: 'hold', reason: 'CI is not green on head' });
  assert.equal(decideAiAutoApprove({ ...base, checks: [{ status: 'in_progress', conclusion: null }] }).action, 'hold');
  assert.equal(
    decideAiAutoApprove({ ...base, checks: [{ status: 'completed', conclusion: 'FAILURE' }] }).action,
    'hold'
  );
});

test('identity failures stay skip, never hold, when CI is not green', () => {
  const pending = { ...base, checks: [] };
  assert.equal(decideAiAutoApprove({ ...pending, commenterLogin: 'other' }).action, 'skip');
  assert.equal(decideAiAutoApprove({ ...pending, teamMembershipState: 'none' }).action, 'skip');
  assert.equal(decideAiAutoApprove({ ...pending, prDraft: true }).action, 'skip');
  assert.equal(decideAiAutoApprove({ ...pending, prState: 'closed' }).action, 'skip');
  assert.equal(decideAiAutoApprove({ ...pending, commentBody: 'please /ai-auto approve' }).action, 'skip');
});

test('treats skipped and neutral as green', () => {
  assert.equal(allChecksGreen([{ status: 'completed', conclusion: 'SKIPPED' }]), true);
  assert.equal(allChecksGreen([{ status: 'completed', conclusion: 'NEUTRAL' }]), true);
});

test('same-SHA re-run: green now, bot has not approved this head, approves', () => {
  assert.equal(decideAiAutoApprove(base).action, 'approve');
  const reviews = [{ user: { login: 'svc-idee-bot' }, state: 'APPROVED', commit_id: 'abc123' }];
  assert.equal(findApprovedReviewOnHead(reviews, 'abc123', 'svc-idee-bot'), reviews[0]);
  assert.equal(findApprovedReviewOnHead(reviews, 'other', 'svc-idee-bot'), undefined);
  assert.equal(decideAiAutoApprove({ ...base, reviews }).action, 'skip');
});

test('invalidate-on-push selector returns only author exact standalone comments', () => {
  const comments = [
    { id: 1, authorLogin: 'mshanemc', body: '/ai-auto approve' },
    { id: 2, authorLogin: 'mshanemc', body: '/ai-auto approve please' },
    { id: 3, authorLogin: 'other', body: '/ai-auto approve' },
    { id: 4, authorLogin: 'mshanemc', body: '/ai-auto approve\n' }
  ];
  assert.deepEqual(
    authorStandaloneAiAutoComments(comments, 'mshanemc').map(comment => comment.id),
    [1, 4]
  );
});

const eventPayloads = {
  issue_comment: {
    comment: { user: { login: 'mshanemc' }, body: '/ai-auto approve' },
    issue: { number: 8303, pull_request: {} }
  }
};

/**
 * Runs the workflow CLI in a child process with a scripted GitHub API.
 * Prints one `request METHOD path` line per API call, then the CLI's own log lines.
 */
const runCli = ({
  eventName = 'issue_comment',
  event = eventPayloads.issue_comment,
  workflows = [{ id: 1, path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success' }],
  checkRuns = [],
  reviews = [],
  comments = [{ id: 500, user: { login: 'mshanemc' }, body: '/ai-auto approve' }],
  membershipState = 'active',
  headShas = ['abc123'],
  prAuthor = 'mshanemc',
  prState = 'OPEN',
  prDraft = false
}) => {
  const directory = mkdtempSync(join(tmpdir(), 'ai-auto-approve-'));
  const eventPath = join(directory, 'event.json');
  writeFileSync(eventPath, JSON.stringify(event));
  try {
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
      const { workflows, checkRuns, reviews, comments, membershipState, headShas, prAuthor, prState, prDraft } =
        JSON.parse(process.env.MOCK_CHECKS);
      let pullReads = 0;
      const pull = () => ({
        reviewDecision: null,
        isDraft: prDraft,
        state: prState,
        baseRefName: 'develop',
        headRefOid: headShas[Math.min(pullReads++, headShas.length - 1)],
        author: { login: prAuthor },
        headRepository: { nameWithOwner: 'forcedotcom/salesforcedx-vscode' },
        baseRepository: { nameWithOwner: 'forcedotcom/salesforcedx-vscode' }
      });
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
        console.log('request', method, pathname + search);
        if (pathname === '/graphql') return response(url, { data: { repository: { pullRequest: pull() } } });
        if (pathname.endsWith('/actions/runs')) return pageResponse(url, workflows, 'workflow_runs');
        if (pathname.endsWith('/check-runs')) return pageResponse(url, checkRuns, 'check_runs');
        if (pathname.endsWith('/status')) return response(url, { statuses: [{ id: 1, context: 'security', state: 'success' }] });
        if (pathname.endsWith('/memberships/mshanemc')) return response(url, { state: membershipState });
        if (pathname.endsWith('/issues/8303/comments')) return response(url, comments);
        if (pathname.includes('/issues/comments/') && method === 'DELETE') return new Response(null, { status: 204 });
        if (pathname.endsWith('/pulls/8303/reviews')) return response(url, method === 'POST' ? {} : reviews);
        throw new Error('Unexpected API request: ' + pathname + ' ' + method + ' ' + String(requestBody ?? ''));
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
          GITHUB_EVENT_NAME: eventName,
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
          MOCK_CHECKS: JSON.stringify({
            workflows,
            checkRuns,
            reviews,
            comments,
            membershipState,
            headShas,
            prAuthor,
            prState,
            prDraft
          })
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

const requests = output =>
  output
    .split('\n')
    .filter(line => line.startsWith('request '))
    .map(line => line.slice(8));
const approvals = output => requests(output).filter(line => line.startsWith('POST ') && line.endsWith('/reviews'));
const deletions = output => requests(output).filter(line => line.startsWith('DELETE '));

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

test('CLI holds when the latest run for a workflow was cancelled', () => {
  const path = '.github/workflows/ci.yml';
  const workflows = [
    { id: 11, path, status: 'completed', conclusion: 'cancelled' },
    { id: 10, path, status: 'completed', conclusion: 'success' }
  ];
  const output = runCli({ workflows, checkRuns: [] });
  assert.match(output, /decision: hold \(CI is not green on head\)/);
  assert.equal(approvals(output).length, 0);
});

test('CLI sees a failing non-Actions check on the second page and holds', () => {
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
  assert.match(output, /decision: hold \(CI is not green on head\)/);
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
  assert.match(runCli({ workflows, checkRuns: [] }), /decision: hold \(CI is not green on head\)/);
});

test('CLI uses the latest check per app and name without merging apps', () => {
  const workflows = [{ id: 1, path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success' }];
  const checkRuns = [
    { id: 10, name: 'scan', app: { id: 42, slug: 'security' }, status: 'completed', conclusion: 'cancelled' },
    { id: 11, name: 'scan', app: { id: 42, slug: 'security' }, status: 'completed', conclusion: 'success' },
    { id: 12, name: 'scan', app: { id: 43, slug: 'credentials' }, status: 'completed', conclusion: 'failure' }
  ];
  assert.match(runCli({ workflows, checkRuns: checkRuns.slice(0, 2) }), /decision: approve \(gates passed\)/);
  assert.match(runCli({ workflows, checkRuns }), /decision: hold \(CI is not green on head\)/);
});

test('CLI includes a newer in-progress non-Actions check omitted by the default filter and holds', () => {
  const workflows = [{ id: 1, path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success' }];
  const checkRuns = [
    { id: 10, name: 'SAST', app: { id: 42, slug: 'security' }, status: 'completed', conclusion: 'success' },
    { id: 11, name: 'SAST', app: { id: 42, slug: 'security' }, status: 'in_progress', conclusion: null }
  ];
  const output = runCli({ workflows, checkRuns });
  assert.match(output, /\/check-runs\?.*filter=all/);
  assert.match(output, /decision: hold \(CI is not green on head\)/);
});

test('CLI keeps checks from different apps without slugs separate by app id', () => {
  const workflows = [{ id: 1, path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success' }];
  const checkRuns = [
    { id: 10, name: 'scan', app: { id: 42 }, status: 'completed', conclusion: 'failure' },
    { id: 11, name: 'scan', app: { id: 43 }, status: 'completed', conclusion: 'success' }
  ];
  assert.match(runCli({ workflows, checkRuns }), /decision: hold \(CI is not green on head\)/);
});

test('CLI holds when a check run has no app', () => {
  const workflows = [{ id: 1, path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success' }];
  const checkRuns = [{ id: 10, name: 'scan', app: null, status: 'completed', conclusion: 'success' }];
  assert.match(runCli({ workflows, checkRuns }), /decision: hold \(CI is not green on head\)/);
});

test('CLI skips when the bot already approved the head', () => {
  const reviews = [{ user: { login: 'svc-idee-bot' }, state: 'APPROVED', commit_id: 'abc123' }];
  const output = runCli({ reviews });
  assert.match(output, /decision: skip \(bot already approved this head\)/);
  assert.equal(approvals(output).length, 0);
});

test('issue_comment: immediate green approves at the current head', () => {
  const output = runCli({});
  assert.match(output, /decision: approve \(gates passed\)/);
  assert.deepEqual(approvals(output), ['POST /repos/forcedotcom/salesforcedx-vscode/pulls/8303/reviews']);
});

test('issue_comment: pending CI holds and posts no approval', () => {
  const output = runCli({
    workflows: [{ id: 1, path: '.github/workflows/ci.yml', status: 'in_progress', conclusion: null }]
  });
  assert.match(output, /decision: hold \(CI is not green on head\)/);
  assert.equal(approvals(output).length, 0);
  assert.equal(deletions(output).length, 0);
});

test('issue_comment: non-author skips, never holds', () => {
  const output = runCli({
    event: {
      comment: { user: { login: 'other' }, body: '/ai-auto approve' },
      issue: { number: 8303, pull_request: {} }
    },
    workflows: []
  });
  assert.match(output, /decision: skip \(commenter is not the pull request author\)/);
});

test('issue_comment: inactive member, draft, or closed skip, never hold', () => {
  assert.match(runCli({ membershipState: 'none', workflows: [] }), /decision: skip \(commenter is not an active/);
  assert.match(runCli({ prDraft: true, workflows: [] }), /decision: skip \(pull request is a draft\)/);
  assert.match(runCli({ prState: 'CLOSED', workflows: [] }), /decision: skip \(pull request is not open\)/);
});

test('check_suite: pending then same-SHA green approves; no second comment', () => {
  const event = { check_suite: { head_sha: 'abc123', pull_requests: [{ number: 8303 }] } };
  const pending = runCli({
    eventName: 'check_suite',
    event,
    workflows: [{ id: 1, path: '.github/workflows/ci.yml', status: 'in_progress', conclusion: null }]
  });
  assert.match(pending, /decision: hold \(CI is not green on head\)/);
  assert.equal(approvals(pending).length, 0);
  const green = runCli({ eventName: 'check_suite', event });
  assert.match(green, /decision: approve \(gates passed\)/);
  assert.equal(approvals(green).length, 1);
  assert.equal(deletions(green).length, 0);
});

test('check_suite: re-reads all checks on the head, not just the suite that completed', () => {
  const event = { check_suite: { head_sha: 'abc123', pull_requests: [{ number: 8303 }] } };
  const output = runCli({
    eventName: 'check_suite',
    event,
    checkRuns: [{ id: 10, name: 'SAST', app: { id: 42, slug: 'security' }, status: 'completed', conclusion: 'failure' }]
  });
  assert.match(output, /\/check-runs\?/);
  assert.match(output, /decision: hold \(CI is not green on head\)/);
  assert.equal(approvals(output).length, 0);
});

test('workflow_run: failed then same-SHA rerun green approves', () => {
  const event = { workflow_run: { head_sha: 'abc123', pull_requests: [{ number: 8303 }] } };
  const failed = runCli({
    eventName: 'workflow_run',
    event,
    workflows: [{ id: 1, path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'failure' }]
  });
  assert.match(failed, /decision: hold \(CI is not green on head\)/);
  assert.equal(approvals(failed).length, 0);
  const rerun = runCli({
    eventName: 'workflow_run',
    event,
    workflows: [{ id: 2, path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success' }]
  });
  assert.match(rerun, /decision: approve \(gates passed\)/);
  assert.equal(approvals(rerun).length, 1);
});

test('check/workflow completion for an old SHA never approves the new head', () => {
  const event = { workflow_run: { head_sha: 'abc123', pull_requests: [{ number: 8303 }] } };
  const output = runCli({ eventName: 'workflow_run', event, headShas: ['new-sha'] });
  assert.equal(approvals(output).length, 0);
  assert.match(output, /decision: skip \(#8303 head is not abc123\)/);
  assert.equal(requests(output).filter(line => line.includes('/issues/8303/comments')).length, 0);
});

test('head moves between decision and approve POST: no approval on the stale SHA', () => {
  const event = { check_suite: { head_sha: 'abc123', pull_requests: [{ number: 8303 }] } };
  // read 1: onChecksComplete head match. read 2: pre-approve guard, head already moved.
  const output = runCli({ eventName: 'check_suite', event, headShas: ['abc123', 'new-sha'] });
  assert.equal(approvals(output).length, 0);
  assert.match(output, /decision: skip \(#8303 head moved before approve\)/);
});

test('check_suite: non-author comment or none on PR: skip, no approve, no hold', () => {
  const event = { check_suite: { head_sha: 'abc123', pull_requests: [{ number: 8303 }] } };
  const output = runCli({
    eventName: 'check_suite',
    event,
    comments: [{ id: 9, user: { login: 'other' }, body: '/ai-auto approve' }]
  });
  assert.match(output, /decision: skip \(no author \/ai-auto approve on #8303\)/);
  assert.equal(approvals(output).length, 0);
});

test('check_suite: author comment is not standalone, skip', () => {
  const event = { check_suite: { head_sha: 'abc123', pull_requests: [{ number: 8303 }] } };
  const output = runCli({
    eventName: 'check_suite',
    event,
    comments: [{ id: 9, user: { login: 'mshanemc' }, body: '/ai-auto approve please' }]
  });
  assert.match(output, /decision: skip \(no author \/ai-auto approve on #8303\)/);
});

test('synchronize: deletes only author standalone comments, posts no review', () => {
  const output = runCli({
    eventName: 'pull_request_target',
    event: { action: 'synchronize', pull_request: { number: 8303 } },
    comments: [
      { id: 10, user: { login: 'mshanemc' }, body: '/ai-auto approve' },
      { id: 11, user: { login: 'other' }, body: '/ai-auto approve' },
      { id: 12, user: { login: 'mshanemc' }, body: '/ai-auto approve please' },
      { id: 13, user: { login: 'mshanemc' }, body: '/ai-auto approve\n' }
    ],
    reviews: [{ id: 99, user: { login: 'svc-idee-bot' }, state: 'APPROVED', commit_id: 'abc123' }]
  });
  assert.deepEqual(deletions(output), [
    'DELETE /repos/forcedotcom/salesforcedx-vscode/issues/comments/10',
    'DELETE /repos/forcedotcom/salesforcedx-vscode/issues/comments/13'
  ]);
  assert.equal(approvals(output).length, 0);
  assert.equal(
    requests(output).some(line => line.includes('/dismissals')),
    false
  );
});

test('synchronize: pull_request_target with other action is a no-op', () => {
  const output = runCli({
    eventName: 'pull_request_target',
    event: { action: 'opened', pull_request: { number: 8303 } }
  });
  assert.equal(deletions(output).length, 0);
  assert.equal(approvals(output).length, 0);
});

test('unhandled event name skips without API calls', () => {
  const output = runCli({ eventName: 'push', event: {} });
  assert.match(output, /decision: skip \(unhandled event push\)/);
  assert.equal(requests(output).length, 0);
});
