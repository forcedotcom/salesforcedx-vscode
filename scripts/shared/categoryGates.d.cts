import type { CheckRun, CommitStatus, PullFile, PullRequest, PullReview } from '@salesforce/effect-octokit';

export declare const BASE_BRANCH: 'develop';
export declare const BOT_LOGIN: 'svc-idee-bot';

export type PreClassifyFacts = {
  readonly pull: typeof PullRequest.Type | undefined;
  readonly files: ReadonlyArray<PullFile>;
  readonly statuses: ReadonlyArray<CommitStatus>;
  readonly checkRuns: ReadonlyArray<CheckRun>;
  readonly reviews: ReadonlyArray<PullReview>;
  readonly teamMembershipState: string;
  readonly botLogin: string;
};

export declare const deniedFile: (files: ReadonlyArray<PullFile>) => string | undefined;
export declare const preClassifyPull: (
  pull: PreClassifyFacts['pull'],
  teamMembershipState: string
) => { readonly _tag: 'Skip'; readonly reason: string } | undefined;
export declare const preClassifyFiles: (
  files: PreClassifyFacts['files']
) => { readonly _tag: 'Skip'; readonly reason: string } | undefined;
export declare const preClassifyDecision: (
  input: PreClassifyFacts
) =>
  | { readonly _tag: 'Skip'; readonly reason: string }
  | { readonly _tag: 'Dismiss'; readonly reason: string }
  | { readonly _tag: 'Classify'; readonly reason: string };
