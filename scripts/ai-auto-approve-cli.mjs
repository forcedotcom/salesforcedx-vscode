#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  authorStandaloneAiAutoComments,
  CHECK_PAGE_SIZE,
  decideAiAutoApprove,
  extraPages,
  isStandaloneAiAutoApprove,
  throughTotal,
  BOT_LOGIN,
  TEAM_ORG,
  TEAM_SLUG
} from './ai-auto-approve.mjs';

const gh = async (path, { method = 'GET', body, token } = {}) => {
  const response = await fetch(path.startsWith('https://') ? path : `https://api.github.com${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(`${method} ${path} ${response.status}: ${json.message ?? text}`);
    error.status = response.status;
    throw error;
  }
  return { json, link: response.headers.get('link') ?? undefined };
};

const linkNext = link =>
  String(link ?? '')
    .split(',')
    .map(part => part.trim())
    .flatMap(part => {
      const match = part.match(/<([^>]+)>;\s*rel="next"/);
      return match ? [match[1]] : [];
    })[0];

const listAll = async (path, { token }) => {
  const separator = path.includes('?') ? '&' : '?';
  const page = await gh(path.startsWith('https://') ? path : `${path}${separator}per_page=100`, { token });
  const items = Array.isArray(page.json) ? page.json : [];
  const next = linkNext(page.link);
  return next ? [...items, ...(await listAll(next, { token }))] : items;
};

const teamMembershipState = async ({ token, login }) => {
  try {
    const membership = await gh(`/orgs/${TEAM_ORG}/teams/${TEAM_SLUG}/memberships/${login}`, { token });
    return membership.json.state ?? 'none';
  } catch (error) {
    if (error.status === 404) return 'none';
    throw error;
  }
};

const listReviews = async ({ token, owner, repo, pullNumber }) => {
  const reviews = await listAll(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, { token });
  return reviews.map(review => ({
    id: review.id,
    authorLogin: review.user?.login,
    state: review.state,
    commitOid: review.commit_id
  }));
};

const listIssueComments = async ({ token, owner, repo, pullNumber }) => {
  const comments = await listAll(`/repos/${owner}/${repo}/issues/${pullNumber}/comments`, { token });
  return comments.map(comment => ({
    id: comment.id,
    authorLogin: comment.user?.login,
    body: comment.body
  }));
};

const listByTotal = async ({ token, path, pick }) => {
  const first = await gh(`${path}?per_page=${CHECK_PAGE_SIZE}&page=1`, { token });
  const total = first.json.total_count ?? 0;
  const rest = await Promise.all(
    extraPages(total).map(page => gh(`${path}?per_page=${CHECK_PAGE_SIZE}&page=${page}`, { token }))
  );
  return throughTotal([first.json, ...rest.map(page => page.json)].flatMap(pick), total);
};

const listChecks = async ({ token, owner, repo, headSha }) => {
  const [statuses, runs] = await Promise.all([
    listByTotal({
      token,
      path: `/repos/${owner}/${repo}/commits/${headSha}/status`,
      pick: page => page.statuses ?? []
    }),
    listByTotal({
      token,
      path: `/repos/${owner}/${repo}/commits/${headSha}/check-runs`,
      pick: page => page.check_runs ?? []
    })
  ]);
  return [
    ...statuses.map(status => ({
      name: status.context,
      state: status.state,
      conclusion: status.state
    })),
    ...runs.map(run => ({
      name: run.name,
      status: run.status,
      conclusion: run.conclusion
    }))
  ];
};

const postApproval = async ({ token, owner, repo, pullNumber, headSha }) => {
  const latest = await gh(`/repos/${owner}/${repo}/pulls/${pullNumber}`, { token });
  if (latest.json.head?.sha !== headSha) {
    console.log(`skip: head moved before approve on #${pullNumber}`);
    return;
  }
  await gh(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, {
    method: 'POST',
    token,
    body: {
      commit_id: headSha,
      event: 'APPROVE',
      body: 'Approved by svc-idee-bot after `/ai-auto approve` from the PR author (@forcedotcom/ide-experience).'
    }
  });
  console.log(`approved ${owner}/${repo}#${pullNumber} at ${headSha}`);
};

const approveFromComment = async ({ token, owner, repo, pullNumber, pr, comment, headSha }) => {
  if (!headSha) {
    console.log(`decision: skip (missing head sha) on #${pullNumber}`);
    return;
  }
  const [membership, reviews, checks] = await Promise.all([
    teamMembershipState({ token, login: comment.authorLogin }),
    listReviews({ token, owner, repo, pullNumber }),
    listChecks({ token, owner, repo, headSha })
  ]);
  const decision = decideAiAutoApprove({
    isPullRequestComment: true,
    commentBody: comment.body,
    commenterLogin: comment.authorLogin,
    prAuthorLogin: pr.user?.login,
    teamMembershipState: membership,
    prState: pr.state,
    prDraft: Boolean(pr.draft),
    headSha,
    checks,
    reviews,
    botLogin: BOT_LOGIN
  });
  console.log(`decision: ${decision.action} (${decision.reason})`);
  if (decision.action !== 'approve') return;
  await postApproval({ token, owner, repo, pullNumber, headSha });
};

const onIssueComment = async ({ token, event, owner, repo }) => {
  const comment = event.comment;
  const issue = event.issue;
  if (!comment || !issue?.pull_request) {
    console.log('skip: not a pull request comment');
    return;
  }
  if (!isStandaloneAiAutoApprove(comment.body)) {
    console.log('skip: comment is not standalone /ai-auto approve');
    return;
  }
  const pullNumber = issue.number;
  const pr = await gh(`/repos/${owner}/${repo}/pulls/${pullNumber}`, { token });
  const headSha = pr.json.head?.sha;
  await approveFromComment({
    token,
    owner,
    repo,
    pullNumber,
    pr: pr.json,
    comment: { authorLogin: comment.user?.login, body: comment.body },
    headSha
  });
};

const onChecksComplete = async ({ token, event, owner, repo }) => {
  const completed = event.workflow_run ?? event.check_suite;
  const headSha = completed?.head_sha;
  const pullNumbers = (completed?.pull_requests ?? []).flatMap(pull =>
    pull?.number !== undefined ? [pull.number] : []
  );
  if (!headSha || pullNumbers.length === 0) {
    console.log('skip: completed checks have no head sha or pull requests');
    return;
  }
  await Promise.all(
    pullNumbers.map(async pullNumber => {
      const pr = await gh(`/repos/${owner}/${repo}/pulls/${pullNumber}`, { token });
      if (pr.json.head?.sha !== headSha) {
        console.log(`skip: #${pullNumber} head is not ${headSha}`);
        return;
      }
      const comments = await listIssueComments({ token, owner, repo, pullNumber });
      const match = authorStandaloneAiAutoComments(comments, pr.json.user?.login)[0];
      if (!match) {
        console.log(`skip: no author /ai-auto approve on #${pullNumber}`);
        return;
      }
      await approveFromComment({
        token,
        owner,
        repo,
        pullNumber,
        pr: pr.json,
        comment: match,
        headSha
      });
    })
  );
};

const onSynchronize = async ({ token, event, owner, repo }) => {
  if (event.action !== 'synchronize') {
    console.log(`skip: pull_request_target action ${event.action ?? 'missing'}`);
    return;
  }
  const pullNumber = event.pull_request?.number;
  const prAuthorLogin = event.pull_request?.user?.login;
  if (pullNumber === undefined || !prAuthorLogin) {
    console.log('skip: synchronize missing pull');
    return;
  }
  const comments = await listIssueComments({ token, owner, repo, pullNumber });
  const commentIds = authorStandaloneAiAutoComments(comments, prAuthorLogin).map(comment => comment.id);
  await Promise.all(
    commentIds.map(async commentId => {
      await gh(`/repos/${owner}/${repo}/issues/comments/${commentId}`, { method: 'DELETE', token });
      console.log(`deleted comment ${commentId} on #${pullNumber}`);
    })
  );
};

const handlers = {
  issue_comment: onIssueComment,
  workflow_run: onChecksComplete,
  check_suite: onChecksComplete,
  pull_request_target: onSynchronize
};

export const handleAiAutoApproveEvent = async ({ token, eventName, event, owner, repo }) => {
  const handler = handlers[eventName];
  if (!handler) {
    console.log(`skip: unhandled event ${eventName}`);
    return;
  }
  await handler({ token, event, owner, repo });
};

const main = async () => {
  const token = process.env.IDEE_GH_TOKEN;
  const eventName = process.env.GITHUB_EVENT_NAME;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!token) throw new Error('IDEE_GH_TOKEN is required');
  if (!eventName) throw new Error('GITHUB_EVENT_NAME is required');
  if (!eventPath) throw new Error('GITHUB_EVENT_PATH is required');
  if (!repository) throw new Error('GITHUB_REPOSITORY is required');
  const [owner, repo] = repository.split('/');
  if (!owner || !repo) throw new Error('GITHUB_REPOSITORY is required');

  const event = JSON.parse(await readFile(eventPath, 'utf8'));
  await handleAiAutoApproveEvent({ token, eventName, event, owner, repo });
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
