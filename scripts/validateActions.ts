/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type ValidationError, type ValidationState, validateAction, validateWorkflow } from '@action-validator/core';
import { Console, Effect, Stream } from 'effect';
import { globSync, readFileSync } from 'node:fs';

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
  Effect.tap(failureCount => Console.log(`${failureCount} failed.`))
);

void Effect.runPromise(program).then(failureCount => process.exit(failureCount > 0 ? 1 : 0));
