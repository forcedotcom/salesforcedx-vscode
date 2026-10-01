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

const CheckRunPayload = Schema.Struct({
  name: Schema.optional(Schema.String),
  head_sha: Schema.optional(Schema.String),
  pull_requests: PullRequestNumber.pipe(Schema.Array, Schema.optional)
});

const CheckSuitePayload = Schema.Struct({
  head_sha: Schema.optional(Schema.String),
  pull_requests: PullRequestNumber.pipe(Schema.Array, Schema.optional)
});

export const CheckRunEvent = Schema.Struct({
  action: Schema.Literal('completed'),
  check_run: CheckRunPayload
});

export const CheckSuiteEvent = Schema.Struct({
  action: Schema.Literal('completed'),
  check_suite: CheckSuitePayload
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

/**
 * Supported GitHub Actions event payloads. Add variants as consumers need them.
 * https://docs.github.com/en/webhooks-and-events/webhooks/webhook-events-and-payloads
 */
export const GitHubEvent = Schema.Union(CheckRunEvent, CheckSuiteEvent, PullRequestEvent, PullRequestReviewEvent);

export type GitHubEventType = Schema.Schema.Type<typeof GitHubEvent>;
