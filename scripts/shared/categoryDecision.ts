import { isNullable, isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';

export const MODEL = 'grok-4.7-xhigh';
export const BASE_BRANCH = 'develop';
export const BOT_LOGIN = 'svc-idee-bot';
export const TEAM_ORG = 'forcedotcom';
export const TEAM_SLUG = 'ide-experience';

const FAIL_CONCLUSIONS = new Set(['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ERROR', 'ACTION_REQUIRED', 'STARTUP_FAILURE']);

const RUNNING = new Set(['IN_PROGRESS', 'QUEUED', 'PENDING', 'WAITING', 'REQUESTED', 'EXPECTED']);

const DENYLIST = [
  /(^|\/)CODEOWNERS$/,
  /^APPROVAL_POLICY\.md$/,
  /^\.github\/workflows\/.+/,
  /^\.cursor\/rules\/.+/,
  /^\.cursor\/commands\/.+/,
  /(^|\/)out\//
];

class Skip extends Schema.TaggedClass<Skip>()('Skip', { reason: Schema.String }) {}
class Classify extends Schema.TaggedClass<Classify>()('Classify', { reason: Schema.String }) {}
class Approve extends Schema.TaggedClass<Approve>()('Approve', {
  reason: Schema.String,
  categories: Schema.Array(Schema.String)
}) {}
class Dismiss extends Schema.TaggedClass<Dismiss>()('Dismiss', { reason: Schema.String }) {}

export type Decision = Skip | Classify | Approve | Dismiss;

export type Check = {
  readonly name?: string;
  readonly status?: string;
  readonly conclusion?: string | null;
  readonly state?: string;
  readonly detailsUrl?: string;
};

export type Review = {
  readonly id?: number;
  readonly authorLogin?: string;
  readonly state?: string;
  readonly commitOid?: string;
};

export type Facts = {
  readonly isPullRequest: boolean;
  readonly baseRef?: string;
  readonly prState?: string;
  readonly prDraft: boolean;
  readonly reviewDecision?: string | null;
  readonly authorLogin?: string;
  readonly teamMembershipState?: string;
  readonly headRepoFullName?: string;
  readonly baseRepoFullName?: string;
  readonly headSha?: string;
  readonly files: ReadonlyArray<string>;
  readonly checks: ReadonlyArray<Check>;
  readonly reviews: ReadonlyArray<Review>;
  readonly categories?: ReadonlyArray<string>;
  readonly allowedCategories?: ReadonlyArray<string>;
  readonly botLogin?: string;
};

const outcome = (check: Check) => String(check.conclusion ?? check.state ?? 'PENDING').toUpperCase();
const status = (check: Check) => String(check.status ?? '').toUpperCase();

const isCheckGreen = (check: Check) => {
  const concluded = outcome(check);
  return (
    !FAIL_CONCLUSIONS.has(concluded) &&
    !RUNNING.has(status(check)) &&
    !RUNNING.has(concluded) &&
    (concluded === 'SUCCESS' || concluded === 'SKIPPED' || concluded === 'NEUTRAL')
  );
};

const allChecksGreen = (checks: ReadonlyArray<Check>) => checks.length > 0 && checks.every(isCheckGreen);

const hasFailingCheck = (checks: ReadonlyArray<Check>) => checks.some(check => FAIL_CONCLUSIONS.has(outcome(check)));

const hasBotApprovalOnHead = (reviews: ReadonlyArray<Review>, headSha: string, botLogin: string) =>
  reviews.some(
    review => review.authorLogin === botLogin && review.state === 'APPROVED' && review.commitOid === headSha
  );

export const categoryIdsFromPolicy = (markdown: string) =>
  [...markdown.matchAll(/^### ([a-z0-9-]+)\s*$/gm)].map(match => match[1] ?? '');

export const deniedFile = (files: ReadonlyArray<string>) =>
  files.find(file => DENYLIST.some(pattern => pattern.test(file)));

export const withoutOwnRun = (checks: ReadonlyArray<Check>, runId: string | undefined) =>
  checks.filter(check => isUndefined(runId) || !String(check.detailsUrl ?? '').includes(`/actions/runs/${runId}/`));

export const buildPrompt = (policy: string, diffPath: string) =>
  `${policy}\n\nThe diff file is ${diffPath}. Read that file and no other file. Reply with only the JSON object.`;

const AgentCategories = Schema.Struct({ categories: Schema.Array(Schema.String) });

export const parseAgentResult = (stdout: string): ReadonlyArray<string> | undefined => {
  const text = stdout.trim();
  const envelope = (() => {
    try {
      return JSON.parse(text) as { result?: string };
    } catch {
      return undefined;
    }
  })();
  const body = typeof envelope?.result === 'string' ? envelope.result : text;
  const match = body.match(/\{[\s\S]*"categories"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/);
  if (isNullable(match)) return undefined;
  const parsed = (() => {
    try {
      return JSON.parse(match[0]) as unknown;
    } catch {
      return undefined;
    }
  })();
  if (isUndefined(parsed)) return undefined;
  const decoded = Schema.decodeUnknownOption(AgentCategories)(parsed);
  return decoded._tag === 'Some' ? decoded.value.categories : undefined;
};

export const decideCategoryApprove = (input: Facts): Decision => {
  if (!input.isPullRequest) return new Skip({ reason: 'not a pull request' });
  if (input.baseRef !== BASE_BRANCH) return new Skip({ reason: 'base branch is not develop' });
  if (input.prState !== 'open') return new Skip({ reason: 'pull request is not open' });
  if (input.prDraft) return new Skip({ reason: 'pull request is a draft' });
  if (input.reviewDecision === 'CHANGES_REQUESTED') return new Skip({ reason: 'review is CHANGES_REQUESTED' });
  if (input.authorLogin === 'dependabot[bot]') return new Skip({ reason: 'author is dependabot' });
  if (isUndefined(input.headRepoFullName) || input.headRepoFullName !== input.baseRepoFullName) {
    return new Skip({ reason: 'pull request is from a fork' });
  }
  if (input.teamMembershipState !== 'active') {
    return new Skip({ reason: 'author is not an active @forcedotcom/ide-experience member' });
  }
  if (isUndefined(input.headSha) || input.headSha.length === 0) return new Skip({ reason: 'missing head sha' });
  const denied = deniedFile(input.files);
  if (!isUndefined(denied)) return new Skip({ reason: `denylist ${denied}` });
  const botLogin = input.botLogin ?? BOT_LOGIN;
  const approved = hasBotApprovalOnHead(input.reviews, input.headSha, botLogin);
  if (hasFailingCheck(input.checks) && approved) return new Dismiss({ reason: 'a check failed after approval' });
  if (!allChecksGreen(input.checks)) return new Skip({ reason: 'rollup is not settled' });
  if (approved) return new Skip({ reason: 'bot already approved this head' });
  if (isUndefined(input.categories)) return new Classify({ reason: 'gates passed' });
  const allowed = new Set(input.allowedCategories ?? []);
  if (input.categories.length === 0) return new Skip({ reason: 'no covering categories' });
  const unknown = input.categories.find(category => !allowed.has(category));
  if (!isUndefined(unknown)) return new Skip({ reason: `unknown category ${unknown}` });
  return new Approve({ reason: input.categories.join(', '), categories: [...input.categories] });
};
