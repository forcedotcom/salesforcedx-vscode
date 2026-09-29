#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BASE_BRANCH,
  MODEL,
  buildPrompt,
  categoryIdsFromPolicy,
  decideCategoryApprove,
  parseAgentResult,
  withoutOwnRun
} from './category-approve.mjs';
import { BOT_LOGIN, TEAM_ORG, TEAM_SLUG } from './ai-auto-approve.mjs';

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

const listAll = async (path, token) => {
  const pages = async page => {
    const batch = await gh(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`, { token });
    return batch.length < 100 ? batch : [...batch, ...(await pages(page + 1))];
  };
  return pages(1);
};

const listFiles = ({ token, owner, repo, pullNumber }) =>
  listAll(`/repos/${owner}/${repo}/pulls/${pullNumber}/files`, token).then(files => files.map(file => file.filename));

const listReviews = async ({ token, owner, repo, pullNumber }) => {
  const reviews = await listAll(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, token);
  return reviews.map(review => ({
    id: review.id,
    authorLogin: review.user?.login,
    state: review.state,
    commitOid: review.commit_id
  }));
};

const listCheckRuns = async ({ token, owner, repo, headSha, page }) => {
  const data = await gh(`/repos/${owner}/${repo}/commits/${headSha}/check-runs?per_page=100&page=${page}`, { token });
  const runs = data.check_runs ?? [];
  return runs.length < 100
    ? runs
    : [...runs, ...(await listCheckRuns({ token, owner, repo, headSha, page: page + 1 }))];
};

const listChecks = async ({ token, owner, repo, headSha, runId }) => {
  const [combined, checkRuns] = await Promise.all([
    gh(`/repos/${owner}/${repo}/commits/${headSha}/status`, { token }),
    listCheckRuns({ token, owner, repo, headSha, page: 1 })
  ]);
  const statuses = (combined.statuses ?? []).map(status => ({
    name: status.context,
    state: status.state,
    conclusion: status.state,
    detailsUrl: status.target_url
  }));
  const runs = checkRuns.map(run => ({
    name: run.name,
    status: run.status,
    conclusion: run.conclusion,
    detailsUrl: run.details_url ?? run.html_url
  }));
  return withoutOwnRun([...statuses, ...runs], runId);
};

const pullFacts = async ({ token, owner, repo, pullNumber }) => {
  const data = await gh('/graphql', {
    method: 'POST',
    token,
    body: {
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
    }
  });
  return data.data.repository.pullRequest;
};

const gitText = args => {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  return result.stdout;
};

const classify = ({ policy, diff }) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      'agent',
      ['-p', '--model', MODEL, '--output-format', 'json', buildPrompt({ policy, diffPath: diff })],
      {
        env: Object.fromEntries(
          Object.entries({
            ...process.env,
            PATH: `${process.env.HOME ?? ''}/.local/bin:${process.env.PATH ?? ''}`
          }).filter(([key]) => !['IDEE_GH_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN'].includes(key))
        ),
        stdio: ['ignore', 'pipe', 'pipe']
      }
    );
    const out = [];
    const err = [];
    child.stdout.on('data', chunk => out.push(chunk));
    child.stderr.on('data', chunk => err.push(chunk));
    child.on('error', reject);
    child.on('close', code => {
      const stdout = Buffer.concat(out).toString();
      const stderr = Buffer.concat(err).toString();
      if (code !== 0) {
        reject(new Error(`agent exited ${code}: ${stderr}`));
        return;
      }
      resolve(parseAgentResult(stdout));
    });
  });

const approve = ({ token, owner, repo, pullNumber, headSha, categories }) =>
  gh(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, {
    method: 'POST',
    token,
    body: {
      commit_id: headSha,
      event: 'APPROVE',
      body: `Category union: ${categories.join(', ')}. Judged from the diff.`
    }
  });

const dismiss = ({ token, owner, repo, pullNumber, reviewId }) =>
  gh(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews/${reviewId}/dismissals`, {
    method: 'PUT',
    token,
    body: { message: 'A check on this SHA failed after category approve.', event: 'DISMISS' }
  });

const pullNumbers = async ({ token, owner, repo, event }) => {
  const fromSuite = (event.check_run?.pull_requests ?? event.check_suite?.pull_requests ?? [])
    .map(pull => pull.number)
    .filter(Boolean);
  if (fromSuite.length > 0) return fromSuite;
  const sha = event.check_run?.head_sha ?? event.check_suite?.head_sha;
  if (!sha) return [];
  const pulls = await gh(`/repos/${owner}/${repo}/commits/${sha}/pulls`, { token });
  return pulls.filter(pull => pull.base?.ref === BASE_BRANCH && pull.state === 'open').map(pull => pull.number);
};

const onePull = async ({ token, owner, repo, pullNumber, runId }) => {
  const pr = await pullFacts({ token, owner, repo, pullNumber });
  const headSha = pr.headRefOid ?? '';
  const [files, reviews, checks] = await Promise.all([
    listFiles({ token, owner, repo, pullNumber }),
    listReviews({ token, owner, repo, pullNumber }),
    listChecks({ token, owner, repo, headSha, runId })
  ]);
  const facts = {
    isPullRequest: true,
    baseRef: pr.baseRefName,
    prState: pr.state?.toLowerCase(),
    prDraft: Boolean(pr.isDraft),
    reviewDecision: pr.reviewDecision,
    authorLogin: pr.author?.login,
    teamMembershipState: await teamMembershipState({ token, login: pr.author?.login }),
    headRepoFullName: pr.headRepository?.nameWithOwner,
    baseRepoFullName: pr.baseRepository?.nameWithOwner,
    headSha,
    files,
    checks,
    reviews,
    botLogin: BOT_LOGIN
  };
  const gated = decideCategoryApprove(facts);
  console.log(`#${pullNumber} ${gated.action} (${gated.reason})`);
  if (gated.action === 'dismiss') {
    const review = reviews.find(
      item => item.authorLogin === BOT_LOGIN && item.state === 'APPROVED' && item.commitOid === headSha
    );
    if (review) await dismiss({ token, owner, repo, pullNumber, reviewId: review.id });
    return;
  }
  if (gated.action !== 'classify') return;

  gitText(['fetch', 'origin', pr.baseRefName]);
  const policy = gitText(['show', `origin/${pr.baseRefName}:APPROVAL_POLICY.md`]);
  const diff = gitText(['diff', `origin/${pr.baseRefName}...HEAD`]);
  const dir = await mkdtemp(join(tmpdir(), 'category-approve-'));
  const diffPath = join(dir, 'pr.diff');
  await writeFile(diffPath, diff);
  const categories = await classify({ policy, diff: diffPath });
  const freshChecks = await listChecks({ token, owner, repo, headSha, runId });
  const decision = decideCategoryApprove({
    ...facts,
    checks: freshChecks,
    categories,
    allowedCategories: categoryIdsFromPolicy(policy)
  });
  console.log(`#${pullNumber} ${decision.action} (${decision.reason})`);
  if (decision.action === 'dismiss') {
    const review = reviews.find(
      item => item.authorLogin === BOT_LOGIN && item.state === 'APPROVED' && item.commitOid === headSha
    );
    if (review) await dismiss({ token, owner, repo, pullNumber, reviewId: review.id });
    return;
  }
  if (decision.action !== 'approve') return;
  await approve({ token, owner, repo, pullNumber, headSha, categories });
  console.log(`approved ${owner}/${repo}#${pullNumber} at ${headSha}`);
};

const main = async () => {
  const token = process.env.IDEE_GH_TOKEN;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!token) throw new Error('IDEE_GH_TOKEN is required');
  if (!eventPath) throw new Error('GITHUB_EVENT_PATH is required');
  const event = JSON.parse(await readFile(eventPath, 'utf8'));
  if (event.check_run?.name === 'category-approve') {
    console.log('skip: own check run');
    return;
  }
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
  const numbers = await pullNumbers({ token, owner, repo, event });
  if (numbers.length === 0) {
    console.log('skip: no pull request for this check suite');
    return;
  }
  await numbers.reduce(
    (chain, pullNumber) =>
      chain.then(() => onePull({ token, owner, repo, pullNumber, runId: process.env.GITHUB_RUN_ID })),
    Promise.resolve()
  );
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
