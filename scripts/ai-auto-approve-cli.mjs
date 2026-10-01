#!/usr/bin/env node
import { decideAiAutoApprove, BOT_LOGIN, TEAM_ORG, TEAM_SLUG } from './ai-auto-approve.mjs';

const gh = async (path, { method = 'GET', body, token } = {}) => {
  const response = await fetch(`https://api.github.com${path}`, {
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
  return json;
};

const teamMembershipState = async ({ token, login }) => {
  try {
    const membership = await gh(`/orgs/${TEAM_ORG}/teams/${TEAM_SLUG}/memberships/${login}`, { token });
    return membership.state ?? 'none';
  } catch (error) {
    if (error.status === 404) return 'none';
    throw error;
  }
};

const listReviews = async ({ token, owner, repo, pullNumber }) => {
  const reviews = await gh(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews?per_page=100`, { token });
  return reviews.map(review => ({
    authorLogin: review.user?.login,
    state: review.state,
    commitOid: review.commit_id
  }));
};

const listChecks = async ({ token, owner, repo, headSha }) => {
  const [combined, checkRuns] = await Promise.all([
    gh(`/repos/${owner}/${repo}/commits/${headSha}/status`, { token }),
    gh(`/repos/${owner}/${repo}/commits/${headSha}/check-runs?per_page=100`, { token })
  ]);
  const statuses = (combined.statuses ?? []).map(status => ({
    name: status.context,
    state: status.state,
    conclusion: status.state
  }));
  const runs = (checkRuns.check_runs ?? []).map(run => ({
    name: run.name,
    status: run.status,
    conclusion: run.conclusion
  }));
  return [...statuses, ...runs];
};

const main = async () => {
  const token = process.env.IDEE_GH_TOKEN;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!token) throw new Error('IDEE_GH_TOKEN is required');
  if (!eventPath) throw new Error('GITHUB_EVENT_PATH is required');

  const event = JSON.parse(await (await import('node:fs/promises')).readFile(eventPath, 'utf8'));
  const comment = event.comment;
  const issue = event.issue;
  if (!comment || !issue) {
    console.log('skip: no comment/issue on event');
    return;
  }

  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
  const isPullRequestComment = Boolean(issue.pull_request);
  const commenterLogin = comment.user?.login;
  const commentBody = comment.body ?? '';

  if (!isPullRequestComment) {
    console.log('skip: not a pull request comment');
    return;
  }

  const pullNumber = issue.number;
  const pr = await gh(`/repos/${owner}/${repo}/pulls/${pullNumber}`, { token });
  const headSha = pr.head?.sha ?? '';
  const [membership, reviews, checks] = await Promise.all([
    teamMembershipState({ token, login: commenterLogin }),
    listReviews({ token, owner, repo, pullNumber }),
    listChecks({ token, owner, repo, headSha })
  ]);

  const decision = decideAiAutoApprove({
    isPullRequestComment,
    commentBody,
    commenterLogin,
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

main().catch(error => {
  console.error(error);
  process.exit(1);
});
