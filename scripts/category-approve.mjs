/**
 * Gates for category approve → svc-idee-bot APPROVE.
 * Pure: no GitHub I/O. The workflow supplies facts; this decides skip, classify, approve, or dismiss.
 */

import { allChecksGreen, hasBotApprovalOnHead } from './ai-auto-approve.mjs';

export const MODEL = 'grok-4.7-xhigh';
export const BASE_BRANCH = 'develop';

const FAIL_CONCLUSIONS = new Set(['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ERROR', 'ACTION_REQUIRED', 'STARTUP_FAILURE']);

const DENYLIST = [
  /(^|\/)CODEOWNERS$/,
  /^APPROVAL_POLICY\.md$/,
  /^\.github\/workflows\/.+/,
  /^\.cursor\/rules\/.+/,
  /^\.cursor\/commands\/.+/,
  /(^|\/)out\//
];

export const categoryIdsFromPolicy = markdown =>
  [...String(markdown ?? '').matchAll(/^### ([a-z0-9-]+)\s*$/gm)].map(match => match[1]);

export const deniedFile = files => (files ?? []).find(file => DENYLIST.some(pattern => pattern.test(file)));

const hasFailingCheck = checks =>
  (checks ?? []).some(check => FAIL_CONCLUSIONS.has(String(check.conclusion ?? check.state ?? '').toUpperCase()));

export const withoutOwnRun = (checks, runId) =>
  (checks ?? []).filter(check => !runId || !String(check.detailsUrl ?? '').includes(`/actions/runs/${runId}/`));

/**
 * Prompt for the classifier. The diff file is the only case. No PR title or body.
 */
export const buildPrompt = ({ policy, diffPath }) =>
  `${policy}\n\nThe diff file is ${diffPath}. Read that file and no other file. Reply with only the JSON object.`;

export const parseAgentResult = stdout => {
  const text = String(stdout ?? '').trim();
  const envelope = (() => {
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  })();
  const body = typeof envelope?.result === 'string' ? envelope.result : text;
  const match = body.match(/\{[\s\S]*"categories"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/);
  if (!match) return undefined;
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed.categories) ? parsed.categories.map(category => String(category)) : undefined;
  } catch {
    return undefined;
  }
};

const skip = reason => ({ action: 'skip', reason });

/**
 * @returns {{ action: 'skip' | 'classify' | 'approve' | 'dismiss', reason: string }}
 */
export const decideCategoryApprove = input => {
  if (!input.isPullRequest) return skip('not a pull request');
  if (input.baseRef !== BASE_BRANCH) return skip('base branch is not develop');
  if (input.prState !== 'open') return skip('pull request is not open');
  if (input.prDraft) return skip('pull request is a draft');
  if (input.reviewDecision === 'CHANGES_REQUESTED') return skip('review is CHANGES_REQUESTED');
  if (input.authorLogin === 'dependabot[bot]') return skip('author is dependabot');
  if (!input.headRepoFullName || input.headRepoFullName !== input.baseRepoFullName)
    return skip('pull request is from a fork');
  if (input.teamMembershipState !== 'active') return skip('author is not an active @forcedotcom/ide-experience member');
  if (!input.headSha) return skip('missing head sha');
  const denied = deniedFile(input.files);
  if (denied) return skip(`denylist ${denied}`);
  const botLogin = input.botLogin;
  const approved = hasBotApprovalOnHead(input.reviews ?? [], input.headSha, botLogin);
  if (hasFailingCheck(input.checks) && approved) return { action: 'dismiss', reason: 'a check failed after approval' };
  if (!allChecksGreen(input.checks ?? [])) return skip('rollup is not settled');
  if (approved) return skip('bot already approved this head');
  if (input.categories === undefined) return { action: 'classify', reason: 'gates passed' };
  const allowed = new Set(input.allowedCategories ?? []);
  const categories = input.categories;
  if (!Array.isArray(categories) || categories.length === 0) return skip('no covering categories');
  const unknown = categories.find(category => !allowed.has(category));
  if (unknown) return skip(`unknown category ${unknown}`);
  return { action: 'approve', reason: categories.join(', ') };
};
