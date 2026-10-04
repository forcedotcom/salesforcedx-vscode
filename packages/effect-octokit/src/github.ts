/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Octokit } from '@octokit/core';
import type { GraphqlResponseError } from '@octokit/graphql';
import { paginateRest } from '@octokit/plugin-paginate-rest';
import type { RequestError } from '@octokit/request-error';
import { type Endpoints } from '@octokit/types';
import * as Config from 'effect/Config';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { isError } from 'effect/Predicate';
import * as Redacted from 'effect/Redacted';
import * as Schema from 'effect/Schema';

export { actionsEnvironment } from './actionsEnvironment.js';

const PaginatedOctokit = Octokit.plugin(paginateRest);
const requestTimeout = Duration.toMillis(Duration.seconds(30));
const maxRateLimitWait = Duration.toMillis(Duration.seconds(60));

export class GitHubRequestError extends Schema.TaggedError<GitHubRequestError>()('GitHubRequestError', {
  message: Schema.String,
  status: Schema.Number,
  method: Schema.String,
  path: Schema.String,
  retryAfterMillis: Schema.optional(Schema.Number)
}) {}

export const PullRequest = Schema.Struct({
  reviewDecision: Schema.NullOr(Schema.String),
  isDraft: Schema.Boolean,
  state: Schema.String,
  baseRefName: Schema.String,
  headRefOid: Schema.String,
  author: Schema.NullOr(Schema.Struct({ login: Schema.String })),
  headRepository: Schema.NullOr(Schema.Struct({ nameWithOwner: Schema.String })),
  baseRepository: Schema.NullOr(Schema.Struct({ nameWithOwner: Schema.String }))
});

const PullRequestQuery = Schema.Struct({
  repository: Schema.NullOr(Schema.Struct({ pullRequest: Schema.NullOr(PullRequest) }))
});

const pullQuery = `query($owner:String!,$name:String!,$number:Int!){
  repository(owner:$owner,name:$name){
    pullRequest(number:$number){
      reviewDecision isDraft state baseRefName headRefOid
      author { login }
      headRepository { nameWithOwner }
      baseRepository { nameWithOwner }
    }
  }
}`;

const header = (headers: RequestError['response'], name: string) => {
  const value = headers?.headers[name];
  return typeof value === 'string' ? value : undefined;
};

// Octokit and Vitest can load separate copies of these error classes, so use their stable fields.
const isRequestError = (cause: unknown): cause is RequestError =>
  isError(cause) &&
  cause.name === 'HttpError' &&
  'request' in cause &&
  'status' in cause &&
  typeof cause.status === 'number';

const isGraphqlResponseError = (cause: unknown): cause is GraphqlResponseError<unknown> =>
  isError(cause) && cause.name === 'GraphqlResponseError' && 'errors' in cause && Array.isArray(cause.errors);

/** GitHub primary limits use remaining=0; secondary limits send retry-after. */
const retryAfterMillis = (cause: unknown) => {
  if (!isRequestError(cause)) return undefined;
  const retryAfter = header(cause.response, 'retry-after');
  const remaining = header(cause.response, 'x-ratelimit-remaining');
  const reset = header(cause.response, 'x-ratelimit-reset');
  if (cause.status !== 429 && remaining !== '0' && retryAfter === undefined) return undefined;
  const millis =
    retryAfter !== undefined
      ? Number(retryAfter) * 1000
      : reset !== undefined
        ? Math.max(0, Number(reset) * 1000 - Date.now())
        : 1000;
  return Number.isFinite(millis) ? Math.min(millis, maxRateLimitWait) : 1000;
};

const toError = (method: string, path: string, cause: unknown) => {
  const wait = retryAfterMillis(cause);
  return new GitHubRequestError({
    message: isError(cause) ? cause.message : String(cause),
    status: isRequestError(cause) ? cause.status : isGraphqlResponseError(cause) ? 200 : 0,
    method,
    path,
    ...(wait === undefined ? {} : { retryAfterMillis: wait })
  });
};

const run = <A>(method: string, path: string, request: () => Promise<A>) => {
  const once = Effect.tryPromise({
    try: request,
    catch: (cause: unknown) => toError(method, path, cause)
  });
  return once.pipe(
    Effect.catchTag('GitHubRequestError', error =>
      error.retryAfterMillis === undefined
        ? Effect.fail(error)
        : Effect.sleep(Duration.millis(error.retryAfterMillis)).pipe(Effect.andThen(once))
    )
  );
};

export class GitHub extends Effect.Service<GitHub>()('GitHub', {
  accessors: true,
  effect: Effect.gen(function* () {
    const token = yield* Config.redacted('IDEE_GH_TOKEN').pipe(Config.orElse(() => Config.redacted('GITHUB_TOKEN')));
    const octokit = new PaginatedOctokit({
      auth: Redacted.value(token),
      userAgent: 'salesforcedx-vscode',
      request: {
        timeout: requestTimeout,
        headers: {
          accept: 'application/vnd.github+json',
          'x-github-api-version': '2022-11-28'
        }
      }
    });

    const request = Effect.fn('GitHub.request')(function* (route: string, parameters?: Record<string, unknown>) {
      const method = route.slice(0, route.indexOf(' '));
      return yield* run(method, route, () => octokit.request(route, parameters ?? {}).then(response => response.data));
    });

    const graphql = Effect.fn('GitHub.graphql')(function* (query: string, variables?: Record<string, unknown>) {
      return yield* run('POST', '/graphql', () => octokit.graphql(query, variables ?? {}));
    });

    const paginate = Effect.fn('GitHub.paginate')(function* <A>(route: string, parameters?: Record<string, unknown>) {
      return yield* run(route.slice(0, route.indexOf(' ')), route, () =>
        octokit.paginate<A>(route, { per_page: 100, ...parameters })
      );
    });

    const teamMembership = Effect.fn('GitHub.teamMembership')(function* (org: string, team: string, login: string) {
      return yield* run('GET', `/orgs/${org}/teams/${team}/memberships/${login}`, () =>
        octokit
          .request('GET /orgs/{org}/teams/{team_slug}/memberships/{username}', {
            org,
            team_slug: team,
            username: login
          })
          .then(response => response.data)
      ).pipe(
        Effect.map(membership => membership.state),
        Effect.catchTag('GitHubRequestError', error =>
          error.status === 404 ? Effect.succeed('none') : Effect.fail(error)
        )
      );
    });

    const pullFiles = Effect.fn('GitHub.pullFiles')(function* (owner: string, repo: string, pullNumber: number) {
      return yield* run('GET', `/repos/${owner}/${repo}/pulls/${pullNumber}/files`, () =>
        octokit.paginate('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
          owner,
          repo,
          pull_number: pullNumber,
          per_page: 100
        })
      );
    });

    const pullReviews = Effect.fn('GitHub.pullReviews')(function* (owner: string, repo: string, pullNumber: number) {
      return yield* run('GET', `/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, () =>
        octokit.paginate('GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
          owner,
          repo,
          pull_number: pullNumber,
          per_page: 100
        })
      );
    });

    const checkRuns = Effect.fn('GitHub.checkRuns')(function* (owner: string, repo: string, sha: string) {
      return yield* run('GET', `/repos/${owner}/${repo}/commits/${sha}/check-runs`, () =>
        octokit.paginate('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', {
          owner,
          repo,
          ref: sha,
          per_page: 100
        })
      );
    });

    const combinedStatus = Effect.fn('GitHub.combinedStatus')(function* (owner: string, repo: string, sha: string) {
      return yield* run('GET', `/repos/${owner}/${repo}/commits/${sha}/status`, () =>
        octokit
          .request('GET /repos/{owner}/{repo}/commits/{ref}/status', { owner, repo, ref: sha, per_page: 100 })
          .then(response => response.data)
      );
    });

    const createReview = Effect.fn('GitHub.createReview')(function* (
      owner: string,
      repo: string,
      pullNumber: number,
      headSha: string,
      event: Endpoints['POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews']['parameters']['event'],
      body: string
    ) {
      yield* run('POST', `/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, () =>
        octokit
          .request('POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
            owner,
            repo,
            pull_number: pullNumber,
            commit_id: headSha,
            event,
            body
          })
          .then(() => undefined)
      );
    });

    const dismissReview = Effect.fn('GitHub.dismissReview')(function* (
      owner: string,
      repo: string,
      pullNumber: number,
      reviewId: number,
      message: string
    ) {
      yield* run('PUT', `/repos/${owner}/${repo}/pulls/${pullNumber}/reviews/${reviewId}/dismissals`, () =>
        octokit
          .request('PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/dismissals', {
            owner,
            repo,
            pull_number: pullNumber,
            review_id: reviewId,
            message,
            event: 'DISMISS'
          })
          .then(() => undefined)
      );
    });

    const pullsForCommit = Effect.fn('GitHub.pullsForCommit')(function* (owner: string, repo: string, sha: string) {
      const pulls = yield* run('GET', `/repos/${owner}/${repo}/commits/${sha}/pulls`, () =>
        octokit.paginate('GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls', {
          owner,
          repo,
          commit_sha: sha,
          per_page: 100
        })
      );
      return pulls;
    });

    const pullBody = Effect.fn('GitHub.pullBody')(function* (owner: string, repo: string, pullNumber: number) {
      return yield* run('GET', `/repos/${owner}/${repo}/pulls/${pullNumber}`, () =>
        octokit
          .request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
            owner,
            repo,
            pull_number: pullNumber
          })
          .then(response => response.data.body ?? '')
      );
    });

    const updatePullBody = Effect.fn('GitHub.updatePullBody')(function* (
      owner: string,
      repo: string,
      pullNumber: number,
      body: string
    ) {
      yield* run('PATCH', `/repos/${owner}/${repo}/pulls/${pullNumber}`, () =>
        octokit
          .request('PATCH /repos/{owner}/{repo}/pulls/{pull_number}', {
            owner,
            repo,
            pull_number: pullNumber,
            body
          })
          .then(() => undefined)
      );
    });

    const pullRequest = Effect.fn('GitHub.pullRequest')(function* (owner: string, repo: string, pullNumber: number) {
      const data = yield* run('POST', '/graphql', () =>
        octokit.graphql(pullQuery, { owner, name: repo, number: pullNumber })
      );
      const decoded = yield* Schema.decodeUnknown(PullRequestQuery)(data).pipe(
        Effect.mapError(
          error =>
            new GitHubRequestError({
              message: error.message,
              status: 200,
              method: 'POST',
              path: '/graphql'
            })
        )
      );
      return decoded.repository?.pullRequest ?? undefined;
    });

    return {
      request,
      graphql,
      paginate,
      teamMembership,
      pullFiles,
      pullReviews,
      checkRuns,
      combinedStatus,
      createReview,
      dismissReview,
      pullsForCommit,
      pullBody,
      updatePullBody,
      pullRequest
    };
  })
}) {}
