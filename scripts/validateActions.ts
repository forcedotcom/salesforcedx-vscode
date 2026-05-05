/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type ValidationError, type ValidationState, validateAction, validateWorkflow } from '@action-validator/core';
import { Console, Effect, Stream } from 'effect';
import { globSync, readFileSync } from 'node:fs';

const program = Stream.concat(
  Stream.fromIterable(globSync('.github/workflows/*.{yml,yaml}')).pipe(
    Stream.map(file => ({ file, result: validateWorkflow(readFileSync(file, 'utf8')) }))
  ),
  Stream.fromIterable(globSync('.github/actions/*/action.{yml,yaml}')).pipe(
    Stream.map(file => ({ file, result: validateAction(readFileSync(file, 'utf8')) }))
  )
).pipe(
  Stream.filter(({ result }) => result.errors.length > 0),
  Stream.tap(({ file, result }) => Console.error(`\n${file}:\n${formatErrors(result)}`)),
  Stream.runCount,
  Effect.tap(failureCount => Console.log(`${failureCount} failed.`))
);

void Effect.runPromise(program).then(failureCount => process.exit(failureCount > 0 ? 1 : 0));

const collectLeafErrors = (errors: ValidationError[]): string[] =>
  errors.flatMap(error => {
    if ('states' in error && error.states?.length) {
      return error.states.flatMap(state => collectLeafErrors(state.errors));
    }

    const message = ('detail' in error && error.detail) ?? error.title;

    return ['path' in error ? `  ${error.path}: ${message}` : `  ${message}`];
  });

const formatErrors = (result: ValidationState): string => collectLeafErrors(result.errors).join('\n');
