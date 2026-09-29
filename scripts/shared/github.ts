import { Duration } from 'effect';
import * as Config from 'effect/Config';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';

export class GitHubRequestError extends Schema.TaggedError<GitHubRequestError>()('GitHubRequestError', {
  message: Schema.String,
  status: Schema.Number,
  method: Schema.String,
  path: Schema.String
}) {}

export class GitError extends Schema.TaggedError<GitError>()('GitError', {
  message: Schema.String
}) {}

export class AgentError extends Schema.TaggedError<AgentError>()('AgentError', {
  message: Schema.String
}) {}

type Json = unknown;

const timeout = Duration.toMillis(Duration.seconds(30));

export class GitHub extends Effect.Service<GitHub>()('GitHub', {
  accessors: true,
  effect: Effect.gen(function* () {
    const token = yield* Config.string('IDEE_GH_TOKEN');

    const request = Effect.fn('GitHub.request')(function* (method: string, path: string, body?: Json) {
      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(`https://api.github.com${path}`, {
            method,
            signal: AbortSignal.timeout(timeout),
            headers: {
              Accept: 'application/vnd.github+json',
              Authorization: `Bearer ${token}`,
              'X-GitHub-Api-Version': '2022-11-28',
              ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
            },
            body: body === undefined ? undefined : JSON.stringify(body)
          }),
        catch: cause =>
          new GitHubRequestError({
            message: cause instanceof Error ? cause.message : String(cause),
            status: 0,
            method,
            path
          })
      });
      const text = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: cause =>
          new GitHubRequestError({
            message: cause instanceof Error ? cause.message : String(cause),
            status: response.status,
            method,
            path
          })
      });
      const json = text.length === 0 ? {} : (JSON.parse(text) as { message?: string });
      if (!response.ok) {
        return yield* Effect.fail(
          new GitHubRequestError({
            message: json.message ?? text,
            status: response.status,
            method,
            path
          })
        );
      }
      return json as Json;
    });

    const listAll: (path: string, page: number) => Effect.Effect<ReadonlyArray<Json>, GitHubRequestError> = Effect.fn(
      'GitHub.listAll'
    )(function* (path: string, page: number) {
      const separator = path.includes('?') ? '&' : '?';
      const batch = (yield* request('GET', `${path}${separator}per_page=100&page=${page}`)) as ReadonlyArray<Json>;
      return batch.length < 100 ? batch : [...batch, ...(yield* listAll(path, page + 1))];
    });

    return { request, listAll };
  })
}) {}
