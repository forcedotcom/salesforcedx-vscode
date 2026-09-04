import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allChecksGreen,
  decideAiAutoApprove,
  hasBotApprovalOnHead,
  isStandaloneAiAutoApprove
} from '../scripts/ai-auto-approve.mjs';

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

test('skips when bot already approved this head', () => {
  const reviews = [{ authorLogin: 'svc-idee-bot', state: 'APPROVED', commitOid: 'abc123' }];
  assert.equal(hasBotApprovalOnHead(reviews, 'abc123'), true);
  assert.equal(hasBotApprovalOnHead(reviews, 'other'), false);
  assert.equal(decideAiAutoApprove({ ...base, reviews }).action, 'skip');
});
