/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { GitHub, GitHubEvent, PullRequest } from '@salesforce/effect-octokit';
import type * as Effect from 'effect/Effect';
import {
  BASE_BRANCH,
  BOT_LOGIN,
  TEAM_ORG,
  TEAM_SLUG,
  type Facts,
  decideCategoryApprove,
  skipFiles,
  skipMembership,
  skipPull,
  withoutOwnRun
} from './categoryGates.mts';

type GitHubService = typeof GitHub.Service;
type Result<K extends 'pullsForCommit' | 'pullFiles' | 'pullReviews' | 'checkRuns' | 'combinedStatus'> =
  Effect.Effect.Success<ReturnType<GitHubService[K]>>;
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

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Read-only GitHub client usable before pnpm install and by the approval command. */
export const createCategoryReads = (token: string) => {
  const request = async (path: string, body?: object): Promise<Response> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(`https://api.github.com${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000)
      });
      if (response.ok || (path.includes('/memberships/') && response.status === 404)) return response;
      const retryAfter = response.headers.get('retry-after');
      const remaining = response.headers.get('x-ratelimit-remaining');
      if (attempt === 0 && (response.status === 429 || remaining === '0' || retryAfter !== null)) {
        const reset = response.headers.get('x-ratelimit-reset');
        const millis =
          retryAfter !== null ? Number(retryAfter) * 1000 : reset !== null ? Number(reset) * 1000 - Date.now() : 1000;
        await wait(Number.isFinite(millis) ? Math.max(0, Math.min(millis, 60_000)) : 1000);
        continue;
      }
      throw new Error(`${path}: ${response.status} ${await response.text()}`);
    }
    throw new Error(`${path}: retry exhausted`);
  };

  // The GitHub response type is supplied by each read method; no runtime client is available to preflight.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const get = async <T,>(path: string, body?: object): Promise<T> => (await (await request(path, body)).json()) as T;

  const paginate = async <T,>(path: string, field?: string): Promise<T[]> => {
    const response = await request(path);
    const next = response.headers.get('link')?.match(/<([^>]+)>; rel="next"/)?.[1];
    const body: unknown = await response.json();
    const items: unknown =
      field === undefined ? body : body !== null && typeof body === 'object' ? Reflect.get(body, field) : undefined;
    if (!Array.isArray(items)) throw new Error(`${path}: expected a list`);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const page = items as T[];
    if (next === undefined) return page;
    const url = new URL(next);
    return [...page, ...(await paginate<T>(url.pathname + url.search, field))];
  };

  return {
    pullsForCommit: (owner: string, repo: string, sha: string) =>
      paginate<Result<'pullsForCommit'>[number]>(`/repos/${owner}/${repo}/commits/${sha}/pulls?per_page=100`),
    pullRequest: async (owner: string, repo: string, number: number) => {
      const result = await get<{
        data?: { repository?: { pullRequest?: typeof PullRequest.Type | null } | null };
        errors?: unknown[];
      }>('/graphql', { query: pullQuery, variables: { owner, name: repo, number } });
      if (result.errors?.length) throw new Error(`GraphQL: ${JSON.stringify(result.errors)}`);
      return result.data?.repository?.pullRequest ?? undefined;
    },
    pullFiles: (owner: string, repo: string, number: number) =>
      paginate<Result<'pullFiles'>[number]>(`/repos/${owner}/${repo}/pulls/${number}/files?per_page=100`),
    pullReviews: (owner: string, repo: string, number: number) =>
      paginate<Result<'pullReviews'>[number]>(`/repos/${owner}/${repo}/pulls/${number}/reviews?per_page=100`),
    checks: async (owner: string, repo: string, sha: string, runId: string) => {
      const root = `/repos/${owner}/${repo}/commits/${sha}`;
      const [combined, runs] = await Promise.all([
        get<Result<'combinedStatus'>>(`${root}/status?per_page=100`),
        paginate<Result<'checkRuns'>[number]>(`${root}/check-runs?per_page=100`, 'check_runs')
      ]);
      return { statuses: combined.statuses, checkRuns: withoutOwnRun(runs, runId) };
    },
    teamMembership: async (login: string) => {
      const response = await request(`/orgs/${TEAM_ORG}/teams/${TEAM_SLUG}/memberships/${login}`);
      if (response.status === 404) return 'none';
      const membership: unknown = await response.json();
      if (
        membership === null ||
        typeof membership !== 'object' ||
        !('state' in membership) ||
        typeof membership.state !== 'string'
      ) {
        throw new Error('invalid team membership response');
      }
      return membership.state;
    }
  };
};

type CategoryReads = ReturnType<typeof createCategoryReads>;

export const categoryPullNumbers = async (reads: CategoryReads, event: GitHubEvent, owner: string, repo: string) => {
  if ('pull_request' in event) {
    return [event.pull_request.number];
  }
  const checks = 'check_run' in event ? event.check_run : event.check_suite;
  const listed = (checks.pull_requests ?? []).map(pull => pull.number);
  if (listed.length > 0) return listed;
  const sha = checks.head_sha;
  if (sha === undefined) return [];
  return (await reads.pullsForCommit(owner, repo, sha))
    .filter(pull => pull.base?.ref === BASE_BRANCH && pull.state === 'open')
    .map(pull => pull.number)
    .filter(Number.isFinite);
};

/** Stop reading as soon as a shared gate skips the pull request. */
export const readCategoryFacts = async (
  reads: CategoryReads,
  owner: string,
  repo: string,
  number: number,
  runId: string
) => {
  const pull = await reads.pullRequest(owner, repo, number);
  const facts: Facts = {
    pull,
    files: [],
    reviews: [],
    statuses: [],
    checkRuns: [],
    teamMembershipState: 'active',
    botLogin: BOT_LOGIN
  };
  const early = skipPull(pull);
  if (early !== undefined) return { facts, decision: early };

  const files = await reads.pullFiles(owner, repo, number);
  const withFiles = { ...facts, files };
  const fileDecision = skipFiles(files);
  if (fileDecision !== undefined) {
    return { facts: withFiles, decision: fileDecision };
  }

  const teamMembershipState = pull?.author?.login ? await reads.teamMembership(pull.author.login) : 'none';
  const withMembership = { ...withFiles, teamMembershipState };
  const membershipDecision = skipMembership(teamMembershipState);
  if (membershipDecision !== undefined) {
    return { facts: withMembership, decision: membershipDecision };
  }

  const [reviews, checks] = await Promise.all([
    reads.pullReviews(owner, repo, number),
    reads.checks(owner, repo, pull?.headRefOid ?? '', runId)
  ]);
  const complete: Facts = { ...withMembership, reviews, ...checks };
  return { facts: complete, decision: decideCategoryApprove(complete) };
};
