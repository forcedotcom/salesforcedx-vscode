/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as FileSystem from '@effect/platform/FileSystem';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';

const PullRequestNumber = Schema.Struct({ number: Schema.Number });
const CheckPayload = Schema.Struct({
  name: Schema.optional(Schema.String),
  head_sha: Schema.optional(Schema.String),
  pull_requests: Schema.Array(PullRequestNumber).pipe(Schema.optional)
});

const CheckEventSchema = Schema.Struct({
  action: Schema.optional(Schema.String),
  check_run: Schema.optional(CheckPayload),
  check_suite: Schema.optional(CheckPayload),
  pull_request: Schema.optional(PullRequestNumber)
});

const IssueCommentEventSchema = Schema.Struct({
  comment: Schema.NullOr(
    Schema.Struct({
      body: Schema.NullOr(Schema.String).pipe(Schema.optional),
      user: Schema.NullOr(Schema.Struct({ login: Schema.NullOr(Schema.String).pipe(Schema.optional) })).pipe(
        Schema.optional
      )
    })
  ).pipe(Schema.optional),
  issue: Schema.NullOr(Schema.Struct({ number: Schema.Number, pull_request: Schema.optional(Schema.Unknown) })).pipe(
    Schema.optional
  )
});

const PullRequestEventSchema = Schema.Struct({ pull_request: PullRequestNumber });

export type CheckEvent = typeof CheckEventSchema.Type;

/** Read and validate the JSON payload at GITHUB_EVENT_PATH. */
const readActionsEvent = Effect.fn('GitHub.readActionsEvent')(function* <A, I>(
  eventPath: string,
  schema: Schema.Schema<A, I>
) {
  return yield* FileSystem.FileSystem.pipe(
    Effect.flatMap(fs => fs.readFileString(eventPath)),
    Effect.flatMap(Schema.decodeUnknown(Schema.parseJson(schema)))
  );
});

export const readCheckEvent = (eventPath: string) => readActionsEvent(eventPath, CheckEventSchema);
export const readIssueCommentEvent = (eventPath: string) => readActionsEvent(eventPath, IssueCommentEventSchema);
export const readPullRequestEvent = (eventPath: string) => readActionsEvent(eventPath, PullRequestEventSchema);
