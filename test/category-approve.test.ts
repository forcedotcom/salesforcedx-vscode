import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  buildPrompt,
  categoryIdsFromPolicy,
  decideCategoryApprove,
  deniedFile,
  parseAgentResult,
  withoutOwnRun
} from '../scripts/shared/categoryDecision.ts';

const policy = readFileSync(new URL('../APPROVAL_POLICY.md', import.meta.url), 'utf8');
const allowed = categoryIdsFromPolicy(policy);
const green = { status: 'completed', conclusion: 'SUCCESS' };

const base = {
  isPullRequest: true,
  baseRef: 'develop',
  prState: 'open',
  prDraft: false,
  reviewDecision: 'REVIEW_REQUIRED',
  authorLogin: 'mshanemc',
  teamMembershipState: 'active',
  headRepoFullName: 'forcedotcom/salesforcedx-vscode',
  baseRepoFullName: 'forcedotcom/salesforcedx-vscode',
  headSha: 'abc123',
  files: ['README.md'],
  checks: [green],
  reviews: [],
  allowedCategories: allowed
};

test('policy category ids match the headings', () => {
  assert.deepEqual(allowed, [
    'claude',
    'eslint',
    'vscode',
    'metadata-types',
    'effect-diagnostics',
    'changelog-constants',
    'plans',
    'prose',
    'tests-only',
    'dep-bump',
    'dep-move',
    'lockfile',
    'messages',
    'format-or-comments',
    'sha256',
    'dependabot',
    'services-types'
  ]);
});

test('prompt names the diff file and carries no pull request body', () => {
  const prompt = buildPrompt(policy, '/tmp/category-approve/pr.diff');
  assert.match(prompt, /\/tmp\/category-approve\/pr\.diff/);
  assert.match(prompt, /Read that file and no other file/);
  assert.equal(prompt.includes('pull request body'), false);
});

test('classifies when the gates pass', () => {
  assert.equal(decideCategoryApprove(base)._tag, 'Classify');
});

test('approves a non-empty known category union', () => {
  const decision = decideCategoryApprove({ ...base, categories: ['prose', 'tests-only'] });
  assert.equal(decision._tag, 'Approve');
  assert.match(decision.reason, /prose, tests-only/);
});

test('skips an empty union and an unknown category', () => {
  assert.equal(decideCategoryApprove({ ...base, categories: [] })._tag, 'Skip');
  assert.equal(decideCategoryApprove({ ...base, categories: ['ship-it'] })._tag, 'Skip');
});

test('skips denylist paths before classify', () => {
  assert.equal(deniedFile(['packages/foo/src/a.ts', '.github/workflows/ci.yml']), '.github/workflows/ci.yml');
  assert.equal(decideCategoryApprove({ ...base, files: ['.claude/skills/wireit/SKILL.md'] })._tag, 'Classify');
  assert.equal(decideCategoryApprove({ ...base, files: ['.claude/plans/W-1.md'] })._tag, 'Classify');
  assert.equal(decideCategoryApprove({ ...base, files: ['.claude/workflows/auto-build-wi.js'] })._tag, 'Classify');
  assert.equal(decideCategoryApprove({ ...base, files: ['.claude/settings.json'] })._tag, 'Classify');
  assert.equal(decideCategoryApprove({ ...base, files: ['eslint.config.mjs'] })._tag, 'Classify');
  assert.equal(
    decideCategoryApprove({ ...base, files: ['packages/eslint-local-rules/src/index.ts'] })._tag,
    'Classify'
  );
  assert.equal(decideCategoryApprove({ ...base, files: ['.vscode/cspell.json'] })._tag, 'Classify');
  assert.equal(
    decideCategoryApprove({
      ...base,
      files: ['packages/salesforcedx-vscode-core/metadata_types_map_scraped.json']
    })._tag,
    'Classify'
  );
  assert.equal(decideCategoryApprove({ ...base, files: ['APPROVAL_POLICY.md'] })._tag, 'Skip');
  assert.equal(decideCategoryApprove({ ...base, files: ['.cursor/rules/wireit.mdc'] })._tag, 'Skip');
});

test('skips forks, drafts, dependabot, changes requested, and a quiet rollup', () => {
  assert.equal(decideCategoryApprove({ ...base, headRepoFullName: 'other/salesforcedx-vscode' })._tag, 'Skip');
  assert.equal(decideCategoryApprove({ ...base, prDraft: true })._tag, 'Skip');
  assert.equal(decideCategoryApprove({ ...base, authorLogin: 'dependabot[bot]' })._tag, 'Skip');
  assert.equal(decideCategoryApprove({ ...base, reviewDecision: 'CHANGES_REQUESTED' })._tag, 'Skip');
  assert.equal(decideCategoryApprove({ ...base, checks: [] })._tag, 'Skip');
  assert.equal(decideCategoryApprove({ ...base, checks: [{ status: 'in_progress', conclusion: null }] })._tag, 'Skip');
});

test('dismisses a bot approval on this sha when a check failed', () => {
  const reviews = [{ authorLogin: 'svc-idee-bot', state: 'APPROVED', commitOid: 'abc123' }];
  const decision = decideCategoryApprove({
    ...base,
    reviews,
    checks: [{ status: 'completed', conclusion: 'FAILURE' }]
  });
  assert.equal(decision._tag, 'Dismiss');
});

test('drops this workflow run from the rollup', () => {
  const checks = [
    { conclusion: 'SUCCESS', detailsUrl: 'https://github.com/acme/repo/actions/runs/9/job/1' },
    { conclusion: 'SUCCESS', detailsUrl: 'https://github.com/acme/repo/actions/runs/4/job/2' }
  ];
  assert.equal(withoutOwnRun(checks, '9').length, 1);
});

test('parses categories from the agent json envelope', () => {
  const stdout = JSON.stringify({ result: 'looks fine\n{"categories":["prose","lockfile"]}\n' });
  assert.deepEqual(parseAgentResult(stdout), ['prose', 'lockfile']);
  assert.equal(parseAgentResult('not json'), undefined);
});
