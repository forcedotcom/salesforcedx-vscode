#!/usr/bin/env ts-node
import { execSync } from 'child_process';

const REPO = 'forcedotcom/salesforcedx-vscode';
const BRANCH_PREFIX = 'release/v';

const run = (cmd: string, fallback = ''): string => {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return fallback;
  }
};

const parseSemver = (branch: string): [number, number, number] => {
  const m = branch.match(/release\/v(\d+)\.(\d+)\.(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : [0, 0, 0];
};

const compareSemver = (a: string, b: string): number => {
  const [a1, a2, a3] = parseSemver(a);
  const [b1, b2, b3] = parseSemver(b);
  return a1 !== b1 ? a1 - b1 : a2 !== b2 ? a2 - b2 : a3 - b3;
};

run('git fetch origin --prune');

const remoteBranches = run(`git ls-remote --heads origin '${BRANCH_PREFIX}*'`);
const branches = remoteBranches
  .split('\n')
  .filter(Boolean)
  .map(line => line.split('\t')[1].replace('refs/heads/', ''))
  .filter(b => /^release\/v\d+\.\d+\.\d+$/.test(b))
  .sort(compareSemver);

if (branches.length === 0) {
  process.stderr.write('No release branches found\n');
  process.exit(1);
}

const currentRelease = branches[branches.length - 1];
const priorRelease = branches.length > 1 ? branches[branches.length - 2] : undefined;
const version = currentRelease.replace('release/v', '');
const priorVersion = priorRelease?.replace('release/v', '');

const currentBranch = run('git branch --show-current');
const onReleaseBranch = currentBranch === currentRelease.replace('origin/', '');

const tagExistsOutput = run(`gh release view v${version} --repo ${REPO} --json tagName 2>/dev/null`);
const tagExists = tagExistsOutput.includes(version);

const commitCount = (() => {
  if (!priorRelease) return 0;
  const result = run(
    `gh api repos/${REPO}/compare/${priorRelease}...${currentRelease} --jq '.commits | length'`
  );
  return result ? +result : 0;
})();

const branchUrl = `https://github.com/${REPO}/tree/${currentRelease}`;
const compareUrl = priorRelease
  ? `https://github.com/${REPO}/compare/${priorRelease}...${currentRelease}`
  : undefined;

process.stdout.write(
  JSON.stringify(
    {
      currentRelease,
      version,
      priorRelease,
      priorVersion,
      tagExists,
      onReleaseBranch,
      commitCount,
      branchUrl,
      compareUrl
    },
    undefined,
    2
  ) + '\n'
);
