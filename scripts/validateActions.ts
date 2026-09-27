/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type ValidationError, type ValidationState, validateAction, validateWorkflow } from '@action-validator/core';
import { Console, Effect, Stream } from 'effect';
import * as Equivalence from 'effect/Equivalence';
import { isError, isRecord } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { globSync, readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

// The bundled @action-validator/core schema predates schemastore's parallel-steps keys
// (background/wait/wait-all, schemastore PR #5845). Those keys are valid GitHub Actions YAML,
// so filter the stale-schema noise while keeping every genuine error. See W-23195710.
// TODO(W-23195710): remove this whole suppression block (regexes + collect/filter helpers) once
// @action-validator/core (package.json) bumps to a schema that includes background/wait/wait-all.
// The filter keys off undocumented internal error shape (code/detail/path/states) and will break
// silently on any validator error-tree reshape.
const NEW_STEP_KEYS = ['background', 'wait', 'wait-all'] as const;
const additionalPropertyRe = new RegExp(`Additional property '(${NEW_STEP_KEYS.join('|')})' is not allowed`);
const waitPropertyRe = /Additional property '(wait|wait-all)' is not allowed/;
const runOrUsesRequiredRe = /^(.*\/steps\/\d+)\/(run|uses)$/;

// "Additional property 'background|wait|wait-all'" leaf — always suppressible.
const isPropertyLeaf = (e: ValidationError): boolean =>
  e.code === 'properties' && 'detail' in e && typeof e.detail === 'string' && additionalPropertyRe.test(e.detail);

// step paths of wait-only steps (had a suppressed wait/wait-all property leaf); those steps
// also emit a nested run/uses `required` one_of the stale schema shouldn't have produced.
const collectWaitStepPaths = (errors: ValidationError[]): string[] =>
  errors.flatMap(error =>
    'states' in error && error.states?.length
      ? error.states.flatMap(state => collectWaitStepPaths(state.errors))
      : error.code === 'properties' &&
          'detail' in error &&
          typeof error.detail === 'string' &&
          waitPropertyRe.test(error.detail) &&
          'path' in error
        ? [error.path]
        : []
  );

const isRunOrUsesRequiredLeaf = (e: ValidationError, waitStepPaths: readonly string[]): boolean => {
  if (e.code !== 'required' || !('path' in e)) return false;
  const match = runOrUsesRequiredRe.exec(e.path);
  return match !== null && waitStepPaths.includes(match[1]);
};

// Filter a leaf tree: drop suppressible leaves; for a one_of, if any branch nets 0 leaves the
// condition is satisfiable so drop the whole one_of, else keep the surviving leaves.
const filterErrors = (errors: ValidationError[], waitStepPaths: readonly string[]): ValidationError[] =>
  errors.flatMap(error => {
    if ('states' in error && error.states?.length) {
      const filteredStates = error.states.map(state => filterErrors(state.errors, waitStepPaths));
      return filteredStates.some(leaves => leaves.length === 0)
        ? []
        : [{ ...error, states: error.states.map((state, i) => ({ ...state, errors: filteredStates[i] })) }];
    }

    return isPropertyLeaf(error) || isRunOrUsesRequiredLeaf(error, waitStepPaths) ? [] : [error];
  });

const filterState = (result: ValidationState): ValidationError[] =>
  filterErrors(result.errors, collectWaitStepPaths(result.errors));

const isStringList = Schema.is(Schema.Array(Schema.String));

const asStringList = (value: unknown): readonly string[] | undefined => (isStringList(value) ? value : undefined);

const sameStrings = Equivalence.array(Equivalence.string);

const DOC_ONLY_AUTO_MERGE = '.github/workflows/docOnlyAutoMerge.yml';

// `on.push` / `on.pull_request` paths-ignore must equal docOnlyAutoMerge.yml `on.pull_request.paths`.
const PATHS_IGNORE_WORKFLOWS = [
  '.github/workflows/validatePR.yml',
  '.github/workflows/testCommitExceptMain.yml',
  '.github/workflows/visualforceE2E.yml',
  '.github/workflows/soqlE2E.yml',
  '.github/workflows/servicesE2E.yml',
  '.github/workflows/playwrightVscodeExtE2E.yml',
  '.github/workflows/orgE2E.yml',
  '.github/workflows/orgBrowserE2E.yml',
  '.github/workflows/metadataE2E.yml',
  '.github/workflows/lwcPlaywrightE2E.yml',
  '.github/workflows/coreE2E.yml',
  '.github/workflows/auraE2E.yml',
  '.github/workflows/apexTestingE2E.yml',
  '.github/workflows/apexReplayDebuggerE2E.yml',
  '.github/workflows/apexOasE2E.yml',
  '.github/workflows/apexLspE2E.yml',
  '.github/workflows/apexLogE2E.yml',
  '.github/workflows/apexDebuggerE2E.yml'
] as const;

const TRIGGER_KEYS = ['push', 'pull_request'] as const;

const onMap = (workflow: unknown): Readonly<Record<string, unknown>> | undefined =>
  isRecord(workflow) && isRecord(workflow.on) ? workflow.on : undefined;

const docOnlyTriggerPaths = (workflow: unknown): readonly string[] | undefined => {
  const pullRequest = onMap(workflow)?.pull_request;
  return isRecord(pullRequest) ? asStringList(pullRequest.paths) : undefined;
};

const pathsIgnoreLists = (workflow: unknown): readonly (readonly string[] | undefined)[] => {
  const on = onMap(workflow);
  return on === undefined
    ? []
    : TRIGGER_KEYS.flatMap(key => {
        const trigger = on[key];
        return isRecord(trigger) && Object.hasOwn(trigger, 'paths-ignore')
          ? [asStringList(trigger['paths-ignore'])]
          : [];
      });
};

const readWorkflowYaml = (file: string) =>
  Effect.try({
    try: (): unknown => parseYaml(readFileSync(file, 'utf8')),
    catch: (cause: unknown) => `${file}: ${isError(cause) ? cause.message : String(cause)}`
  });

const pathsIgnoreDrift = (file: string, expected: readonly string[]) =>
  readWorkflowYaml(file).pipe(
    Effect.match({
      onFailure: message => [message],
      onSuccess: workflow => {
        const lists = pathsIgnoreLists(workflow);
        return lists.length === 0
          ? [`${file}: missing on.push / on.pull_request paths-ignore`]
          : lists.flatMap(list =>
              list === undefined
                ? [`${file}: paths-ignore is not a string list`]
                : sameStrings(list, expected)
                  ? []
                  : [
                      `${file}: paths-ignore ${JSON.stringify(list)} != ${DOC_ONLY_AUTO_MERGE} on.pull_request.paths ${JSON.stringify(expected)}`
                    ]
            );
      }
    })
  );

const docOnlyPathsIgnoreErrors = readWorkflowYaml(DOC_ONLY_AUTO_MERGE).pipe(
  Effect.flatMap(workflow => {
    const expected = docOnlyTriggerPaths(workflow);
    return expected === undefined
      ? Effect.succeed([`${DOC_ONLY_AUTO_MERGE}: on.pull_request.paths is not a string list`])
      : Effect.all(PATHS_IGNORE_WORKFLOWS.map(file => pathsIgnoreDrift(file, expected))).pipe(
          Effect.map(groups => groups.flat())
        );
  })
);

const collectLeafErrors = (errors: ValidationError[]): string[] =>
  errors.flatMap(error => {
    if ('states' in error && error.states?.length) {
      return error.states.flatMap(state => collectLeafErrors(state.errors));
    }

    const message = ('detail' in error && error.detail) ?? error.title;

    return ['path' in error ? `  ${error.path}: ${message}` : `  ${message}`];
  });

const program = Stream.concat(
  Stream.fromIterable(globSync('.github/workflows/*.{yml,yaml}')).pipe(
    Stream.map(file => ({ file, result: validateWorkflow(readFileSync(file, 'utf8')) }))
  ),
  Stream.fromIterable(globSync('.github/actions/*/action.{yml,yaml}')).pipe(
    Stream.map(file => ({ file, result: validateAction(readFileSync(file, 'utf8')) }))
  )
).pipe(
  // compute filtered leaves + counts once; downstream stages read straight fields (no re-walks).
  Stream.map(({ file, result }) => {
    const errors = filterState(result);
    const messages = collectLeafErrors(errors);
    return {
      file,
      errors,
      messages,
      suppressed: collectLeafErrors(result.errors).length - messages.length
    };
  }),
  Stream.tap(({ file, suppressed }) =>
    suppressed > 0
      ? Console.warn(
          `\n${file}: tolerated ${suppressed} GHA parallel-steps leaf(s) (${NEW_STEP_KEYS.join('/')}) missing from local validator schema`
        )
      : Effect.void
  ),
  Stream.filter(({ errors }) => errors.length > 0),
  Stream.tap(({ file, messages }) => Console.error(`\n${file}:\n${messages.join('\n')}`)),
  Stream.runCount,
  Effect.flatMap(schemaFailures =>
    docOnlyPathsIgnoreErrors.pipe(
      Effect.match({
        onFailure: message => ({ schemaFailures, drift: [message] }),
        onSuccess: drift => ({ schemaFailures, drift })
      })
    )
  ),
  Effect.tap(({ drift }) => (drift.length === 0 ? Effect.void : Console.error(`\n${drift.join('\n')}`))),
  Effect.map(({ schemaFailures, drift }) => schemaFailures + drift.length),
  Effect.tap(failureCount => Console.log(`${failureCount} failed.`))
);

void Effect.runPromise(program).then(failureCount => process.exit(failureCount > 0 ? 1 : 0));
