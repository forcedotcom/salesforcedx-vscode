/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as NodeServices from '@effect/platform-node/NodeServices';
import { actionsEnvironment, GitHub, GitHubLayer, readPullRequestEvent } from '@salesforce/effect-octokit';
import { Effect, Exit, Layer, Logger, Option, Result, Schema } from 'effect';
import * as FileSystem from 'effect/FileSystem';
import * as Path from 'effect/Path';
import { pathToFileURL } from 'node:url';
import { commandOutput } from '../commandOutput.mts';
import { openCodePrompt } from '../shared/openCode.mts';
import { CommandFailed, InvalidBaseRef, Judgment, type Item } from './schema.mts';

const skillPath = '.opencode/skills/manual-test-plan-judgment/SKILL.md';
const startMarker = '<!-- manual-test-plan -->';
const endMarker = '<!-- /manual-test-plan -->';
const excludedWorkflows = new Set(['e2e.yml', 'playwrightE2EFullSuite.yml', 'rerunPushE2E.yml']);
const ciPackages = new Set(['drivable-vscode', 'effect-octokit', 'eslint-local-rules', 'playwright-vscode-ext']);

export const isRelevantDiffPath = (file: string) => {
  const parts = file.split('/');
  return (
    !parts.includes('test') &&
    !file.startsWith('.github/') &&
    !(parts[0] === 'packages' && ciPackages.has(parts[1] ?? ''))
  );
};
// Git hooks export these for their own worktree. This script's git calls use
// an explicit cwd and must not inherit another worktree's repository or index.
const gitLocalEnv = {
  GIT_ALTERNATE_OBJECT_DIRECTORIES: undefined,
  GIT_CONFIG: undefined,
  GIT_CONFIG_PARAMETERS: undefined,
  GIT_CONFIG_COUNT: undefined,
  GIT_OBJECT_DIRECTORY: undefined,
  GIT_DIR: undefined,
  GIT_WORK_TREE: undefined,
  GIT_IMPLICIT_WORK_TREE: undefined,
  GIT_GRAFT_FILE: undefined,
  GIT_INDEX_FILE: undefined,
  GIT_NO_REPLACE_OBJECTS: undefined,
  GIT_REPLACE_REF_BASE: undefined,
  GIT_PREFIX: undefined,
  GIT_SHALLOW_FILE: undefined,
  GIT_COMMON_DIR: undefined
};

type Outcome = { readonly edited: boolean };
export type PromptInput = { readonly skill: string; readonly diff: string; readonly correction?: string };
type Attempt =
  | { readonly _tag: 'opencode'; readonly message: string }
  | { readonly _tag: 'retry'; readonly text: string; readonly error: string }
  | { readonly _tag: 'ok'; readonly judgment: typeof Judgment.Type };

const baseRefOk = (ref: string) => /^[A-Za-z0-9._/-]+$/.test(ref) && !ref.split('/').includes('..');

const isLeafE2E = (name: string) => name.endsWith('E2E.yml') && !excludedWorkflows.has(name);

const workflowName = (text: string) =>
  text
    .split('\n')
    .find(line => line.startsWith('name:'))
    ?.slice('name:'.length)
    .trim()
    .replaceAll(/^['"]|['"]$/g, '');

const jobKeys = (text: string) => {
  const lines = text.split('\n');
  const start = lines.indexOf('jobs:');
  const rest = start < 0 ? [] : lines.slice(start + 1);
  const end = rest.findIndex(line => line.length > 0 && !line.startsWith(' ') && !line.startsWith('#'));
  return (end < 0 ? rest : rest.slice(0, end)).flatMap(
    line => /^  ([A-Za-z0-9_-]+):\s*(?:#.*)?$/.exec(line)?.[1] ?? []
  );
};

const playwrightSpec = (spec: string) => {
  const parts = spec.split('/');
  const testAt = parts.indexOf('test');
  return (
    spec.endsWith('.spec.ts') &&
    !spec.startsWith('/') &&
    !parts.includes('..') &&
    testAt >= 0 &&
    parts[testAt + 1] === 'playwright'
  );
};

const itemLine = (item: Item) =>
  item.kind === 'watch-video'
    ? `- [ ] Watch video: \`${item.spec}\` in \`${item.workflow}\` (\`${item.job}\`)`
    : `- [ ] ${item.step}`;

export const renderManualTestPlan = (judgment: typeof Judgment.Type) => {
  const body =
    judgment.kind === 'nothing' ? 'Nothing worth manually testing.' : judgment.items.map(itemLine).join('\n');
  return `${startMarker}\n## Manual test plan\n\n${body}\n${endMarker}`;
};

export const spliceManualTestPlan = (body: string, block: string) => {
  const start = body.indexOf(startMarker);
  const end = body.indexOf(endMarker);
  return start >= 0 && end > start
    ? `${body.slice(0, start)}${block}${body.slice(end + endMarker.length)}`
    : body.length === 0
      ? `${block}\n`
      : `${body}${body.endsWith('\n') ? '\n' : '\n\n'}${block}\n`;
};

const git = Effect.fn('manualTestPlan.git')(function* (cwd: string, args: readonly string[]) {
  return yield* commandOutput({ executable: 'git', args, cwd, env: gitLocalEnv, extendEnv: true }).pipe(
    Effect.map(({ stdout }) => stdout),
    Effect.catchTag('CommandFailed', error =>
      Effect.fail(new CommandFailed({ command: 'git', code: error.exitCode, message: error.message }))
    )
  );
});

type WorkflowName = { readonly name: string; readonly jobs: readonly string[] };

const workflowCatalog = Effect.fn('manualTestPlan.workflowCatalog')(function* (cwd: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = path.join(cwd, '.github', 'workflows');
  const names = yield* fs.readDirectory(dir).pipe(Effect.orElseSucceed(() => new Array<string>()));
  const rows = yield* Effect.forEach(names.filter(isLeafE2E), name =>
    fs.readFileString(path.join(dir, name)).pipe(
      Effect.map(text => {
        const nameOf = workflowName(text);
        return nameOf === undefined || nameOf.length === 0
          ? Option.none<WorkflowName>()
          : Option.some<WorkflowName>({ name: nameOf, jobs: jobKeys(text) });
      })
    )
  );
  return rows.flatMap(row => (Option.isNone(row) ? [] : [row.value]));
});

const watchVideoProblem = (
  exists: boolean,
  workflows: readonly WorkflowName[],
  item: Item & { readonly kind: 'watch-video' }
) => {
  const named = workflows.filter(workflow => workflow.name === item.workflow);
  const problems = [
    playwrightSpec(item.spec) ? undefined : `spec ${item.spec} is not a test/playwright .spec.ts path`,
    playwrightSpec(item.spec) && !exists ? `spec ${item.spec} does not exist` : undefined,
    named.length === 0 ? `workflow ${item.workflow} is not a leaf E2E workflow name` : undefined,
    named.length > 0 && !named.some(workflow => workflow.jobs.includes(item.job))
      ? `job ${item.job} is not in ${item.workflow}`
      : undefined
  ].flatMap(problem => (problem === undefined ? [] : [problem]));
  return problems.length === 0 ? undefined : problems.join('; ');
};

export const judgmentError = Effect.fn('manualTestPlan.judgmentError')(function* (
  cwd: string,
  judgment: typeof Judgment.Type
) {
  if (judgment.kind === 'nothing') return undefined;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workflows = yield* workflowCatalog(cwd);
  const problems = yield* Effect.forEach(judgment.items, item =>
    item.kind === 'manual'
      ? Effect.succeed(Option.none<string>())
      : fs
          .exists(path.join(cwd, item.spec))
          .pipe(Effect.map(exists => Option.fromUndefinedOr(watchVideoProblem(exists, workflows, item))))
  );
  const messages = problems.flatMap(problem => (Option.isNone(problem) ? [] : [problem.value]));
  return messages.length === 0 ? undefined : messages.join('\n');
});

export const manualTestPlanPrompt = Effect.fn('manualTestPlan.prompt')(function* (cwd: string, input: PromptInput) {
  const readDirectory = yield* FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.realPath(cwd)));
  const correction = input.correction === undefined ? '' : `\n\nPrevious reply failed validation:\n${input.correction}`;
  return yield* openCodePrompt({
    prompt: `${input.skill}\n\nRepository (read-only): ${readDirectory}\n\nDiff:\n${input.diff}${correction}`,
    readDirectory
  });
});

const readPrBody = Effect.fn('manualTestPlan.readPrBody')(function* (owner: string, repo: string, pr: number) {
  return yield* GitHub.pipe(Effect.flatMap(github => github.pullBody(owner, repo, pr)));
});

const writePrBody = Effect.fn('manualTestPlan.writePrBody')(function* (
  owner: string,
  repo: string,
  pr: number,
  body: string
) {
  yield* GitHub.pipe(Effect.flatMap(github => github.updatePullBody(owner, repo, pr, body)));
});

const skip = (reason: string, message: string) =>
  Effect.logWarning('manual test plan skipped', { reason, message }).pipe(
    Effect.as({ edited: false } satisfies Outcome)
  );

const attempt = Effect.fn('manualTestPlan.attempt')(function* (
  prompt: (input: PromptInput) => ReturnType<typeof manualTestPlanPrompt>,
  skill: string,
  diff: string,
  cwd: string,
  correction: string | undefined
) {
  const text = yield* prompt({ skill, diff, ...(correction === undefined ? {} : { correction }) }).pipe(Effect.result);
  if (Result.isFailure(text)) return { _tag: 'opencode', message: text.failure.message } satisfies Attempt;
  const decoded = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Judgment))(text.success).pipe(Effect.result);
  if (Result.isFailure(decoded))
    return {
      _tag: 'retry',
      text: text.success,
      error: `judgment JSON failed schema: ${decoded.failure.message}`
    } satisfies Attempt;
  const problem = yield* judgmentError(cwd, decoded.success);
  return problem === undefined
    ? ({ _tag: 'ok', judgment: decoded.success } satisfies Attempt)
    : ({ _tag: 'retry', text: text.success, error: problem } satisfies Attempt);
});

export type ManualTestPlanDeps = {
  readonly cwd?: string;
  readonly prompt?: (input: PromptInput) => ReturnType<typeof manualTestPlanPrompt>;
  readonly readBody?: (pr: number) => Effect.Effect<string>;
  readonly writeBody?: (pr: number, body: string) => Effect.Effect<void>;
};

export const manualTestPlanProgram = Effect.fn('manualTestPlan.program')(function* (deps?: ManualTestPlanDeps) {
  const env = yield* actionsEnvironment();
  const base = yield* Option.match(env.baseRef, {
    onNone: () => Effect.fail(new InvalidBaseRef({ ref: 'GITHUB_BASE_REF', message: 'GITHUB_BASE_REF is missing' })),
    onSome: ref =>
      baseRefOk(ref)
        ? Effect.succeed(ref)
        : Effect.fail(new InvalidBaseRef({ ref, message: `refused base ref ${ref}` }))
  });
  const pr = yield* readPullRequestEvent(env.eventPath).pipe(Effect.map(event => event.pull_request.number));
  const cwd =
    deps?.cwd ?? (yield* git(process.cwd(), ['rev-parse', '--show-toplevel']).pipe(Effect.map(root => root.trim())));
  yield* Effect.annotateCurrentSpan('pr', String(pr));
  yield* git(cwd, ['fetch', 'origin', base]);
  const skill = yield* git(cwd, ['show', `origin/${base}:${skillPath}`]).pipe(Effect.option);
  if (Option.isNone(skill)) return yield* skip('missing-skill', `origin/${base}:${skillPath} is missing`);
  const changedPaths = yield* git(cwd, ['diff', '--name-only', '-z', `origin/${base}...HEAD`]);
  const relevantPaths = changedPaths.split('\0').filter(path => path.length > 0 && isRelevantDiffPath(path));
  if (relevantPaths.length === 0)
    return yield* skip('no-user-facing-changes', 'PR diff only changes tests or CI tooling');
  const diff = yield* git(cwd, ['diff', `origin/${base}...HEAD`, '--', ...relevantPaths]);
  const prompt = deps?.prompt ?? ((input: PromptInput) => manualTestPlanPrompt(cwd, input));
  const judged = yield* attempt(prompt, skill.value, diff, cwd, undefined).pipe(
    Effect.flatMap(first =>
      first._tag === 'retry'
        ? attempt(prompt, skill.value, diff, cwd, `${first.error}\n\nPrevious reply:\n${first.text}`)
        : Effect.succeed(first)
    )
  );
  if (judged._tag === 'opencode') return yield* skip('opencode', judged.message);
  if (judged._tag === 'retry') return yield* skip('schema', judged.error);
  const block = renderManualTestPlan(judged.judgment);
  const current = yield* deps?.readBody === undefined ? readPrBody(env.owner, env.repo, pr) : deps.readBody(pr);
  const next = spliceManualTestPlan(current, block);
  if (next === current) return { edited: false } satisfies Outcome;
  yield* deps?.writeBody === undefined ? writePrBody(env.owner, env.repo, pr, next) : deps.writeBody(pr, next);
  yield* Effect.logInfo('manual test plan updated', { pr });
  return { edited: true } satisfies Outcome;
});

const stderrLogger = Logger.make(({ message }) => {
  process.stderr.write(`${typeof message === 'string' ? message : JSON.stringify(message)}\n`);
});

const isDirectRun = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  await manualTestPlanProgram().pipe(
    Effect.tapError(error => Effect.logError('manual test plan failed', { error })),
    Effect.exit,
    Effect.tap(exit =>
      Effect.sync(() => {
        if (Exit.isFailure(exit)) process.exitCode = 1;
      })
    ),
    Effect.provide(Layer.mergeAll(GitHubLayer, NodeServices.layer, Logger.layer([stderrLogger]))),
    Effect.runPromise
  );
}
