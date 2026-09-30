/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Agent, type ToolName } from '@cursor/sdk';
import * as FileSystem from '@effect/platform/FileSystem';
import * as Path from '@effect/platform/Path';
import * as NodeContext from '@effect/platform-node/NodeContext';
import { Config, Effect, Either, Exit, Layer, Logger, Option, pipe, Redacted, Schema } from 'effect';
import { isNull, isUndefined } from 'effect/Predicate';
import { pathToFileURL } from 'node:url';
import { factsFor, git, runCommand } from './gatherFacts.mts';
import { CursorRunFailed, InvalidBaseRef, Judgment, PrBody, type Facts, type Item } from './schema.mts';

const skillPath = '.cursor/skills/manual-test-plan-judgment/SKILL.md';
const startMarker = '<!-- manual-test-plan -->';
const endMarker = '<!-- /manual-test-plan -->';

const tools: ToolName[] = [];

type Outcome = { readonly edited: boolean };

const messageOf = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

const baseRefOk = (ref: string) => /^[A-Za-z0-9._/-]+$/.test(ref) && !ref.split('/').includes('..');

const specPathsOf = (facts: Facts) => [
  ...facts.packages.flatMap(pkg => pkg.playwright.map(spec => spec.path)),
  ...facts.dependents.flatMap(dependent => dependent.specs)
];

const workflowsOf = (facts: Facts) => [
  ...facts.packages.flatMap(pkg => pkg.workflows),
  ...facts.dependents.flatMap(dependent =>
    dependent.workflow === undefined ? [] : [{ name: dependent.workflow, jobs: dependent.jobs }]
  )
];

const watchVideoBinds = (item: Item, facts: Facts) => {
  if (item.kind !== 'watch-video') return true;
  const workflow = workflowsOf(facts).find(candidate => candidate.name === item.workflow);
  return specPathsOf(facts).includes(item.spec) && workflow !== undefined && workflow.jobs.includes(item.job);
};

export const bindJudgment = (judgment: typeof Judgment.Type, facts: Facts) =>
  judgment.kind === 'nothing'
    ? judgment
    : pipe(
        judgment.items.filter(item => watchVideoBinds(item, facts)),
        items => (items.length === 0 ? undefined : { kind: 'checklist' as const, items })
      );

const itemLine = (item: Item) =>
  item.kind === 'watch-video'
    ? `- [ ] Watch video: \`${item.spec}\` in \`${item.workflow}\` (\`${item.job}\`)`
    : `- [ ] ${item.step}`;

export const renderManualTestPlan = (bound: NonNullable<ReturnType<typeof bindJudgment>>) => {
  const body = bound.kind === 'nothing' ? 'Nothing worth manually testing.' : bound.items.map(itemLine).join('\n');
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

const finishedText = (run: {
  readonly status: string;
  readonly result?: string;
  readonly error?: { readonly message: string };
}) =>
  run.status === 'finished'
    ? Option.match(Option.fromNullable(run.result), {
        onNone: () =>
          Effect.fail(new CursorRunFailed({ status: run.status, message: 'Cursor run finished without text' })),
        onSome: Effect.succeed
      })
    : Effect.fail(
        new CursorRunFailed({ status: run.status, message: run.error?.message ?? `Cursor run ${run.status}` })
      );

const cursorPrompt = Effect.fn('manualTestPlan.cursorPrompt')(function* (skill: string, factsJson: string) {
  return yield* Effect.all(
    [
      Config.redacted('CURSOR_API_KEY'),
      FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.makeTempDirectory({ prefix: 'manual-test-plan-' })))
    ],
    { concurrency: 'unbounded' }
  ).pipe(
    Effect.flatMap(([apiKey, workspace]) =>
      Effect.tryPromise({
        try: () =>
          Agent.prompt(`${skill}\n\nManual test plan facts:\n${factsJson}`, {
            apiKey: Redacted.value(apiKey),
            model: { id: 'auto' },
            tools,
            local: { cwd: workspace }
          }),
        catch: error =>
          new CursorRunFailed({ status: 'startup', message: messageOf(error, 'Cursor SDK failed to start') })
      }).pipe(Effect.flatMap(finishedText))
    )
  );
});

const ghArgs = (repo: Option.Option<string>, args: readonly string[]) =>
  Option.match(repo, { onNone: () => args, onSome: name => [...args, '--repo', name] as const });

const readPrBody = Effect.fn('manualTestPlan.readPrBody')(function* (cwd: string, pr: number) {
  const repo = yield* Config.option(Config.string('GITHUB_REPOSITORY'));
  return yield* runCommand(cwd, 'gh', ghArgs(repo, ['pr', 'view', String(pr), '--json', 'body'])).pipe(
    Effect.flatMap(json => Schema.decodeUnknown(Schema.parseJson(PrBody))(json)),
    Effect.map(parsed => (isNull(parsed.body) ? '' : parsed.body))
  );
});

const writePrBody = Effect.fn('manualTestPlan.writePrBody')(function* (cwd: string, pr: number, body: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repo = yield* Config.option(Config.string('GITHUB_REPOSITORY'));
  const dir = yield* fs.makeTempDirectory({ prefix: 'manual-test-plan-body-' });
  const file = path.join(dir, 'body.md');
  yield* fs.writeFileString(file, body);
  yield* runCommand(cwd, 'gh', ghArgs(repo, ['pr', 'edit', String(pr), '--body-file', file]));
});

const skip = (reason: string, message: string) =>
  Effect.logWarning('manual test plan skipped', { reason, message }).pipe(
    Effect.as({ edited: false } satisfies Outcome)
  );

export type ManualTestPlanDeps = {
  readonly cwd?: string;
  readonly prompt?: (skill: string, factsJson: string) => Effect.Effect<string, CursorRunFailed>;
  readonly readBody?: (pr: number) => Effect.Effect<string>;
  readonly writeBody?: (pr: number, body: string) => Effect.Effect<void>;
};

export const manualTestPlanProgram = Effect.fn('manualTestPlan.program')(function* (deps?: ManualTestPlanDeps) {
  const pr = yield* Config.string('PR_NUMBER').pipe(
    Effect.flatMap(value => Schema.decodeUnknown(Schema.NumberFromString)(value))
  );
  const base = yield* Config.string('BASE_REF');
  if (!baseRefOk(base)) {
    return yield* new InvalidBaseRef({ ref: base, message: `refused base ref ${base}` });
  }
  const cwd =
    deps?.cwd ?? (yield* git(process.cwd(), ['rev-parse', '--show-toplevel']).pipe(Effect.map(root => root.trim())));
  yield* Effect.annotateCurrentSpan('pr', String(pr));
  yield* git(cwd, ['fetch', 'origin', base]);
  const skill = yield* git(cwd, ['show', `origin/${base}:${skillPath}`]).pipe(Effect.option);
  if (Option.isNone(skill)) return yield* skip('missing-skill', `origin/${base}:${skillPath} is missing`);
  const changedFiles = yield* git(cwd, ['diff', '--name-only', `origin/${base}...HEAD`]).pipe(
    Effect.map(text =>
      text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
    )
  );
  const facts = yield* factsFor(cwd, base, changedFiles);
  const prompt = deps?.prompt ?? cursorPrompt;
  const prompted = yield* prompt(skill.value, JSON.stringify(facts)).pipe(Effect.either);
  if (Either.isLeft(prompted)) return yield* skip('cursor', prompted.left.message);
  const decoded = yield* Schema.decodeUnknown(Schema.parseJson(Judgment))(prompted.right).pipe(Effect.either);
  if (Either.isLeft(decoded)) return yield* skip('schema', 'judgment JSON failed schema');
  const bound = bindJudgment(decoded.right, facts);
  if (isUndefined(bound)) return yield* skip('schema', 'checklist did not bind to facts');
  const block = renderManualTestPlan(bound);
  const current = yield* deps?.readBody === undefined ? readPrBody(cwd, pr) : deps.readBody(pr);
  const next = spliceManualTestPlan(current, block);
  if (next === current) return { edited: false } satisfies Outcome;
  yield* deps?.writeBody === undefined ? writePrBody(cwd, pr, next) : deps.writeBody(pr, next);
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
    Effect.provide(Layer.mergeAll(NodeContext.layer, Logger.replace(Logger.defaultLogger, stderrLogger))),
    Effect.runPromise
  );
}
