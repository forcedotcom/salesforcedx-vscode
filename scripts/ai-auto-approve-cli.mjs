#!/usr/bin/env node
import * as NodeContext from '@effect/platform-node/NodeContext';
import { actionsEnvironment, GitHub, IssueCommentEvent, readActionsEvent } from '@salesforce/effect-octokit';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Logger from 'effect/Logger';
import { isNullable } from 'effect/Predicate';
import { pathToFileURL } from 'node:url';
import { decideAiAutoApprove, isStandaloneAiAutoApprove, BOT_LOGIN, TEAM_ORG, TEAM_SLUG } from './ai-auto-approve.mjs';

const logDecision = decision =>
  Effect.log(`decision: ${decision.action} (${decision.reason})`, {
    action: decision.action,
    reason: decision.reason
  });

export const aiAutoApproveProgram = Effect.fn('aiAutoApprove.program')(function* () {
  const env = yield* actionsEnvironment;
  const { comment, issue } = yield* readActionsEvent(env.eventPath, IssueCommentEvent);
  if (isNullable(comment) || isNullable(issue)) {
    yield* Effect.log('skip: no comment/issue on event');
    return;
  }

  const isPullRequestComment = Boolean(issue.pull_request);
  const commenterLogin = comment.user?.login ?? '';
  const commentBody = comment.body ?? '';
  if (!isPullRequestComment) {
    yield* Effect.log('decision: skip (not a pull request comment)');
    return;
  }
  if (!isStandaloneAiAutoApprove(commentBody)) {
    yield* Effect.log('decision: skip (comment is not standalone /ai-auto approve)');
    return;
  }

  const github = yield* GitHub;
  const pull = yield* github.pullRequest(env.owner, env.repo, issue.number);
  const headSha = pull?.headRefOid ?? '';
  const authorLogin = pull?.author?.login ?? '';
  if (pull === undefined || !commenterLogin || commenterLogin !== authorLogin) {
    const decision = decideAiAutoApprove({
      isPullRequestComment,
      commentBody,
      commenterLogin,
      prAuthorLogin: authorLogin,
      teamMembershipState: 'none',
      prState: pull?.state,
      prDraft: pull?.isDraft ?? false,
      headSha,
      checks: [],
      reviews: [],
      botLogin: BOT_LOGIN
    });
    yield* logDecision(decision);
    return;
  }

  const decision = yield* Effect.all(
    [
      github.teamMembership(TEAM_ORG, TEAM_SLUG, commenterLogin),
      github.pullReviews(env.owner, env.repo, issue.number),
      headSha.length === 0 ? Effect.succeed([]) : github.headChecks(env.owner, env.repo, headSha)
    ],
    { concurrency: 'unbounded' }
  ).pipe(
    Effect.map(([membership, reviews, checks]) =>
      decideAiAutoApprove({
        isPullRequestComment,
        commentBody,
        commenterLogin,
        prAuthorLogin: authorLogin,
        teamMembershipState: membership,
        prState: pull.state,
        prDraft: pull.isDraft,
        headSha,
        checks,
        reviews: reviews.map(review => ({
          authorLogin: review.user?.login,
          state: review.state,
          commitOid: review.commit_id
        })),
        botLogin: BOT_LOGIN
      })
    )
  );

  yield* logDecision(decision);
  if (decision.action !== 'approve') return;

  yield* github.createReview(
    env.owner,
    env.repo,
    issue.number,
    headSha,
    'APPROVE',
    'Approved by svc-idee-bot after `/ai-auto approve` from the PR author (@forcedotcom/ide-experience).'
  );
  yield* Effect.log(`approved ${env.owner}/${env.repo}#${issue.number} at ${headSha}`, {
    owner: env.owner,
    repo: env.repo,
    pullNumber: issue.number,
    headSha
  });
});

export const aiAutoApproveMain = aiAutoApproveProgram().pipe(
  Effect.provide(
    Layer.mergeAll(
      GitHub.Default,
      NodeContext.layer,
      Logger.replace(
        Logger.defaultLogger,
        Logger.make(({ message }) =>
          process.stdout.write(
            `${
              Array.isArray(message)
                ? message.map(value => (typeof value === 'string' ? value : JSON.stringify(value))).join(' ')
                : typeof message === 'string'
                  ? message
                  : JSON.stringify(message)
            }\n`
          )
        )
      )
    )
  )
);

const isDirectRun = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  await aiAutoApproveMain.pipe(
    Effect.tapErrorCause(cause => Effect.sync(() => process.stderr.write(`${Cause.pretty(cause)}\n`))),
    Effect.exit,
    Effect.tap(exit =>
      Effect.sync(() => {
        if (Exit.isFailure(exit)) process.exitCode = 1;
      })
    ),
    Effect.runPromise
  );
}
