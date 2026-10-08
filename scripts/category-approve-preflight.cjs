// Runs from the trusted develop checkout before pnpm or Cursor is installed.
// Only skips decided pre-classify gates; the approver rechecks them before acting.
const { BOT_LOGIN, preClassifyPull, preClassifyFiles, preClassifyDecision } = require('./shared/categoryGates.cjs');

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

const pullActions = new Set(['opened', 'ready_for_review', 'reopened', 'edited', 'submitted', 'dismissed']);

const pullNumbers = async (github, context) => {
  const {
    payload,
    repo: { owner, repo }
  } = context;
  if (payload.pull_request && pullActions.has(payload.action)) {
    return [payload.pull_request.number];
  }
  const listed = (payload.check_run?.pull_requests ?? payload.check_suite?.pull_requests ?? []).map(
    pull => pull.number
  );
  if (listed.length > 0) return listed;
  const sha = payload.check_run?.head_sha ?? payload.check_suite?.head_sha;
  if (sha === undefined) return [];
  const pulls = await github.paginate('GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls', {
    owner,
    repo,
    commit_sha: sha,
    per_page: 100
  });
  return pulls.filter(pull => pull.base?.ref === 'develop' && pull.state === 'open').map(pull => pull.number);
};

const membershipState = async (github, owner, login) => {
  try {
    const { data } = await github.request('GET /orgs/{org}/teams/{team_slug}/memberships/{username}', {
      org: owner,
      team_slug: 'ide-experience',
      username: login
    });
    return data.state;
  } catch (error) {
    if (error.status === 404) return 'none';
    throw error;
  }
};

const shouldRunForPull = async (github, owner, repo, number, runId) => {
  const { repository } = await github.graphql(pullQuery, { owner, name: repo, number });
  const pull = repository?.pullRequest;
  const logDecision = decision => {
    if (decision._tag === 'Skip') console.log(`#${number} skip (${decision.reason})`);
    return decision._tag !== 'Skip';
  };
  const pullGate = preClassifyPull(pull, 'active');
  if (pullGate) return logDecision(pullGate);
  const membership = pull.author?.login ? await membershipState(github, owner, pull.author.login) : 'none';
  const membershipGate = preClassifyPull(pull, membership);
  if (membershipGate) return logDecision(membershipGate);
  const files = await github.paginate('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
    owner,
    repo,
    pull_number: number,
    per_page: 100
  });
  const fileGate = preClassifyFiles(files);
  if (fileGate) return logDecision(fileGate);

  const [reviews, { data: status }, runs] = await Promise.all([
    github.paginate('GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
      owner,
      repo,
      pull_number: number,
      per_page: 100
    }),
    github.request('GET /repos/{owner}/{repo}/commits/{ref}/status', {
      owner,
      repo,
      ref: pull.headRefOid,
      per_page: 100
    }),
    github.paginate('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', {
      owner,
      repo,
      ref: pull.headRefOid,
      per_page: 100
    })
  ]);
  const checkRuns = runs.filter(run => !(run.details_url ?? run.html_url ?? '').includes(`/actions/runs/${runId}/`));
  return logDecision(
    preClassifyDecision({
      pull,
      teamMembershipState: membership,
      files,
      statuses: status.statuses,
      checkRuns,
      reviews,
      botLogin: BOT_LOGIN
    })
  );
};

module.exports = async ({ github, context }) => {
  if (context.payload.check_run?.name === 'category-approve') return false;
  const numbers = await pullNumbers(github, context);
  if (numbers.length === 0) {
    console.log('skip: no pull request for this check suite');
    return false;
  }
  const { owner, repo } = context.repo;
  const decisions = await Promise.all(
    numbers.map(number => shouldRunForPull(github, owner, repo, number, String(context.runId)))
  );
  return decisions.some(Boolean);
};
