#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Config from 'effect/Config';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import { isUndefined } from 'effect/Predicate';
import { AgentError, GitError, GitHub, GitHubRequestError } from './shared/github.ts';
import {
  BASE_BRANCH,
  BOT_LOGIN,
  MODEL,
  TEAM_ORG,
  TEAM_SLUG,
  type Decision,
  type Review,
  buildPrompt,
  categoryIdsFromPolicy,
  decideCategoryApprove,
  parseAgentResult,
  withoutOwnRun
} from './shared/categoryDecision.ts';

const gitText = (args: ReadonlyArray<string>) =>
  Effect.try({
    try: () => {
      const result = spawnSync('git', args, { encoding: 'utf8' });
      if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`);
      return result.stdout;
    },
    catch: cause => new GitError({ message: cause instanceof Error ? cause.message : String(cause) })
  });

const record = (value: Json): Record<string, Json> =>
  typeof value === 'object' && value !== null ? (value as Record<string, Json>) : {};

type Json = unknown;

const stringField = (value: Json, key: string) => {
  const field = record(value)[key];
  return typeof field === 'string' ? field : undefined;
};

const teamMembership = Effect.fn('categoryApprove.teamMembership')(function* (login: string) {
  const github = yield* GitHub;
  return yield* github.request('GET', `/orgs/${TEAM_ORG}/teams/${TEAM_SLUG}/memberships/${login}`).pipe(
    Effect.map(body => stringField(body, 'state') ?? 'none'),
    Effect.catchTag('GitHubRequestError', error => (error.status === 404 ? Effect.succeed('none') : Effect.fail(error)))
  );
});

const listFiles = Effect.fn('categoryApprove.listFiles')(function* (owner: string, repo: string, pullNumber: number) {
  const github = yield* GitHub;
  const files = yield* github.listAll(`/repos/${owner}/${repo}/pulls/${pullNumber}/files`, 1);
  return files.flatMap(file => {
    const name = stringField(file, 'filename');
    return isUndefined(name) ? [] : [name];
  });
});

const listReviews = Effect.fn('categoryApprove.listReviews')(function* (
  owner: string,
  repo: string,
  pullNumber: number
) {
  const github = yield* GitHub;
  const reviews = yield* github.listAll(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, 1);
  return reviews.map((review: Json) => {
    const id = record(review).id;
    return {
      id: typeof id === 'number' ? id : undefined,
      authorLogin: stringField(record(review).user, 'login'),
      state: stringField(review, 'state'),
      commitOid: stringField(review, 'commit_id')
    };
  });
});

const listCheckRuns: (
  owner: string,
  repo: string,
  headSha: string,
  page: number
) => Effect.Effect<ReadonlyArray<Json>, GitHubRequestError, GitHub> = Effect.fn('categoryApprove.listCheckRuns')(
  function* (owner: string, repo: string, headSha: string, page: number) {
    const github = yield* GitHub;
    const body = record(
      yield* github.request('GET', `/repos/${owner}/${repo}/commits/${headSha}/check-runs?per_page=100&page=${page}`)
    );
    const runs = Array.isArray(body.check_runs) ? body.check_runs : [];
    return runs.length < 100 ? runs : [...runs, ...(yield* listCheckRuns(owner, repo, headSha, page + 1))];
  }
);

const listChecks = Effect.fn('categoryApprove.listChecks')(function* (
  owner: string,
  repo: string,
  headSha: string,
  runId: string | undefined
) {
  const github = yield* GitHub;
  const combined = record(yield* github.request('GET', `/repos/${owner}/${repo}/commits/${headSha}/status`));
  const runs = yield* listCheckRuns(owner, repo, headSha, 1);
  const statuses = (Array.isArray(combined.statuses) ? combined.statuses : []).map(status => ({
    name: stringField(status, 'context'),
    state: stringField(status, 'state'),
    conclusion: stringField(status, 'state'),
    detailsUrl: stringField(status, 'target_url')
  }));
  const checks = runs.map((run: Json) => ({
    name: stringField(run, 'name'),
    status: stringField(run, 'status'),
    conclusion: stringField(run, 'conclusion') ?? null,
    detailsUrl: stringField(run, 'details_url') ?? stringField(run, 'html_url')
  }));
  return withoutOwnRun([...statuses, ...checks], runId);
});

const pullFacts = Effect.fn('categoryApprove.pullFacts')(function* (owner: string, repo: string, pullNumber: number) {
  const github = yield* GitHub;
  const body = record(
    yield* github.request('POST', '/graphql', {
      query: `query($owner:String!,$name:String!,$number:Int!){
        repository(owner:$owner,name:$name){
          pullRequest(number:$number){
            reviewDecision isDraft state baseRefName headRefOid
            author { login }
            headRepository { nameWithOwner }
            baseRepository { nameWithOwner }
          }
        }
      }`,
      variables: { owner, name: repo, number: pullNumber }
    })
  );
  return record(record(record(body.data).repository).pullRequest);
});

const classify = Effect.fn('categoryApprove.classify')(function* (policy: string, diffPath: string) {
  const apiKey = yield* Config.string('CURSOR_API_KEY');
  const path = yield* Config.string('PATH');
  const home = yield* Config.string('HOME');
  const stdout = yield* Effect.async<string, AgentError>(resume => {
    const child = spawn('agent', ['-p', '--model', MODEL, '--output-format', 'json', buildPrompt(policy, diffPath)], {
      env: { PATH: `${home}/.local/bin:${path}`, HOME: home, CURSOR_API_KEY: apiKey },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on('data', chunk => out.push(chunk));
    child.stderr.on('data', chunk => err.push(chunk));
    child.on('error', cause => resume(Effect.fail(new AgentError({ message: String(cause) }))));
    child.on('close', code => {
      const stderr = Buffer.concat(err).toString();
      resume(
        code === 0
          ? Effect.succeed(Buffer.concat(out).toString())
          : Effect.fail(new AgentError({ message: `agent exited ${code}: ${stderr}` }))
      );
    });
  });
  return parseAgentResult(stdout);
});

const approve = Effect.fn('categoryApprove.approve')(function* (
  owner: string,
  repo: string,
  pullNumber: number,
  headSha: string,
  categories: ReadonlyArray<string>
) {
  const github = yield* GitHub;
  yield* github.request('POST', `/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, {
    commit_id: headSha,
    event: 'APPROVE',
    body: `Category union: ${categories.join(', ')}. Judged from the diff.`
  });
  yield* Effect.log(`approved ${owner}/${repo}#${pullNumber} at ${headSha}`);
});

const dismiss = Effect.fn('categoryApprove.dismiss')(function* (
  owner: string,
  repo: string,
  pullNumber: number,
  review: Review
) {
  const github = yield* GitHub;
  if (isUndefined(review.id)) return;
  yield* github.request('PUT', `/repos/${owner}/${repo}/pulls/${pullNumber}/reviews/${review.id}/dismissals`, {
    message: 'A check on this SHA failed after category approve.',
    event: 'DISMISS'
  });
});

const botReview = (reviews: ReadonlyArray<Review>, headSha: string) =>
  reviews.find(
    review => review.authorLogin === BOT_LOGIN && review.state === 'APPROVED' && review.commitOid === headSha
  );

const act = (
  decision: Decision,
  owner: string,
  repo: string,
  pullNumber: number,
  headSha: string,
  reviews: ReadonlyArray<Review>
) =>
  Match.value(decision).pipe(
    Match.tag('Skip', skipped => Effect.log(`#${pullNumber} skip (${skipped.reason})`)),
    Match.tag('Dismiss', dismissed =>
      Effect.gen(function* () {
        yield* Effect.log(`#${pullNumber} dismiss (${dismissed.reason})`);
        const review = botReview(reviews, headSha);
        if (!isUndefined(review)) yield* dismiss(owner, repo, pullNumber, review);
      })
    ),
    Match.tag('Approve', approved =>
      Effect.gen(function* () {
        yield* Effect.log(`#${pullNumber} approve (${approved.reason})`);
        yield* approve(owner, repo, pullNumber, headSha, approved.categories);
      })
    ),
    Match.tag('Classify', classified => Effect.log(`#${pullNumber} classify (${classified.reason})`)),
    Match.exhaustive
  );

const onePull = Effect.fn('categoryApprove.onePull')(function* (
  owner: string,
  repo: string,
  pullNumber: number,
  runId: string | undefined
) {
  const pr = yield* pullFacts(owner, repo, pullNumber);
  const headSha = stringField(pr, 'headRefOid') ?? '';
  const authorLogin = stringField(record(pr.author), 'login');
  const files = yield* listFiles(owner, repo, pullNumber);
  const reviews = yield* listReviews(owner, repo, pullNumber);
  const checks = yield* listChecks(owner, repo, headSha, runId);
  const membership = isUndefined(authorLogin) ? 'none' : yield* teamMembership(authorLogin);
  const facts = {
    isPullRequest: true,
    baseRef: stringField(pr, 'baseRefName'),
    prState: stringField(pr, 'state')?.toLowerCase(),
    prDraft: pr.isDraft === true,
    reviewDecision: stringField(pr, 'reviewDecision') ?? null,
    authorLogin,
    teamMembershipState: membership,
    headRepoFullName: stringField(record(pr.headRepository), 'nameWithOwner'),
    baseRepoFullName: stringField(record(pr.baseRepository), 'nameWithOwner'),
    headSha,
    files,
    checks,
    reviews,
    botLogin: BOT_LOGIN
  };
  const gated = decideCategoryApprove(facts);
  if (gated._tag !== 'Classify') return yield* act(gated, owner, repo, pullNumber, headSha, reviews);
  yield* act(gated, owner, repo, pullNumber, headSha, reviews);
  const baseRef = facts.baseRef ?? BASE_BRANCH;
  yield* gitText(['fetch', 'origin', baseRef]);
  const policy = yield* gitText(['show', `origin/${baseRef}:APPROVAL_POLICY.md`]);
  const diff = yield* gitText(['diff', `origin/${baseRef}...HEAD`]);
  const dir = yield* Effect.tryPromise({
    try: () => mkdtemp(join(tmpdir(), 'category-approve-')),
    catch: cause => new GitError({ message: String(cause) })
  });
  const diffPath = join(dir, 'pr.diff');
  yield* Effect.tryPromise({
    try: () => writeFile(diffPath, diff),
    catch: cause => new GitError({ message: String(cause) })
  });
  const categories = yield* classify(policy, diffPath);
  const freshChecks = yield* listChecks(owner, repo, headSha, runId);
  const decision = decideCategoryApprove({
    ...facts,
    checks: freshChecks,
    categories,
    allowedCategories: categoryIdsFromPolicy(policy)
  });
  yield* act(decision, owner, repo, pullNumber, headSha, reviews);
});

const pullNumbers = Effect.fn('categoryApprove.pullNumbers')(function* (owner: string, repo: string, event: Json) {
  const checkRun = record(record(event).check_run);
  const checkSuite = record(record(event).check_suite);
  const listed = (
    Array.isArray(checkRun.pull_requests)
      ? checkRun.pull_requests
      : Array.isArray(checkSuite.pull_requests)
        ? checkSuite.pull_requests
        : []
  )
    .map(pull => record(pull).number)
    .filter((number): number is number => typeof number === 'number');
  if (listed.length > 0) return listed;
  const sha = stringField(checkRun, 'head_sha') ?? stringField(checkSuite, 'head_sha');
  if (isUndefined(sha)) return [];
  const github = yield* GitHub;
  const pulls = (yield* github.request('GET', `/repos/${owner}/${repo}/commits/${sha}/pulls`)) as ReadonlyArray<Json>;
  return pulls
    .filter(pull => stringField(record(pull).base, 'ref') === BASE_BRANCH && stringField(pull, 'state') === 'open')
    .map(pull => record(pull).number)
    .filter((number): number is number => typeof number === 'number');
});

const categoryApprove = Effect.fn('categoryApprove')(function* () {
  const eventPath = yield* Config.string('GITHUB_EVENT_PATH');
  const repository = yield* Config.string('GITHUB_REPOSITORY');
  const runId = yield* Config.option(Config.string('GITHUB_RUN_ID'));
  const eventText = yield* Effect.tryPromise({
    try: () => readFile(eventPath, 'utf8'),
    catch: cause => new GitError({ message: String(cause) })
  });
  const event = JSON.parse(eventText) as Json;
  if (stringField(record(event).check_run, 'name') === 'category-approve') {
    yield* Effect.log('skip: own check run');
    return;
  }
  const [owner, repo] = repository.split('/');
  if (isUndefined(owner) || isUndefined(repo)) {
    return yield* Effect.fail(new GitError({ message: 'GITHUB_REPOSITORY is not owner/repo' }));
  }
  const numbers = yield* pullNumbers(owner, repo, event);
  if (numbers.length === 0) {
    yield* Effect.log('skip: no pull request for this check suite');
    return;
  }
  yield* Effect.forEach(
    numbers,
    number => onePull(owner, repo, number, runId._tag === 'Some' ? runId.value : undefined),
    {
      discard: true
    }
  );
});

const program = categoryApprove().pipe(Effect.provide(GitHub.Default));

await program.pipe(
  Effect.tapErrorCause(cause => Effect.logError(Cause.pretty(cause))),
  Effect.runPromise
);
