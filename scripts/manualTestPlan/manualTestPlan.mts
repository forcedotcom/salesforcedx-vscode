/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Command from '@effect/platform/Command';
import * as FileSystem from '@effect/platform/FileSystem';
import * as Path from '@effect/platform/Path';
import * as NodeContext from '@effect/platform-node/NodeContext';
import { actionsEnvironment, GitHub, readPullRequestEvent, type PullRequestState } from '@salesforce/effect-octokit';
import { Effect, Either, Exit, Layer, Logger, Match, Option, pipe, Schema, Stream } from 'effect';
import * as Str from 'effect/String';
import { pathToFileURL } from 'node:url';
import { openCodePrompt } from './openCodePrompt.mts';
import { CommandFailed, InvalidBaseRef, Judgment, type Item } from './schema.mts';
import { removeVideoSection, renderVideoManifest } from './videoManifest.mts';

const skillPath = '.cursor/skills/manual-test-plan-judgment/SKILL.md';
const startMarker = '<!-- manual-test-plan -->';
const endMarker = '<!-- /manual-test-plan -->';
const excludedWorkflows = new Set(['e2e.yml', 'playwrightE2EFullSuite.yml', 'rerunPushE2E.yml']);
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
  Match.value(item).pipe(
    Match.tag(
      'WatchVideo',
      video => `- [ ] Watch video: \`${video.spec}\` in \`${video.workflow}\` (\`${video.job}\`)`
    ),
    Match.tag('ManualItem', manual => `- [ ] ${manual.step}`),
    Match.exhaustive
  );

export const renderManualTestPlan = (judgment: typeof Judgment.Type, sha: string) => {
  const [body, targets] = Match.value(judgment).pipe(
    Match.tag('Nothing', () => ['Nothing worth manually testing.', []] as const),
    Match.tag(
      'Checklist',
      ({ items }) =>
        [
          items.map(itemLine).join('\n'),
          items.flatMap(item =>
            Match.value(item).pipe(
              Match.tag('WatchVideo', ({ spec, workflow, job }) => [{ spec, workflow, job }]),
              Match.tag('ManualItem', () => []),
              Match.exhaustive
            )
          )
        ] as const
    ),
    Match.exhaustive
  );
  return `${startMarker}\n## Manual test plan\n\n${body}\n${renderVideoManifest({ sha, targets })}\n${endMarker}`;
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
  const [text, code] = yield* pipe(
    Command.make('git', ...args),
    Command.workingDirectory(cwd),
    Command.env(gitLocalEnv),
    Command.start,
    Effect.flatMap(proc =>
      Effect.all(
        [
          Stream.mkString(Stream.decodeText(proc.stdout)),
          Stream.runDrain(Stream.decodeText(proc.stderr)),
          proc.exitCode
        ],
        { concurrency: 'unbounded' }
      )
    ),
    Effect.map(([stdout, , exitCode]) => [stdout, exitCode] as const),
    Effect.scoped
  );
  return code === 0
    ? text
    : yield* new CommandFailed({ command: 'git', code: Number(code), message: `git exited ${String(code)}` });
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
  item: Item & { readonly _tag: 'WatchVideo' }
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
  return yield* Match.value(judgment).pipe(
    Match.tag('Nothing', () => Effect.void),
    Match.tag('Checklist', ({ items }) => checklistError(cwd, items)),
    Match.exhaustive
  );
});

const checklistError = Effect.fn('manualTestPlan.checklistError')(function* (
  cwd: string,
  items: Extract<typeof Judgment.Type, { readonly _tag: 'Checklist' }>['items']
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workflows = yield* workflowCatalog(cwd);
  const problems = yield* Effect.forEach(items, item =>
    Match.value(item).pipe(
      Match.tag('ManualItem', () => Effect.succeed(Option.none<string>())),
      Match.tag('WatchVideo', video =>
        fs
          .exists(path.join(cwd, video.spec))
          .pipe(Effect.map(exists => Option.fromNullable(watchVideoProblem(exists, workflows, video))))
      ),
      Match.exhaustive
    )
  );
  const messages = problems.flatMap(problem => (Option.isNone(problem) ? [] : [problem.value]));
  return messages.length === 0 ? undefined : messages.join('\n');
});

const readPrBody = Effect.fn('manualTestPlan.readPrBody')(function* (owner: string, repo: string, pr: number) {
  return yield* GitHub.pullBody(owner, repo, pr);
});

const writePrBody = Effect.fn('manualTestPlan.writePrBody')(function* (
  owner: string,
  repo: string,
  pr: number,
  body: string
) {
  yield* GitHub.updatePullBody(owner, repo, pr, body);
});

const skip = (reason: string, message: string) =>
  Effect.logWarning('manual test plan skipped', { reason, message }).pipe(
    Effect.as({ edited: false } satisfies Outcome)
  );

const attempt = Effect.fn('manualTestPlan.attempt')(function* (
  prompt: (input: PromptInput) => ReturnType<typeof openCodePrompt>,
  skill: string,
  diff: string,
  cwd: string,
  correction: string | undefined
) {
  const text = yield* prompt({ skill, diff, ...(correction === undefined ? {} : { correction }) }).pipe(Effect.either);
  if (Either.isLeft(text)) return { _tag: 'opencode', message: text.left.message } satisfies Attempt;
  const decoded = yield* Schema.decodeUnknown(Schema.parseJson(Judgment))(text.right).pipe(Effect.either);
  if (Either.isLeft(decoded))
    return {
      _tag: 'retry',
      text: text.right,
      error: `judgment JSON failed schema: ${decoded.left.message}`
    } satisfies Attempt;
  const problem = yield* judgmentError(cwd, decoded.right);
  return problem === undefined
    ? ({ _tag: 'ok', judgment: decoded.right } satisfies Attempt)
    : ({ _tag: 'retry', text: text.right, error: problem } satisfies Attempt);
});

export type ManualTestPlanDeps = {
  readonly cwd?: string;
  readonly prompt?: (input: PromptInput) => ReturnType<typeof openCodePrompt>;
  readonly readBody?: (pr: number) => Effect.Effect<string>;
  readonly writeBody?: (pr: number, body: string) => Effect.Effect<void>;
  readonly readHead?: (
    pr: number
  ) => Effect.Effect<{ readonly state: PullRequestState; readonly headRefOid: string } | undefined>;
};

export const manualTestPlanProgram = Effect.fn('manualTestPlan.program')(function* (deps?: ManualTestPlanDeps) {
  const env = yield* actionsEnvironment;
  const base = yield* Option.match(env.baseRef, {
    onNone: () => Effect.fail(new InvalidBaseRef({ ref: 'GITHUB_BASE_REF', message: 'GITHUB_BASE_REF is missing' })),
    onSome: ref =>
      baseRefOk(ref)
        ? Effect.succeed(ref)
        : Effect.fail(new InvalidBaseRef({ ref, message: `refused base ref ${ref}` }))
  });
  const pr = yield* readPullRequestEvent(env.eventPath).pipe(Effect.map(event => event.pull_request.number));
  const cwd = deps?.cwd ?? (yield* git(process.cwd(), ['rev-parse', '--show-toplevel']).pipe(Effect.map(Str.trim)));
  const sha = yield* git(cwd, ['rev-parse', 'HEAD']).pipe(Effect.map(Str.trim));
  yield* Effect.annotateCurrentSpan('pr', String(pr));
  yield* git(cwd, ['fetch', 'origin', base]);
  const skill = yield* git(cwd, ['show', `origin/${base}:${skillPath}`]).pipe(Effect.option);
  if (Option.isNone(skill)) return yield* skip('missing-skill', `origin/${base}:${skillPath} is missing`);
  const diff = yield* git(cwd, ['diff', `origin/${base}...HEAD`]);
  const prompt = deps?.prompt ?? ((input: PromptInput) => openCodePrompt(cwd, input));
  const judged = yield* attempt(prompt, skill.value, diff, cwd, undefined).pipe(
    Effect.flatMap(first =>
      Match.value(first).pipe(
        Match.tag('opencode', () => Effect.succeed(first)),
        Match.tag('retry', retry =>
          attempt(prompt, skill.value, diff, cwd, `${retry.error}\n\nPrevious reply:\n${retry.text}`)
        ),
        Match.tag('ok', () => Effect.succeed(first)),
        Match.exhaustive
      )
    )
  );
  return yield* Match.value(judged).pipe(
    Match.tag('opencode', ({ message }) => skip('opencode', message)),
    Match.tag('retry', ({ error }) => skip('schema', error)),
    Match.tag('ok', ({ judgment }) =>
      writeManualTestPlan({
        cwd,
        owner: env.owner,
        repo: env.repo,
        pr,
        sha,
        judgment,
        deps
      })
    ),
    Match.exhaustive
  );
});

const writeManualTestPlan = Effect.fn('manualTestPlan.writeManualTestPlan')(function* (input: {
  readonly cwd: string;
  readonly owner: string;
  readonly repo: string;
  readonly pr: number;
  readonly sha: string;
  readonly judgment: typeof Judgment.Type;
  readonly deps: ManualTestPlanDeps | undefined;
}) {
  const block = renderManualTestPlan(input.judgment, input.sha);
  const current =
    input.deps?.readBody === undefined
      ? yield* readPrBody(input.owner, input.repo, input.pr)
      : yield* input.deps.readBody(input.pr);
  const latest =
    input.deps?.readHead === undefined
      ? yield* GitHub.pullRequest(input.owner, input.repo, input.pr)
      : yield* input.deps.readHead(input.pr);
  if (latest?.state !== 'OPEN' || latest.headRefOid !== input.sha)
    return yield* skip('stale-head', 'PR closed or head moved during manual plan generation');
  const next = spliceManualTestPlan(current, block);
  if (next === current) return { edited: false } satisfies Outcome;
  yield* input.deps?.writeBody === undefined
    ? writePrBody(input.owner, input.repo, input.pr, removeVideoSection(next))
    : input.deps.writeBody(input.pr, removeVideoSection(next));
  yield* Effect.logInfo('manual test plan updated', { pr: input.pr });
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
    Effect.provide(
      Layer.mergeAll(GitHub.Default, NodeContext.layer, Logger.replace(Logger.defaultLogger, stderrLogger))
    ),
    Effect.runPromise
  );
}
