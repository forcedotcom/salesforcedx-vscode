/**
 * Gates for `/ai-auto approve` → svc-idee-bot APPROVE.
 * Pure: no GitHub I/O. Workflow supplies facts; this decides skip vs approve.
 */

import { allGitHubChecksSuccessful, findApprovedReviewOnHead } from '@salesforce/effect-octokit';

const APPROVE_TOKEN = '/ai-auto approve';
export const TEAM_SLUG = 'ide-experience';
export const TEAM_ORG = 'forcedotcom';
export const BOT_LOGIN = 'svc-idee-bot';

/** Standalone `/ai-auto approve` — whole body, optional trailing whitespace/newlines only. */
export const isStandaloneAiAutoApprove = body => String(body ?? '').trim() === APPROVE_TOKEN;

/**
 * @returns {{ action: 'skip' | 'approve', reason: string }}
 */
export const decideAiAutoApprove = input => {
  if (!input.isPullRequestComment) return { action: 'skip', reason: 'not a pull request comment' };
  if (!isStandaloneAiAutoApprove(input.commentBody)) {
    return { action: 'skip', reason: 'comment is not standalone /ai-auto approve' };
  }
  if (!input.commenterLogin || input.commenterLogin !== input.prAuthorLogin) {
    return { action: 'skip', reason: 'commenter is not the pull request author' };
  }
  if (input.teamMembershipState !== 'active') {
    return { action: 'skip', reason: 'commenter is not an active @forcedotcom/ide-experience member' };
  }
  if (String(input.prState ?? '').toLowerCase() !== 'open') {
    return { action: 'skip', reason: 'pull request is not open' };
  }
  if (input.prDraft) return { action: 'skip', reason: 'pull request is a draft' };
  if (!input.headSha) return { action: 'skip', reason: 'missing head sha' };
  if (!allGitHubChecksSuccessful(input.checks)) return { action: 'skip', reason: 'CI is not green on head' };
  if (findApprovedReviewOnHead(input.reviews, input.headSha, input.botLogin ?? BOT_LOGIN)) {
    return { action: 'skip', reason: 'bot already approved this head' };
  }
  return { action: 'approve', reason: 'gates passed' };
};
