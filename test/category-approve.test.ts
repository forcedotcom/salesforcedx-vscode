import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { withoutWorkflowRun } from '@salesforce/effect-octokit';
import { preClassifyDecision } from '../scripts/shared/categoryGates.cjs';
import {
  BOT_LOGIN,
  buildPrompt,
  categoryIdsFromPolicy,
  classifyGit2GusConfig,
  decideCategoryApprove,
  deniedFile,
  parseAgentResult
} from '../scripts/shared/categoryDecision.ts';

const policy = readFileSync(new URL('../APPROVAL_POLICY.md', import.meta.url), 'utf8');
const config = readFileSync(new URL('../.git2gus/config.json', import.meta.url), 'utf8');
const buildNumber = Number(config.match(/"defaultBuild": "offcore\.tooling\.(\d+)"/)?.[1]);
const configWithBuild = (value: string) =>
  config.replace(/"defaultBuild": "offcore\.tooling\.\d+"/, `"defaultBuild": "${value}"`);
const nextConfig = configWithBuild(`offcore.tooling.${buildNumber + 1}`);
const allowed = categoryIdsFromPolicy(policy);
const file = (filename: string) => ({ filename });
const pull = {
  reviewDecision: 'REVIEW_REQUIRED',
  isDraft: false,
  state: 'open',
  baseRefName: 'develop',
  headRefOid: 'abc123',
  author: { login: 'mshanemc' },
  headRepository: { nameWithOwner: 'forcedotcom/salesforcedx-vscode' },
  baseRepository: { nameWithOwner: 'forcedotcom/salesforcedx-vscode' }
};
const green = { status: 'completed', conclusion: 'success' };

const base = {
  pull,
  teamMembershipState: 'active',
  files: [file('README.md')],
  statuses: [],
  checkRuns: [green],
  reviews: [],
  allowedCategories: allowed,
  botLogin: BOT_LOGIN
};

test('policy category ids match the headings', () => {
  assert.deepEqual(allowed, [
    'claude',
    'cursor',
    'eslint',
    'vscode',
    'metadata-types',
    'effect-diagnostics',
    'git2gus-config',
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

test('preflight and approver use the same pre-classify decision', () => {
  const approved = { user: { login: BOT_LOGIN }, state: 'APPROVED', commit_id: pull.headRefOid };
  for (const changes of [
    {},
    { files: [file('APPROVAL_POLICY.md')] },
    { checkRuns: [{ conclusion: 'failure' }] },
    { reviews: [approved] },
    { reviews: [approved], checkRuns: [{ conclusion: 'failure' }] }
  ]) {
    const facts = { ...base, ...changes };
    assert.deepEqual(decideCategoryApprove(facts), preClassifyDecision(facts));
  }
});

test('approves a non-empty known category union', () => {
  const decision = decideCategoryApprove({ ...base, categories: ['prose', 'tests-only'] });
  assert.equal(decision._tag, 'Approve');
  assert.match(decision.reason, /prose, tests-only/);
});

test('rejects an agent git2gus-config classification for a non-config diff', () => {
  assert.equal(decideCategoryApprove({ ...base, categories: ['git2gus-config'] })._tag, 'Skip');
  assert.equal(decideCategoryApprove({ ...base, categories: ['prose', 'git2gus-config'] })._tag, 'Skip');
});

test('approves only a newer git2gus defaultBuild in an otherwise unchanged config-only PR', () => {
  const files = [{ filename: '.git2gus/config.json', status: 'modified' }] as const;
  const categories = classifyGit2GusConfig(files, config, nextConfig);
  assert.deepEqual(categories, ['git2gus-config']);
  assert.equal(decideCategoryApprove({ ...base, files, categories })._tag, 'Approve');
});

test('rejects git2gus edits mixed with another file, even if that file has a category', () => {
  const files = [
    { filename: '.git2gus/config.json', status: 'modified' },
    { filename: 'README.md', status: 'modified' }
  ] as const;
  assert.deepEqual(classifyGit2GusConfig(files, config, nextConfig), []);
  assert.equal(decideCategoryApprove({ ...base, files, categories: [] })._tag, 'Skip');
});

test('rejects unsupported git2gus config changes', () => {
  const files = [{ filename: '.git2gus/config.json', status: 'modified' }] as const;
  const cases = [
    config,
    configWithBuild(`offcore.tooling.${buildNumber - 1}`),
    configWithBuild('offcore.tooling.other'),
    configWithBuild(`other.tooling.${buildNumber + 1}`),
    configWithBuild('offcore.tooling.9007199254740992'),
    config.replace('"statusWhenClosed": "CLOSED"', '"statusWhenClosed": "FIXED"'),
    config.replace('"area:apex":', '"area:new":'),
    config.replace('"type:bug":', '"type:new":'),
    nextConfig.replace('"hideWorkItemUrl": "true"', '"hideWorkItemUrl": "false"'),
    nextConfig.replace('"statusWhenClosed":', '"unknownField":'),
    nextConfig.replace(/}\s*$/, '')
  ];
  for (const candidate of cases) {
    assert.deepEqual(classifyGit2GusConfig(files, config, candidate), [], candidate);
  }
  assert.deepEqual(classifyGit2GusConfig([{ filename: '.git2gus/config.json', status: 'added' }], config, config), []);
  assert.deepEqual(
    classifyGit2GusConfig([{ filename: '.git2gus/config.json', status: 'removed' }], config, nextConfig),
    []
  );
  assert.deepEqual(
    classifyGit2GusConfig(
      [{ filename: 'README.md', previous_filename: '.git2gus/config.json', status: 'renamed' }],
      config,
      nextConfig
    ),
    []
  );
});

test('skips an empty union and an unknown category', () => {
  assert.equal(decideCategoryApprove({ ...base, categories: [] })._tag, 'Skip');
  assert.equal(decideCategoryApprove({ ...base, categories: ['ship-it'] })._tag, 'Skip');
});

test('skips denylist paths before classify', () => {
  assert.equal(
    deniedFile([file('packages/foo/src/a.ts'), file('.github/workflows/ci.yml')]),
    '.github/workflows/ci.yml'
  );
  assert.equal(decideCategoryApprove({ ...base, files: [file('.claude/skills/wireit/SKILL.md')] })._tag, 'Classify');
  assert.equal(decideCategoryApprove({ ...base, files: [file('.claude/plans/W-1.md')] })._tag, 'Classify');
  assert.equal(
    decideCategoryApprove({ ...base, files: [file('.claude/workflows/auto-build-wi.js')] })._tag,
    'Classify'
  );
  assert.equal(decideCategoryApprove({ ...base, files: [file('.claude/settings.json')] })._tag, 'Classify');
  assert.equal(decideCategoryApprove({ ...base, files: [file('eslint.config.mjs')] })._tag, 'Classify');
  assert.equal(
    decideCategoryApprove({ ...base, files: [file('packages/eslint-local-rules/src/index.ts')] })._tag,
    'Classify'
  );
  assert.equal(decideCategoryApprove({ ...base, files: [file('.vscode/cspell.json')] })._tag, 'Classify');
  assert.equal(
    decideCategoryApprove({
      ...base,
      files: [file('packages/salesforcedx-vscode-core/metadata_types_map_scraped.json')]
    })._tag,
    'Classify'
  );
  assert.equal(decideCategoryApprove({ ...base, files: [file('APPROVAL_POLICY.md')] })._tag, 'Skip');
  assert.equal(decideCategoryApprove({ ...base, files: [file('.cursor/rules/wireit.mdc')] })._tag, 'Classify');
  assert.equal(decideCategoryApprove({ ...base, files: [file('.cursor/commands/analyze-e2e.md')] })._tag, 'Classify');
  assert.equal(
    decideCategoryApprove({ ...base, files: [file('.cursor/skills/changelog-judgment/SKILL.md')] })._tag,
    'Classify'
  );
});

test('skips forks, drafts, dependabot, changes requested, and a failed check', () => {
  assert.equal(
    decideCategoryApprove({
      ...base,
      pull: { ...pull, headRepository: { nameWithOwner: 'other/salesforcedx-vscode' } }
    })._tag,
    'Skip'
  );
  assert.equal(decideCategoryApprove({ ...base, pull: { ...pull, isDraft: true } })._tag, 'Skip');
  assert.equal(
    decideCategoryApprove({ ...base, pull: { ...pull, author: { login: 'dependabot[bot]' } } })._tag,
    'Skip'
  );
  assert.equal(decideCategoryApprove({ ...base, pull: { ...pull, reviewDecision: 'CHANGES_REQUESTED' } })._tag, 'Skip');
  assert.equal(
    decideCategoryApprove({ ...base, checkRuns: [{ status: 'completed', conclusion: 'failure' }] })._tag,
    'Skip'
  );
});

test('classifies while the rollup is still settling', () => {
  assert.equal(decideCategoryApprove({ ...base, checkRuns: [] })._tag, 'Classify');
  assert.equal(
    decideCategoryApprove({ ...base, checkRuns: [{ status: 'in_progress', conclusion: null }] })._tag,
    'Classify'
  );
});

test('dismisses a bot approval on this sha when a check failed', () => {
  const reviews = [{ user: { login: 'svc-idee-bot' }, state: 'APPROVED', commit_id: 'abc123' }];
  const decision = decideCategoryApprove({
    ...base,
    reviews,
    checkRuns: [{ status: 'completed', conclusion: 'failure' }]
  });
  assert.equal(decision._tag, 'Dismiss');
});

test('drops this workflow run from the rollup', () => {
  const runs = [
    { details_url: 'https://github.com/acme/repo/actions/runs/9/job/1', html_url: null },
    { details_url: 'https://github.com/acme/repo/actions/runs/4/job/2', html_url: null }
  ];
  assert.equal(withoutWorkflowRun(runs, '9').length, 1);
});

test('parses categories from the agent json envelope', () => {
  const stdout = JSON.stringify({ result: 'looks fine\n{"categories":["prose","lockfile"]}\n' });
  assert.deepEqual(parseAgentResult(stdout), ['prose', 'lockfile']);
  assert.deepEqual(parseAgentResult('{"categories":["git2gus-config"]}'), []);
  assert.deepEqual(parseAgentResult('{"categories":["prose","git2gus-config"]}'), []);
  assert.equal(parseAgentResult('not json'), undefined);
});
