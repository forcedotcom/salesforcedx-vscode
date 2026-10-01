/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

const PullRequestNumber = Schema.Struct({
  number: Schema.Number.pipe(Schema.int())
});

const CheckPayload = Schema.Struct({
  name: Schema.optional(Schema.String),
  head_sha: Schema.optional(Schema.String),
  pull_requests: Schema.optional(Schema.Array(PullRequestNumber))
});

/** GitHub Actions event payload variants supported by this package. See GitHub's webhook payload docs and add variants as consumers need them. */
export const CheckRunEvent = Schema.Struct({
  action: Schema.Literal('completed'),
  check_run: CheckPayload
});

export const CheckSuiteEvent = Schema.Struct({
  action: Schema.Literal('completed'),
  check_suite: CheckPayload
});

export const PullRequestEvent = Schema.Struct({
  action: Schema.Literal('opened', 'ready_for_review', 'reopened', 'edited'),
  pull_request: PullRequestNumber
});

export const PullRequestReviewEvent = Schema.Struct({
  action: Schema.Literal('submitted', 'dismissed'),
  pull_request: PullRequestNumber,
  review: Schema.Struct({ state: Schema.String })
});

/** Add a schema to this union when a consumer needs another GitHub event type. */
export const GitHubEvent = Schema.Union(CheckRunEvent, CheckSuiteEvent, PullRequestEvent, PullRequestReviewEvent);

export type GitHubEvent = Schema.Schema.Type<typeof GitHubEvent>;
