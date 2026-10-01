#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Command from '@effect/platform/Command';
import * as FileSystem from '@effect/platform/FileSystem';
import * as Path from '@effect/platform/Path';
import * as NodeContext from '@effect/platform-node/NodeContext';
import { actionsEnvironment, GitHub, GitHubEvent, type GitHubEventType } from '@salesforce/effect-octokit';
import * as Cause from 'effect/Cause';
import * as Config from 'effect/Config';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Match from 'effect/Match';
import * as Option from 'effect/Option';
import { isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { buildPrompt, categoryIdsFromPolicy, parseAgentResult } from './shared/categoryDecision.mts';
import {
  BASE_BRANCH,
  BOT_LOGIN,
  TEAM_ORG,
  TEAM_SLUG,
  type Decision,
  type Facts,
  decideCategoryApprove,
  skipFiles,
  skipMembership,
  skipPull,
  withoutOwnRun
} from './shared/categoryGates.mts';
import { AgentError, GitError } from './shared/scriptErrors.mts';

const MODEL = 'grok-4.7-xhigh';

// Command.env merges over process.env (NodeCommandExecutor). Blank inherited values so the agent only sees its allowlist.
const agentEnvironment = (home: string, pathEnv: string, apiKey: string) => ({
  ...Object.fromEntries(
    Object.entries(process.env).flatMap(([key, value]) => (value === undefined ? [] : [[key, '']]))
  ),
  PATH: `${home}/.local/bin:${pathEnv}`,
  HOME: home,
  CURSOR_API_KEY: apiKey
});

const commandOutput = Effect.fn('categoryApprove.commandOutput')(function* (command: Command.Command) {
  const handle = yield* Command.start(command);
  return yield* Effect.all(
    [
      Stream.mkString(Stream.decodeText(handle.stdout)),
      Stream.mkString(Stream.decodeText(handle.stderr)),
      handle.exitCode
    ],
    { concurrency: 'unbounded' }
  );
});

const gitText = (args: readonly string[]) =>
  commandOutput(Command.make('git', ...args)).pipe(
    Effect.scoped,
    Effect.filterOrFail(
      ([, , code]) => code === 0,
      ([, stderr, code]) =>
        new GitError({ message: stderr.length === 0 ? `git ${args.join(' ')} exited ${code}` : stderr })
    ),
    Effect.map(([stdout]) => stdout)
  );

const listChecks = Effect.fn('categoryApprove.listChecks')(function* (
  owner: string,
  repo: string,
  headSha: string,
  runId: string
) {
  const github = yield* GitHub;
  const [status, runs] = yield* Effect.all(
    [github.combinedStatus(owner, repo, headSha), github.checkRuns(owner, repo, headSha)],
    { concurrency: 'unbounded' }
  );
  return { statuses: status.statuses, checkRuns: withoutOwnRun(runs, runId) };
});

const classify = Effect.fn('categoryApprove.classify')(function* (policy: string, diffPath: string) {
  return yield* Effect.all([Config.string('CURSOR_API_KEY'), Config.string('PATH'), Config.string('HOME')], {
    concurrency: 'unbounded'
  }).pipe(
    Effect.flatMap(([apiKey, pathEnv, home]) =>
      commandOutput(
        Command.make('agent', '-p', '--model', MODEL, '--output-format', 'json', buildPrompt(policy, diffPath)).pipe(
          Command.env(agentEnvironment(home, pathEnv, apiKey)),
          Command.stdin(Stream.empty)
        )
      ).pipe(Effect.scoped)
    ),
    Effect.filterOrFail(
      ([, , code]) => code === 0,
      ([, stderr, code]) => new AgentError({ message: `agent exited ${code}: ${stderr}` })
    ),
    Effect.map(([stdout]) => parseAgentResult(stdout))
  );
});

const writeDiff = Effect.fn('categoryApprove.writeDiff')(function* (policy: string, diff: string) {
  const fs = yield* FileSystem.FileSystem;
  const dir = yield* fs.makeTempDirectoryScoped({ prefix: 'category-approve-' });
  const diffPath = yield* Path.Path.pipe(Effect.map(path => path.join(dir, 'pr.diff')));
  yield* fs.writeFileString(diffPath, diff);
  return yield* classify(policy, diffPath);
});

const approve = Effect.fn('categoryApprove.approve')(function* (
  owner: string,
  repo: string,
  pullNumber: number,
  headSha: string,
  categories: readonly string[]
) {
  yield* GitHub.pipe(
    Effect.flatMap(github =>
      github.createReview(
        owner,
        repo,
        pullNumber,
        headSha,
        'APPROVE',
        `Category union: ${categories.join(', ')}. Judged from the diff.`
      )
    )
  );
  yield* Effect.log(`approved ${owner}/${repo}#${pullNumber} at ${headSha}`);
});

const dismiss = Effect.fn('categoryApprove.dismiss')(function* (
  owner: string,
  repo: string,
  pullNumber: number,
  reviewId: Facts['reviews'][number]['id']
) {
  yield* GitHub.pipe(
    Effect.flatMap(github =>
      github.dismissReview(owner, repo, pullNumber, reviewId, 'A check on this SHA failed after category approve.')
    )
  );
});

const botReview = (reviews: Facts['reviews'], headSha: string) =>
  reviews.find(
    review => review.user?.login === BOT_LOGIN && review.state === 'APPROVED' && review.commit_id === headSha
  );

const act = (
  decision: Decision,
  owner: string,
  repo: string,
  pullNumber: number,
  headSha: string,
  reviews: Facts['reviews']
) =>
  Match.value(decision).pipe(
    Match.tag('Skip', skipped => Effect.log(`#${pullNumber} skip (${skipped.reason})`)),
    Match.tag('Dismiss', dismissed =>
      Effect.log(`#${pullNumber} dismiss (${dismissed.reason})`).pipe(
        Effect.andThen(
          Option.match(Option.fromNullable(botReview(reviews, headSha)), {
            onNone: () => Effect.void,
            onSome: review => dismiss(owner, repo, pullNumber, review.id)
          })
        )
      )
    ),
    Match.tag('Approve', approved =>
      Effect.log(`#${pullNumber} approve (${approved.reason})`).pipe(
        Effect.andThen(approve(owner, repo, pullNumber, headSha, approved.categories))
      )
    ),
    Match.tag('Classify', classified => Effect.log(`#${pullNumber} classify (${classified.reason})`)),
    Match.exhaustive
  );

const onePull = Effect.fn('categoryApprove.onePull')(function* (
  owner: string,
  repo: string,
  pullNumber: number,
  runId: string
) {
  const github = yield* GitHub;
  const pull = yield* github.pullRequest(owner, repo, pullNumber);
  if (isUndefined(pull)) return yield* Effect.log(`#${pullNumber} skip (not a pull request)`);
  const early = skipPull(pull);
  if (early !== undefined) return yield* Effect.log(`#${pullNumber} skip (${early.reason})`);
  const files = yield* github.pullFiles(owner, repo, pullNumber);
  const fileDecision = skipFiles(files);
  if (fileDecision !== undefined) return yield* Effect.log(`#${pullNumber} skip (${fileDecision.reason})`);
  const authorLogin = pull.author?.login;
  const teamMembershipState = isUndefined(authorLogin)
    ? 'none'
    : yield* github.teamMembership(TEAM_ORG, TEAM_SLUG, authorLogin);
  const membershipDecision = skipMembership(teamMembershipState);
  if (membershipDecision !== undefined) return yield* Effect.log(`#${pullNumber} skip (${membershipDecision.reason})`);
  const headSha = pull.headRefOid;
  const [reviews, checks] = yield* Effect.all(
    [github.pullReviews(owner, repo, pullNumber), listChecks(owner, repo, headSha, runId)],
    { concurrency: 'unbounded' }
  );
  const facts: Facts = {
    pull,
    files,
    reviews,
    statuses: checks.statuses,
    checkRuns: checks.checkRuns,
    teamMembershipState,
    botLogin: BOT_LOGIN
  };
  const gated = decideCategoryApprove(facts);
  if (gated._tag !== 'Classify') return yield* act(gated, owner, repo, pullNumber, headSha, reviews);
  yield* act(gated, owner, repo, pullNumber, headSha, reviews);
  const baseRef = pull.baseRefName;
  yield* gitText(['fetch', 'origin', baseRef]);
  const policy = yield* gitText(['show', `origin/${baseRef}:APPROVAL_POLICY.md`]);
  yield* gitText(['diff', `origin/${baseRef}...HEAD`]).pipe(
    Effect.flatMap(diff => writeDiff(policy, diff)),
    Effect.scoped,
    Effect.flatMap(categories =>
      listChecks(owner, repo, headSha, runId).pipe(
        Effect.map(freshChecks =>
          decideCategoryApprove({
            ...facts,
            statuses: freshChecks.statuses,
            checkRuns: freshChecks.checkRuns,
            categories,
            allowedCategories: categoryIdsFromPolicy(policy)
          })
        ),
        Effect.flatMap(decision => act(decision, owner, repo, pullNumber, headSha, reviews))
      )
    )
  );
});

const pullNumbers = Effect.fn('categoryApprove.pullNumbers')(function* (
  event: GitHubEventType,
  owner: string,
  repo: string
) {
  if ('pull_request' in event) return [event.pull_request.number];
  const checks = 'check_run' in event ? event.check_run : event.check_suite;
  const listed = (checks.pull_requests ?? []).map(pull => pull.number);
  if (listed.length > 0) return listed;
  const sha = checks.head_sha;
  if (isUndefined(sha)) return [];
  return (yield* GitHub.pipe(Effect.flatMap(github => github.pullsForCommit(owner, repo, sha))))
    .filter(pull => pull.base?.ref === BASE_BRANCH && pull.state === 'open')
    .map(pull => pull.number)
    .filter(Number.isFinite);
});

const categoryApprove = Effect.fn('categoryApprove')(function* () {
  const env = yield* actionsEnvironment;
  const event = yield* FileSystem.FileSystem.pipe(
    Effect.flatMap(fs => fs.readFileString(env.eventPath)),
    Effect.flatMap(Schema.decodeUnknown(Schema.parseJson(GitHubEvent)))
  );
  if ('check_run' in event && event.check_run.name === 'category-approve') {
    yield* Effect.log('skip: own check run');
    return;
  }
  const numbers = yield* pullNumbers(event, env.owner, env.repo);
  if (numbers.length === 0) {
    yield* Effect.log('skip: no pull request for this check suite');
    return;
  }
  yield* Effect.forEach(numbers, number => onePull(env.owner, env.repo, number, String(env.runId)), {
    discard: true
  });
});

const program = categoryApprove().pipe(Effect.provide(Layer.mergeAll(GitHub.Default, NodeContext.layer)));

await program.pipe(
  Effect.tapErrorCause(cause => Effect.logError(Cause.pretty(cause))),
  Effect.runPromise
);
