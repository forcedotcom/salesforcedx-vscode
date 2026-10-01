/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { GitHub, PullRequest } from '@salesforce/effect-octokit';
import type * as Effect from 'effect/Effect';

export const BASE_BRANCH = 'develop';
export const BOT_LOGIN = 'svc-idee-bot';
export const TEAM_ORG = 'forcedotcom';
export const TEAM_SLUG = 'ide-experience';

const FAIL_CONCLUSIONS = new Set(['failure', 'cancelled', 'timed_out', 'error', 'action_required', 'startup_failure']);
const RUNNING = new Set(['in_progress', 'queued', 'pending', 'waiting', 'requested', 'expected']);

const DENYLIST = [
  /(^|\/)CODEOWNERS$/,
  /^APPROVAL_POLICY\.md$/,
  /^\.github\/workflows\/.+/,
  /^\.cursor\/rules\/.+/,
  /^\.cursor\/commands\/.+/,
  /(^|\/)out\//
];

type GitHubService = typeof GitHub.Service;
type PullReview = Effect.Effect.Success<ReturnType<GitHubService['pullReviews']>>[number];
type CommitStatus = Effect.Effect.Success<ReturnType<GitHubService['combinedStatus']>>['statuses'][number];
type CheckRun = Effect.Effect.Success<ReturnType<GitHubService['checkRuns']>>[number];
type PullFile = Effect.Effect.Success<ReturnType<GitHubService['pullFiles']>>[number];

type SharedFacts = {
  readonly pull: typeof PullRequest.Type | undefined;
  readonly files: readonly PullFile[];
  readonly statuses: readonly CommitStatus[];
  readonly checkRuns: readonly CheckRun[];
  readonly reviews: readonly PullReview[];
  readonly teamMembershipState: string;
  readonly botLogin: string;
};

type GatedFacts = SharedFacts & {
  readonly categories: readonly string[];
  readonly allowedCategories: readonly string[];
};

export type Facts = (SharedFacts & { readonly categories?: undefined }) | GatedFacts;

export type Decision =
  | { readonly _tag: 'Skip'; readonly reason: string }
  | { readonly _tag: 'Classify'; readonly reason: string }
  | { readonly _tag: 'Approve'; readonly reason: string; readonly categories: readonly string[] }
  | { readonly _tag: 'Dismiss'; readonly reason: string };

const settled = (concluded: string, phase: string) =>
  !FAIL_CONCLUSIONS.has(concluded) &&
  !RUNNING.has(phase) &&
  !RUNNING.has(concluded) &&
  (concluded === 'success' || concluded === 'skipped' || concluded === 'neutral');

const runConclusion = (run: CheckRun) => run.conclusion ?? 'pending';

const allChecksGreen = (statuses: readonly CommitStatus[], runs: readonly CheckRun[]) =>
  statuses.length + runs.length > 0 &&
  statuses.every(entry => settled(entry.state, '')) &&
  runs.every(run => settled(runConclusion(run), run.status));

const hasFailingCheck = (statuses: readonly CommitStatus[], runs: readonly CheckRun[]) =>
  statuses.some(entry => FAIL_CONCLUSIONS.has(entry.state)) ||
  runs.some(run => FAIL_CONCLUSIONS.has(runConclusion(run)));

const hasBotApprovalOnHead = (reviews: readonly PullReview[], headSha: string, botLogin: string) =>
  reviews.some(
    review => review.user?.login === botLogin && review.state === 'APPROVED' && review.commit_id === headSha
  );

export const deniedFile = (files: readonly PullFile[]) =>
  files.map(file => file.filename).find(filename => DENYLIST.some(pattern => pattern.test(filename)));

export const withoutOwnRun = (runs: readonly CheckRun[], runId: string) =>
  runs.filter(run => !(run.details_url ?? run.html_url ?? '').includes(`/actions/runs/${runId}/`));

export const skipPull = (pull: Facts['pull']): Decision | undefined => {
  if (pull === undefined) return { _tag: 'Skip', reason: 'not a pull request' };
  if (pull.baseRefName !== BASE_BRANCH) return { _tag: 'Skip', reason: 'base branch is not develop' };
  if (pull.state.toLowerCase() !== 'open') return { _tag: 'Skip', reason: 'pull request is not open' };
  if (pull.isDraft) return { _tag: 'Skip', reason: 'pull request is a draft' };
  if (pull.reviewDecision === 'CHANGES_REQUESTED') return { _tag: 'Skip', reason: 'review is CHANGES_REQUESTED' };
  if (pull.author?.login === 'dependabot[bot]') return { _tag: 'Skip', reason: 'author is dependabot' };
  if (pull.headRepository === null || pull.headRepository.nameWithOwner !== pull.baseRepository?.nameWithOwner) {
    return { _tag: 'Skip', reason: 'pull request is from a fork' };
  }
  if (!pull.headRefOid) return { _tag: 'Skip', reason: 'missing head sha' };
  return undefined;
};

export const skipFiles = (files: Facts['files']): Decision | undefined => {
  const denied = deniedFile(files);
  return denied === undefined ? undefined : { _tag: 'Skip', reason: `denylist ${denied}` };
};

export const skipMembership = (state: string): Decision | undefined =>
  state === 'active'
    ? undefined
    : { _tag: 'Skip', reason: 'author is not an active @forcedotcom/ide-experience member' };

export const decideCategoryApprove = (input: Facts): Decision => {
  const skipped = skipPull(input.pull) ?? skipFiles(input.files) ?? skipMembership(input.teamMembershipState);
  if (skipped !== undefined) return skipped;
  const pull = input.pull!;
  const approved = hasBotApprovalOnHead(input.reviews, pull.headRefOid, input.botLogin);
  if (hasFailingCheck(input.statuses, input.checkRuns) && approved) {
    return { _tag: 'Dismiss', reason: 'a check failed after approval' };
  }
  if (!allChecksGreen(input.statuses, input.checkRuns)) return { _tag: 'Skip', reason: 'rollup is not settled' };
  if (approved) return { _tag: 'Skip', reason: 'bot already approved this head' };
  if (input.categories === undefined) return { _tag: 'Classify', reason: 'gates passed' };
  const allowed = new Set(input.allowedCategories);
  if (input.categories.length === 0) return { _tag: 'Skip', reason: 'no covering categories' };
  const unknown = input.categories.find(category => !allowed.has(category));
  if (unknown !== undefined) return { _tag: 'Skip', reason: `unknown category ${unknown}` };
  return { _tag: 'Approve', reason: input.categories.join(', '), categories: [...input.categories] };
};
