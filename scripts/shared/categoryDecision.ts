import type { Endpoints } from '@octokit/types';
import { PullRequest } from '@salesforce/effect-octokit';
import * as Option from 'effect/Option';
import { isNull, isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';

export const MODEL = 'grok-4.7-xhigh';
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

const Skip = Schema.TaggedStruct('Skip', { reason: Schema.String });
const Classify = Schema.TaggedStruct('Classify', { reason: Schema.String });
const Approve = Schema.TaggedStruct('Approve', {
  reason: Schema.String,
  categories: Schema.Array(Schema.String)
});
const Dismiss = Schema.TaggedStruct('Dismiss', { reason: Schema.String });

export type Decision = typeof Skip.Type | typeof Classify.Type | typeof Approve.Type | typeof Dismiss.Type;

type PullReview = Endpoints['GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews']['response']['data'][number];
type CommitStatus = Endpoints['GET /repos/{owner}/{repo}/commits/{ref}/status']['response']['data']['statuses'][number];
type CheckRun =
  Endpoints['GET /repos/{owner}/{repo}/commits/{ref}/check-runs']['response']['data']['check_runs'][number];
type PullFile = Endpoints['GET /repos/{owner}/{repo}/pulls/{pull_number}/files']['response']['data'][number];

type SharedFacts = {
  readonly pull: typeof PullRequest.Type | undefined;
  readonly files: ReadonlyArray<PullFile>;
  readonly statuses: ReadonlyArray<CommitStatus>;
  readonly checkRuns: ReadonlyArray<CheckRun>;
  readonly reviews: ReadonlyArray<PullReview>;
  readonly teamMembershipState: string;
  readonly botLogin: string;
};

type GatedFacts = SharedFacts & {
  readonly categories: ReadonlyArray<string>;
  readonly allowedCategories: ReadonlyArray<string>;
};

export type Facts = (SharedFacts & { readonly categories?: undefined }) | GatedFacts;

const isGated = (input: Facts): input is GatedFacts => !isUndefined(input.categories);

const settled = (concluded: string, phase: string) =>
  !FAIL_CONCLUSIONS.has(concluded) &&
  !RUNNING.has(phase) &&
  !RUNNING.has(concluded) &&
  (concluded === 'success' || concluded === 'skipped' || concluded === 'neutral');

const runConclusion = (run: CheckRun) => run.conclusion ?? 'pending';

const allChecksGreen = (statuses: ReadonlyArray<CommitStatus>, runs: ReadonlyArray<CheckRun>) =>
  statuses.length + runs.length > 0 &&
  statuses.every(entry => settled(entry.state, '')) &&
  runs.every(run => settled(runConclusion(run), run.status));

const hasFailingCheck = (statuses: ReadonlyArray<CommitStatus>, runs: ReadonlyArray<CheckRun>) =>
  statuses.some(entry => FAIL_CONCLUSIONS.has(entry.state)) ||
  runs.some(run => FAIL_CONCLUSIONS.has(runConclusion(run)));

const hasBotApprovalOnHead = (reviews: ReadonlyArray<PullReview>, headSha: string, botLogin: string) =>
  reviews.some(
    review => review.user?.login === botLogin && review.state === 'APPROVED' && review.commit_id === headSha
  );

export const categoryIdsFromPolicy = (markdown: string) =>
  [...markdown.matchAll(/^### ([a-z0-9-]+)\s*$/gm)].map(match => match[1] ?? '');

export const deniedFile = (files: ReadonlyArray<PullFile>) =>
  files.map(file => file.filename).find(filename => DENYLIST.some(pattern => pattern.test(filename)));

export const withoutOwnRun = (runs: ReadonlyArray<CheckRun>, runId: string) =>
  runs.filter(run => !(run.details_url ?? run.html_url ?? '').includes(`/actions/runs/${runId}/`));

export const buildPrompt = (policy: string, diffPath: string) =>
  `${policy}\n\nThe diff file is ${diffPath}. Read that file and no other file. Reply with only the JSON object.`;

const AgentEnvelope = Schema.Struct({ result: Schema.optional(Schema.String) });
const AgentCategories = Schema.Struct({ categories: Schema.Array(Schema.String) });

export const parseAgentResult = (stdout: string): ReadonlyArray<string> | undefined => {
  const body = Option.match(Schema.decodeUnknownOption(Schema.parseJson(AgentEnvelope))(stdout), {
    onNone: () => stdout,
    onSome: ({ result }) => result ?? stdout
  });
  const extracted = body.match(/\{[\s\S]*"categories"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/)?.[0];
  if (isUndefined(extracted)) return undefined;
  return Option.match(Schema.decodeUnknownOption(Schema.parseJson(AgentCategories))(extracted), {
    onNone: () => undefined,
    onSome: decoded => decoded.categories
  });
};

export const decideCategoryApprove = (input: Facts): Decision => {
  const { pull } = input;
  if (isUndefined(pull)) return Skip.make({ reason: 'not a pull request' });
  if (pull.baseRefName !== BASE_BRANCH) return Skip.make({ reason: 'base branch is not develop' });
  if (pull.state.toLowerCase() !== 'open') return Skip.make({ reason: 'pull request is not open' });
  if (pull.isDraft) return Skip.make({ reason: 'pull request is a draft' });
  if (pull.reviewDecision === 'CHANGES_REQUESTED') return Skip.make({ reason: 'review is CHANGES_REQUESTED' });
  if (pull.author?.login === 'dependabot[bot]') return Skip.make({ reason: 'author is dependabot' });
  if (isNull(pull.headRepository) || pull.headRepository.nameWithOwner !== pull.baseRepository?.nameWithOwner) {
    return Skip.make({ reason: 'pull request is from a fork' });
  }
  if (input.teamMembershipState !== 'active') {
    return Skip.make({ reason: 'author is not an active @forcedotcom/ide-experience member' });
  }
  if (!Schema.is(Schema.NonEmptyString)(pull.headRefOid)) return Skip.make({ reason: 'missing head sha' });
  const denied = deniedFile(input.files);
  if (!isUndefined(denied)) return Skip.make({ reason: `denylist ${denied}` });
  const approved = hasBotApprovalOnHead(input.reviews, pull.headRefOid, input.botLogin);
  if (hasFailingCheck(input.statuses, input.checkRuns) && approved) {
    return Dismiss.make({ reason: 'a check failed after approval' });
  }
  if (!allChecksGreen(input.statuses, input.checkRuns)) return Skip.make({ reason: 'rollup is not settled' });
  if (approved) return Skip.make({ reason: 'bot already approved this head' });
  if (!isGated(input)) return Classify.make({ reason: 'gates passed' });
  const allowed = new Set(input.allowedCategories);
  if (input.categories.length === 0) return Skip.make({ reason: 'no covering categories' });
  const unknown = input.categories.find(category => !allowed.has(category));
  if (!isUndefined(unknown)) return Skip.make({ reason: `unknown category ${unknown}` });
  return Approve.make({ reason: input.categories.join(', '), categories: [...input.categories] });
};
