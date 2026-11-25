#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as NodeServices from '@effect/platform-node/NodeServices';
import {
  actionsEnvironment,
  findApprovedReviewOnHead,
  GitHub,
  GitHubLayer,
  readCheckEvent,
  type CheckEvent,
  withoutWorkflowRun
} from '@salesforce/effect-octokit';
import * as Arr from 'effect/Array';
import * as Cause from 'effect/Cause';
import * as Config from 'effect/Config';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Match from 'effect/Match';
import * as Option from 'effect/Option';
import * as Result from 'effect/Result';
import { isNumber, isUndefined } from 'effect/Predicate';
import { appendFile } from 'node:fs/promises';
import { commandOutput } from './commandOutput.mts';
import {
  BASE_BRANCH,
  BOT_LOGIN,
  TEAM_ORG,
  TEAM_SLUG,
  type Decision,
  type Facts,
  buildPrompt,
  categoryForPath,
  categoryIdsFromPolicy,
  classifyGit2GusConfig,
  decideCategoryApprove,
  parseAgentResult,
  pathsForFile,
  rejectedPath
} from './shared/categoryDecision.mts';
import { openCodePrompt } from './shared/openCode.mts';
import { GitError } from './shared/scriptErrors.mts';

const gitText = (args: readonly string[]) =>
  commandOutput({ executable: 'git', args }).pipe(
    Effect.map(({ stdout }) => stdout),
    Effect.catchTag('CommandFailed', error => Effect.fail(new GitError({ message: error.message })))
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
  return { statuses: status.statuses, checkRuns: withoutWorkflowRun(runs, runId) };
});

export const classify = Effect.fn('categoryApprove.classify')(function* (input: {
  readonly policy: string;
  readonly files: Facts['files'];
  readonly baseRef: string;
  readonly headSha: string;
}) {
  const { policy, files, baseRef, headSha } = input;
  // GitHub caps pull-request files at 3,000; a list at that limit may omit uncovered files.
  if (files.length >= 3000) return [];
  if (files.length === 1 && files[0]?.filename === '.git2gus/config.json' && files[0].status === 'modified') {
    return yield* Effect.all([
      gitText(['show', `${baseRef}:.git2gus/config.json`]),
      gitText(['show', `${headSha}:.git2gus/config.json`])
    ]).pipe(Effect.map(([before, after]) => classifyGit2GusConfig(files, before, after)));
  }
  const paths = Arr.dedupe(files.flatMap(pathsForFile));
  if (paths.some(rejectedPath)) return [];
  const categories = Arr.dedupe(
    Arr.filterMap(paths, filename => Result.fromOption(categoryForPath(filename), () => undefined))
  );
  const remainingPaths = paths.filter(filename => Option.isNone(categoryForPath(filename)));
  if (remainingPaths.length === 0) return categories;
  // Literal pathspecs and --no-renames keep covered files out, including either side of a rename.
  return yield* gitText([
    'diff',
    '--no-renames',
    `${baseRef}...${headSha}`,
    '--',
    ...remainingPaths.map(filename => `:(top,literal)${filename}`)
  ]).pipe(
    Effect.flatMap(diff =>
      diff.trim().length === 0
        ? Effect.succeed(Option.none<readonly string[]>())
        : openCodePrompt({ prompt: buildPrompt(policy, diff, categories.length > 0) }).pipe(
            Effect.map(parseAgentResult),
            Effect.catchTag('OpenCodeRunFailed', error =>
              Effect.logWarning(
                'Automatic approval skipped: AI classification unavailable. Human approval remains available.',
                {
                  reason: error.message
                }
              ).pipe(
                Effect.andThen(Config.option(Config.String('GITHUB_STEP_SUMMARY'))),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.void,
                    onSome: summaryPath =>
                      Effect.tryPromise({
                        try: () =>
                          appendFile(
                            summaryPath,
                            'Automatic approval skipped: AI classification unavailable. Human approval remains available.\n'
                          ),
                        catch: error => String(error)
                      }).pipe(
                        Effect.catch(error =>
                          Effect.logWarning('Could not write automatic approval skip summary', { error })
                        )
                      )
                  })
                ),
                Effect.as(Option.none<readonly string[]>())
              )
            )
          )
    ),
    Effect.map(
      Option.match({
        onNone: () => [],
        onSome: classified => Arr.dedupe([...categories, ...classified])
      })
    )
  );
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
          Option.match(Option.fromUndefinedOr(findApprovedReviewOnHead(reviews, headSha, BOT_LOGIN)), {
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
  const headSha = pull?.headRefOid ?? '';
  const authorLogin = pull?.author?.login;
  const [files, reviews, checks, membership] = yield* Effect.all(
    [
      github.pullFiles(owner, repo, pullNumber),
      github.pullReviews(owner, repo, pullNumber),
      listChecks(owner, repo, headSha, runId),
      isUndefined(authorLogin) ? Effect.succeed('none') : github.teamMembership(TEAM_ORG, TEAM_SLUG, authorLogin)
    ],
    { concurrency: 'unbounded' }
  );
  const facts = {
    pull,
    files,
    statuses: checks.statuses,
    checkRuns: checks.checkRuns,
    reviews,
    teamMembershipState: membership,
    botLogin: BOT_LOGIN
  };
  const gated = decideCategoryApprove(facts);
  if (gated._tag !== 'Classify' || isUndefined(pull))
    return yield* act(gated, owner, repo, pullNumber, headSha, reviews);
  yield* act(gated, owner, repo, pullNumber, headSha, reviews);
  if ((yield* gitText(['rev-parse', 'HEAD'])).trim() !== headSha) {
    return yield* Effect.log(`#${pullNumber} skip (checkout does not match PR head ${headSha})`);
  }
  const baseRef = pull.baseRefName;
  yield* gitText(['fetch', 'origin', baseRef]);
  const policy = yield* gitText(['show', `origin/${baseRef}:APPROVAL_POLICY.md`]);
  yield* classify({ policy, files, baseRef: `origin/${baseRef}`, headSha }).pipe(
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

const pullActions = new Set(['opened', 'ready_for_review', 'reopened', 'edited', 'submitted', 'dismissed']);

const pullNumbers = Effect.fn('categoryApprove.pullNumbers')(function* (
  owner: string,
  repo: string,
  event: CheckEvent
) {
  if (!isUndefined(event.pull_request) && !isUndefined(event.action) && pullActions.has(event.action)) {
    return [event.pull_request.number];
  }
  const listed = (event.check_run?.pull_requests ?? event.check_suite?.pull_requests ?? []).map(pull => pull.number);
  if (listed.length > 0) return listed;
  const sha = event.check_run?.head_sha ?? event.check_suite?.head_sha;
  if (isUndefined(sha)) return [];
  return yield* GitHub.pipe(
    Effect.flatMap(github => github.pullsForCommit(owner, repo, sha)),
    Effect.map(pulls =>
      pulls
        .filter(pull => pull.base?.ref === BASE_BRANCH && pull.state === 'open')
        .map(pull => pull.number)
        .filter(isNumber)
    )
  );
});

const categoryApprove = Effect.fn('categoryApprove')(function* () {
  const env = yield* actionsEnvironment();
  const event = yield* readCheckEvent(env.eventPath);
  if (event.check_run?.name === 'category-approve') {
    yield* Effect.log('skip: own check run');
    return;
  }
  const numbers = yield* pullNumbers(env.owner, env.repo, event);
  if (numbers.length === 0) {
    yield* Effect.log('skip: no pull request for this check suite');
    return;
  }
  yield* Effect.forEach(numbers, number => onePull(env.owner, env.repo, number, String(env.runId)), {
    discard: true
  });
});

if (import.meta.main) {
  await categoryApprove().pipe(
    Effect.provide(Layer.mergeAll(GitHubLayer, NodeServices.layer)),
    Effect.tapCause(cause => Effect.logError(Cause.pretty(cause))),
    Effect.runPromise
  );
}
