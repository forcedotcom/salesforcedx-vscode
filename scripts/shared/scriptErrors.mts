import * as Schema from 'effect/Schema';

export class GitError extends Schema.TaggedError<GitError>()('GitError', {
  message: Schema.String
}) {}
