import * as Schema from 'effect/Schema';

export class GitError extends Schema.TaggedError<GitError>()('GitError', {
  message: Schema.String
}) {}

export class AgentError extends Schema.TaggedError<AgentError>()('AgentError', {
  message: Schema.String
}) {}
