// Dependency-free gates shared by the preflight and the trusted approver.
const BASE_BRANCH = 'develop';
const BOT_LOGIN = 'svc-idee-bot';
const DENYLIST = [/(^|\/)CODEOWNERS$/, /^APPROVAL_POLICY\.md$/, /^\.github\/workflows\/.+/, /(^|\/)out\//];
const failed = new Set(['failure', 'cancelled', 'timed_out', 'error', 'action_required', 'startup_failure']);

const skip = reason => ({ _tag: 'Skip', reason });

const deniedFile = files =>
  files.map(file => file.filename).find(filename => DENYLIST.some(pattern => pattern.test(filename)));

const preClassifyFiles = files => {
  const denied = deniedFile(files);
  if (denied !== undefined) return skip(`denylist ${denied}`);
};

const preClassifyPull = (pull, teamMembershipState) => {
  if (pull === undefined) return skip('not a pull request');
  if (pull.baseRefName !== BASE_BRANCH) return skip('base branch is not develop');
  if (pull.state.toLowerCase() !== 'open') return skip('pull request is not open');
  if (pull.isDraft) return skip('pull request is a draft');
  if (pull.reviewDecision === 'CHANGES_REQUESTED') return skip('review is CHANGES_REQUESTED');
  if (pull.author?.login === 'dependabot[bot]') return skip('author is dependabot');
  if (!pull.headRepository || pull.headRepository.nameWithOwner !== pull.baseRepository?.nameWithOwner) {
    return skip('pull request is from a fork');
  }
  if (teamMembershipState !== 'active') {
    return skip('author is not an active @forcedotcom/ide-experience member');
  }
  if (!pull.headRefOid) return skip('missing head sha');
};

const preClassifyDecision = input => {
  const pullGate = preClassifyPull(input.pull, input.teamMembershipState);
  if (pullGate) return pullGate;
  const fileGate = preClassifyFiles(input.files);
  if (fileGate) return fileGate;
  const approved = input.reviews.some(
    review =>
      review.user?.login === input.botLogin && review.state === 'APPROVED' && review.commit_id === input.pull.headRefOid
  );
  const checkFailed = [...input.statuses, ...input.checkRuns].some(check =>
    failed.has((check.conclusion ?? check.state ?? 'pending').toLowerCase())
  );
  if (checkFailed && approved) return { _tag: 'Dismiss', reason: 'a check failed after approval' };
  if (checkFailed) return skip('a check failed');
  if (approved) return skip('bot already approved this head');
  return { _tag: 'Classify', reason: 'gates passed' };
};

module.exports = { BASE_BRANCH, BOT_LOGIN, deniedFile, preClassifyPull, preClassifyFiles, preClassifyDecision };
