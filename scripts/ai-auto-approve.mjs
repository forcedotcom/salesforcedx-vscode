/**
 * Gates for `/ai-auto approve` → svc-idee-bot APPROVE.
 * Pure: no GitHub I/O. Workflow supplies facts; this decides skip vs approve.
 */

const APPROVE_TOKEN = '/ai-auto approve';
export const TEAM_SLUG = 'ide-experience';
export const TEAM_ORG = 'forcedotcom';
export const BOT_LOGIN = 'svc-idee-bot';

/** Standalone `/ai-auto approve` — whole body, optional trailing whitespace/newlines only. */
export const isStandaloneAiAutoApprove = body =>
  new RegExp(`^${APPROVE_TOKEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`).test(String(body ?? '').trim());

const FAIL_CONCLUSIONS = new Set(['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ERROR', 'ACTION_REQUIRED', 'STARTUP_FAILURE']);

const RUNNING = new Set(['IN_PROGRESS', 'QUEUED', 'PENDING', 'WAITING', 'REQUESTED', 'EXPECTED']);

const outcome = check => String(check.conclusion ?? check.state ?? 'PENDING').toUpperCase();
const status = check => String(check.status ?? '').toUpperCase();

const isCheckGreen = check => {
  const o = outcome(check);
  if (FAIL_CONCLUSIONS.has(o)) return false;
  if (RUNNING.has(status(check)) || RUNNING.has(o)) return false;
  return o === 'SUCCESS' || o === 'SKIPPED' || o === 'NEUTRAL';
};

export const allChecksGreen = checks => checks.length > 0 && checks.every(isCheckGreen);

export const hasBotApprovalOnHead = (reviews, headSha, botLogin = BOT_LOGIN) =>
  Boolean(headSha) &&
  reviews.some(
    review => review.authorLogin === botLogin && review.state === 'APPROVED' && review.commitOid === headSha
  );

/**
 * @returns {{ action: 'skip' | 'approve', reason: string }}
 */
export const decideAiAutoApprove = input => {
  if (!input.isPullRequestComment) return { action: 'skip', reason: 'not a pull request comment' };
  if (!isStandaloneAiAutoApprove(input.commentBody)) {
    return { action: 'skip', reason: 'comment is not standalone /ai-auto approve' };
  }
  if (input.commenterLogin !== input.prAuthorLogin) {
    return { action: 'skip', reason: 'commenter is not the pull request author' };
  }
  if (input.teamMembershipState !== 'active') {
    return { action: 'skip', reason: 'commenter is not an active @forcedotcom/ide-experience member' };
  }
  if (input.prState !== 'open') return { action: 'skip', reason: 'pull request is not open' };
  if (input.prDraft) return { action: 'skip', reason: 'pull request is a draft' };
  if (!input.headSha) return { action: 'skip', reason: 'missing head sha' };
  if (!allChecksGreen(input.checks)) return { action: 'skip', reason: 'CI is not green on head' };
  if (hasBotApprovalOnHead(input.reviews, input.headSha, input.botLogin ?? BOT_LOGIN)) {
    return { action: 'skip', reason: 'bot already approved this head' };
  }
  return { action: 'approve', reason: 'gates passed' };
};
