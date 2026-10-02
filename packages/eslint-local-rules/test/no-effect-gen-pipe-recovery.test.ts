/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { noEffectGenPipeRecovery } from '../src/noEffectGenPipeRecovery';

const ruleTester = new RuleTester();
const gen = 'Effect.gen(function* () { yield* Effect.void; })';
const error = { messageId: 'noEffectGenPipeRecovery' as const };

ruleTester.run('no-effect-gen-pipe-recovery', noEffectGenPipeRecovery, {
  valid: [
    `${gen}.pipe(Effect.withSpan('span'))`,
    `${gen}.pipe(Effect.map(() => 1))`,
    `Effect.fn('run')(function* () { yield* Effect.void.pipe(Effect.catchTags({})); })`,
    `Effect.gen(function* () { yield* other().pipe(Effect.catchAll(() => Effect.void)); })`,
    `other().pipe(Effect.catchTag('Error', () => Effect.void))`,
    `Effect.gen(function* () { yield* Effect.void; })`,
    `Effect.gen(function* () { yield* other().pipe(Effect.catchAllCause(recover)); }).pipe(Effect.withSpan('outer'))`,
    `Effect.gen(function* () { yield* Effect.void; }).pipe(Effect.map(() => other().pipe(Effect.catchAll(recover))))`,
    `Effect.gen(function* () { yield* other().pipe(Effect.catchTag('Error', recover)); }).pipe(Effect.withSpan('outer'))`,
    `Effect.gen(function* () { yield* Effect.void; }).pipe(Effect.map(() => Effect.catchAll(recover)))`,
    `Effect.gen(function* () { yield* Effect.void; }).pipe(other.catchAll(recover))`,
    `Other.gen(function* () { yield* Effect.void; }).pipe(Effect.catchAll(recover))`,
    `Effect.gen(function* () { yield* Effect.void; })['pipe'](Effect.catchAll(recover))`
  ],
  invalid: [
    ...['orElseSucceed', 'catchAll', 'catchAllCause', 'catchTag', 'catchTags'].map(method => ({
      code: `${gen}.pipe(Effect.${method}(recover))`,
      errors: [error]
    })),
    {
      code: `const effect = ${gen}.pipe(Effect.map(() => 1), Effect.catchTags({}));`,
      errors: [error]
    },
    {
      code: `Effect.fn('run')(function* () { yield* ${gen}.pipe(Effect.catchAll(recover)); })`,
      errors: [error]
    },
    {
      code: `Effect.gen(function* () { yield* ${gen}.pipe(Effect.catchAllCause(recover)); })`,
      errors: [error]
    },
    {
      code: `Effect.gen(this, function* () { yield* Effect.void; }).pipe(Effect.provide(layer), Effect.catchTags({}))`,
      errors: [error]
    }
  ]
});
