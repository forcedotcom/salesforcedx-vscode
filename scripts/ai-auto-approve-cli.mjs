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

const listAll = async ({ path, field, token }) => {
  const rows = [];
  const separator = path.includes('?') ? '&' : '?';
  for (let page = 1; ; page++) {
    const result = await gh(`${path}${separator}per_page=100&page=${page}`, { token });
    rows.push(...result[field]);
    if (rows.length >= result.total_count) return rows;
    if (result[field].length === 0) throw new Error(`Incomplete ${field} for ${path}`);
  }
};

const listChecks = async ({ token, owner, repo, headSha }) => {
  const [combined, workflowRuns, checkRuns] = await Promise.all([
    gh(`/repos/${owner}/${repo}/commits/${headSha}/status`, { token }),
    listAll({ path: `/repos/${owner}/${repo}/actions/runs?head_sha=${headSha}`, field: 'workflow_runs', token }),
    listAll({ path: `/repos/${owner}/${repo}/commits/${headSha}/check-runs?filter=all`, field: 'check_runs', token })
  ]);
  const statuses = (combined.statuses ?? []).map(status => ({
    key: `status:${status.context}`,
    id: status.id,
    name: status.context,
    state: status.state,
    conclusion: status.state
  }));
  const workflows = workflowRuns.map(run => ({
    key: `workflow:${run.path}`,
    id: run.id,
    name: run.path,
    status: run.status,
    conclusion: run.conclusion
  }));
  const runs = checkRuns
    .filter(run => run.app?.slug !== 'github-actions')
    .map(run => ({
      key: `check:${run.app?.id ?? `missing-app-${run.id}`}:${run.name}`,
      id: run.id,
      name: run.name,
      status: run.app?.id == null ? 'pending' : run.status,
      conclusion: run.conclusion
    }));
  return [...statuses, ...workflows, ...runs];
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
