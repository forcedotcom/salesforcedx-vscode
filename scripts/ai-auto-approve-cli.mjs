#!/usr/bin/env node
import * as NodeContext from '@effect/platform-node/NodeContext';
import {
  actionsEnvironment,
  GitHub,
  readCompletedChecksEvent,
  readIssueCommentEvent,
  readSynchronizeEvent
} from '@salesforce/effect-octokit';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Logger from 'effect/Logger';
import { isNullable } from 'effect/Predicate';
import { pathToFileURL } from 'node:url';
import {
  authorStandaloneAiAutoComments,
  decideAiAutoApprove,
  isStandaloneAiAutoApprove,
  BOT_LOGIN,
  TEAM_ORG,
  TEAM_SLUG
} from './ai-auto-approve.mjs';

const APPROVAL_BODY =
  'Approved by svc-idee-bot after `/ai-auto approve` from the PR author (@forcedotcom/ide-experience).';

const logDecision = decision =>
  Effect.log(`decision: ${decision.action} (${decision.reason})`, {
    action: decision.action,
    reason: decision.reason
  });

/**
 * Gates for one PR at one head. Identity gates run before any extra API reads.
 * Only `approve` is returned as action to post; caller decides what to do with `hold` / `skip`.
 */
const decidePull = Effect.fn('aiAutoApprove.decidePull')(
  function* (github, owner, repo, pullNumber, pull, commenterLogin, commentBody) {
    const headSha = pull.headRefOid ?? '';
    const authorLogin = pull.author?.login ?? '';
    if (!commenterLogin || commenterLogin !== authorLogin) {
      return decideAiAutoApprove({
        isPullRequestComment: true,
        commentBody,
        commenterLogin,
        prAuthorLogin: authorLogin,
        teamMembershipState: 'none',
        prState: pull.state,
        prDraft: pull.isDraft,
        headSha,
        checks: [],
        reviews: []
      });
    }
    const [membership, reviews, checks] = yield* Effect.all(
      [
        github.teamMembership(TEAM_ORG, TEAM_SLUG, commenterLogin),
        github.pullReviews(owner, repo, pullNumber),
        headSha.length === 0 ? Effect.succeed([]) : github.headChecks(owner, repo, headSha)
      ],
      { concurrency: 'unbounded' }
    );
    return decideAiAutoApprove({
      isPullRequestComment: true,
      commentBody,
      commenterLogin,
      prAuthorLogin: authorLogin,
      teamMembershipState: membership,
      prState: pull.state,
      prDraft: pull.isDraft,
      headSha,
      checks,
      reviews,
      botLogin: BOT_LOGIN
    });
  }
);

const approveIfDecided = Effect.fn('aiAutoApprove.approveIfDecided')(
  function* (github, owner, repo, pullNumber, headSha, decision) {
    yield* logDecision(decision);
    if (decision.action !== 'approve') return;
    const latest = yield* github.pullRequest(owner, repo, pullNumber);
    if (isNullable(latest) || latest.headRefOid !== headSha) {
      yield* Effect.log(`decision: skip (#${pullNumber} head moved before approve)`);
      return;
    }
    yield* github.createReview(owner, repo, pullNumber, headSha, 'APPROVE', APPROVAL_BODY);
    yield* Effect.log(`approved ${owner}/${repo}#${pullNumber} at ${headSha}`, {
      owner,
      repo,
      pullNumber,
      headSha
    });
  }
);

/** Comment just posted. `hold` leaves the comment; checks completion re-decides on the same head. */
const onIssueComment = Effect.fn('aiAutoApprove.issueComment')(function* (env, github) {
  const { comment, issue } = yield* readIssueCommentEvent(env.eventPath);
  if (isNullable(comment) || isNullable(issue)) {
    yield* Effect.log('decision: skip (no comment/issue on event)');
    return;
  }
  if (!issue.pull_request) {
    yield* Effect.log('decision: skip (not a pull request comment)');
    return;
  }
  const commentBody = comment.body ?? '';
  if (!isStandaloneAiAutoApprove(commentBody)) {
    yield* Effect.log('decision: skip (comment is not standalone /ai-auto approve)');
    return;
  }
  const pull = yield* github.pullRequest(env.owner, env.repo, issue.number);
  if (isNullable(pull)) {
    yield* Effect.log('decision: skip (pull request not found)');
    return;
  }
  const decision = yield* decidePull(
    github,
    env.owner,
    env.repo,
    issue.number,
    pull,
    comment.user?.login ?? '',
    commentBody
  );
  yield* approveIfDecided(github, env.owner, env.repo, issue.number, pull.headRefOid ?? '', decision);
});

/**
 * Checks completed on a head. Re-reads every check on that SHA, not just the suite that finished.
 * Old SHA never approves: `pull.headRefOid` must equal the completed SHA.
 */
const onChecksComplete = Effect.fn('aiAutoApprove.checksComplete')(function* (env, github) {
  const event = yield* readCompletedChecksEvent(env.eventPath);
  const completed = event.check_suite ?? event.workflow_run;
  if (isNullable(completed)) {
    yield* Effect.log('decision: skip (completed checks have no head sha or pull requests)');
    return;
  }
  yield* Effect.forEach(
    completed.pull_requests,
    Effect.fn('aiAutoApprove.checksCompletePull')(function* ({ number: pullNumber }) {
      const pull = yield* github.pullRequest(env.owner, env.repo, pullNumber);
      if (isNullable(pull) || pull.headRefOid !== completed.head_sha) {
        yield* Effect.log(`decision: skip (#${pullNumber} head is not ${completed.head_sha})`);
        return;
      }
      const comments = yield* github.paginate('GET /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        owner: env.owner,
        repo: env.repo,
        issue_number: pullNumber
      });
      const author = authorStandaloneAiAutoComments(
        comments.map(comment => ({
          authorLogin: comment.user?.login,
          body: comment.body
        })),
        pull.author?.login
      )[0];
      if (isNullable(author)) {
        yield* Effect.log(`decision: skip (no author /ai-auto approve on #${pullNumber})`);
        return;
      }
      const decision = yield* decidePull(
        github,
        env.owner,
        env.repo,
        pullNumber,
        pull,
        author.authorLogin ?? '',
        author.body
      );
      yield* approveIfDecided(github, env.owner, env.repo, pullNumber, completed.head_sha, decision);
    }),
    { concurrency: 'unbounded', discard: true }
  );
});

/** New commits: delete the author's `/ai-auto approve` comments. No review.
 *  Runs from default-branch checkout; see workflow. Uses IDEE_GH_TOKEN for DELETE. */
const onSynchronize = Effect.fn('aiAutoApprove.synchronize')(function* (env, github) {
  const event = yield* readSynchronizeEvent(env.eventPath);
  if (event.action !== 'synchronize') {
    yield* Effect.log(`decision: skip (pull_request_target action ${event.action})`);
    return;
  }
  const pullNumber = event.pull_request.number;
  const pull = yield* github.pullRequest(env.owner, env.repo, pullNumber);
  if (isNullable(pull)) {
    yield* Effect.log(`decision: skip (#${pullNumber} not found)`);
    return;
  }
  const comments = yield* github.paginate('GET /repos/{owner}/{repo}/issues/{issue_number}/comments', {
    owner: env.owner,
    repo: env.repo,
    issue_number: pullNumber
  });
  const stale = authorStandaloneAiAutoComments(
    comments.map(comment => ({ id: comment.id, authorLogin: comment.user?.login, body: comment.body })),
    pull.author?.login
  );
  yield* Effect.forEach(
    stale,
    comment =>
      github
        .request('DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}', {
          owner: env.owner,
          repo: env.repo,
          comment_id: comment.id
        })
        .pipe(Effect.andThen(Effect.log(`deleted comment ${comment.id} on #${pullNumber}`))),
    { discard: true }
  );
});

export const aiAutoApproveProgram = Effect.fn('aiAutoApprove.program')(function* () {
  const env = yield* actionsEnvironment;
  const github = yield* GitHub;
  switch (env.eventName) {
    case 'issue_comment':
      return yield* onIssueComment(env, github);
    case 'check_suite':
    case 'workflow_run':
      return yield* onChecksComplete(env, github);
    case 'pull_request_target':
      return yield* onSynchronize(env, github);
    default:
      yield* Effect.log(`decision: skip (unhandled event ${env.eventName})`);
  }
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
