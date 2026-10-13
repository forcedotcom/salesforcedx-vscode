import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allChecksGreen,
  authorStandaloneAiAutoComments,
  decideAiAutoApprove,
  extraPages,
  hasBotApprovalOnHead,
  isStandaloneAiAutoApprove,
  throughTotal
} from '../scripts/ai-auto-approve.mjs';
import { handleAiAutoApproveEvent } from '../scripts/ai-auto-approve-cli.mjs';

const green = { status: 'completed', conclusion: 'SUCCESS' };
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

test('holds when CI is empty, pending, or failed', () => {
  assert.equal(allChecksGreen([]), false);
  assert.deepEqual(decideAiAutoApprove({ ...base, checks: [] }), {
    action: 'hold',
    reason: 'CI is not green on head'
  });
  assert.equal(
    decideAiAutoApprove({ ...base, checks: [{ status: 'in_progress', conclusion: null }] }).action,
    'hold'
  );
  assert.equal(
    decideAiAutoApprove({ ...base, checks: [{ status: 'completed', conclusion: 'FAILURE' }] }).action,
    'hold'
  );
});

test('identity failures stay skip when CI is not green', () => {
  const pending = { ...base, checks: [] };
  assert.equal(decideAiAutoApprove({ ...pending, commenterLogin: 'other' }).action, 'skip');
  assert.equal(decideAiAutoApprove({ ...pending, teamMembershipState: 'none' }).action, 'skip');
  assert.equal(decideAiAutoApprove({ ...pending, prDraft: true }).action, 'skip');
  assert.equal(decideAiAutoApprove({ ...pending, prState: 'closed' }).action, 'skip');
});

test('treats skipped and neutral as green', () => {
  assert.equal(allChecksGreen([{ status: 'completed', conclusion: 'SKIPPED' }]), true);
  assert.equal(allChecksGreen([{ status: 'completed', conclusion: 'NEUTRAL' }]), true);
});

test('same head approves once checks are green and the bot has not approved it', () => {
  assert.equal(decideAiAutoApprove(base).action, 'approve');
  const reviews = [{ authorLogin: 'svc-idee-bot', state: 'APPROVED', commitOid: 'abc123' }];
  assert.equal(hasBotApprovalOnHead(reviews, 'abc123'), true);
  assert.equal(hasBotApprovalOnHead(reviews, 'other'), false);
  assert.equal(decideAiAutoApprove({ ...base, reviews }).action, 'skip');
});

test('selector returns only the author exact comments', () => {
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

test('check pages continue until total_count', () => {
  assert.deepEqual(extraPages(0), []);
  assert.deepEqual(extraPages(100), []);
  assert.deepEqual(extraPages(101), [2]);
  assert.deepEqual(extraPages(250), [2, 3]);
  const items = Array.from({ length: 250 }, (_, index) => ({ index }));
  assert.equal(throughTotal(items, 101).length, 101);
  assert.equal(throughTotal(items, 101)[100].index, 100);
  assert.equal(throughTotal(items, 250).length, 250);
});

const pullPath = '/repos/forcedotcom/vscode/pulls/42';
const commentsPath = '/repos/forcedotcom/vscode/issues/42/comments';
const authorComment = { id: 10, user: { login: 'mshanemc' }, body: '/ai-auto approve' };

const withGitHub = (
  t,
  { checks = [green], comments = [authorComment], headShas = ['abc123'], reviews = [] } = {}
) => {
  const requests = [];
  let pullReads = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const path = new URL(url).pathname;
    const method = options.method;
    const body = options.body && JSON.parse(options.body);
    requests.push({ method, path, body });
    if (method === 'DELETE' && path.startsWith('/repos/forcedotcom/vscode/issues/comments/')) {
      return new Response(null, { status: 204 });
    }
    if (method === 'POST' && path === `${pullPath}/reviews`) {
      return Response.json({ id: 99 });
    }
    if (method !== 'GET') throw new Error(`Unexpected ${method} ${path}`);
    if (path === pullPath) {
      const headSha = headShas[Math.min(pullReads++, headShas.length - 1)];
      return Response.json({ head: { sha: headSha }, user: { login: 'mshanemc' }, state: 'open', draft: false });
    }
    if (path === commentsPath) return Response.json(comments);
    if (path === `${pullPath}/reviews`) return Response.json(reviews);
    if (path === '/orgs/forcedotcom/teams/ide-experience/memberships/mshanemc') {
      return Response.json({ state: 'active' });
    }
    if (path === '/repos/forcedotcom/vscode/commits/abc123/status') {
      return Response.json({ total_count: 0, statuses: [] });
    }
    if (path === '/repos/forcedotcom/vscode/commits/abc123/check-runs') {
      return Response.json({
        total_count: checks.length,
        check_runs: checks.map((check, index) => ({ name: `check ${index}`, ...check }))
      });
    }
    throw new Error(`Unexpected ${method} ${path}`);
  });
  return requests;
};

const runEvent = (eventName, event) =>
  handleAiAutoApproveEvent({ token: 'test-token', owner: 'forcedotcom', repo: 'vscode', eventName, event });

const approvals = requests => requests.filter(request => request.method === 'POST');

test('issue_comment accepts standalone whitespace and approves the current head', async t => {
  const requests = withGitHub(t);
  await runEvent('issue_comment', {
    issue: { number: 42, pull_request: {} },
    comment: { user: { login: 'mshanemc' }, body: '/ai-auto approve\n' }
  });
  assert.deepEqual(approvals(requests), [
    {
      method: 'POST',
      path: `${pullPath}/reviews`,
      body: {
        commit_id: 'abc123',
        event: 'APPROVE',
        body: 'Approved by svc-idee-bot after `/ai-auto approve` from the PR author (@forcedotcom/ide-experience).'
      }
    }
  ]);
});

test('synchronize deletes only author standalone comments, without dismissing reviews', async t => {
  const requests = withGitHub(t, {
    comments: [
      authorComment,
      { id: 11, user: { login: 'other' }, body: '/ai-auto approve' },
      { id: 12, user: { login: 'mshanemc' }, body: '/ai-auto approve please' },
      { id: 13, user: { login: 'mshanemc' }, body: '/ai-auto approve\n' }
    ]
  });
  await runEvent('pull_request_target', {
    action: 'synchronize',
    pull_request: { number: 42, user: { login: 'mshanemc' } }
  });
  assert.deepEqual(
    requests.filter(request => request.method !== 'GET').map(request => [request.method, request.path]).sort(),
    [
      ['DELETE', '/repos/forcedotcom/vscode/issues/comments/10'],
      ['DELETE', '/repos/forcedotcom/vscode/issues/comments/13']
    ]
  );
  assert.equal(requests.some(request => request.path.includes('/reviews')), false);
});

test('workflow_run rechecks all checks and approves after a same-SHA failed rerun turns green', async t => {
  const checks = [green, { status: 'completed', conclusion: 'FAILURE' }];
  const requests = withGitHub(t, { checks });
  const event = { workflow_run: { head_sha: 'abc123', pull_requests: [{ number: 42 }] } };
  await runEvent('workflow_run', event);
  assert.equal(approvals(requests).length, 0);
  checks[1] = green;
  await runEvent('workflow_run', event);
  assert.equal(approvals(requests).length, 1);
  assert.equal(approvals(requests)[0].body.commit_id, 'abc123');
  assert.equal(requests.filter(request => request.path.includes('/check-runs')).length, 2);
});

test('check_suite completion rechecks pending checks and approves when they turn green', async t => {
  const checks = [green, { status: 'in_progress', conclusion: null }];
  const requests = withGitHub(t, { checks });
  const event = { check_suite: { head_sha: 'abc123', pull_requests: [{ number: 42 }] } };
  await runEvent('check_suite', event);
  assert.equal(approvals(requests).length, 0);
  checks[1] = green;
  await runEvent('check_suite', event);
  assert.equal(approvals(requests).length, 1);
});

test('completed checks for an old SHA do not read comments or approve a new head', async t => {
  const requests = withGitHub(t, { headShas: ['new-sha'] });
  await runEvent('workflow_run', { workflow_run: { head_sha: 'abc123', pull_requests: [{ number: 42 }] } });
  assert.deepEqual(requests.map(request => request.path), [pullPath]);
});

test('head moving before review submission skips approval', async t => {
  const requests = withGitHub(t, { headShas: ['abc123', 'new-sha'] });
  await runEvent('check_suite', { check_suite: { head_sha: 'abc123', pull_requests: [{ number: 42 }] } });
  assert.equal(approvals(requests).length, 0);
  assert.equal(requests.filter(request => request.path === pullPath).length, 2);
});
