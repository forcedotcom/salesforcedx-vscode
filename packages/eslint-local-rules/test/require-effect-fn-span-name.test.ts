/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { requireEffectFnSpanName } from '../src/requireEffectFnSpanName';

const ruleTester = new RuleTester();

ruleTester.run('require-effect-fn-span-name', requireEffectFnSpanName, {
  valid: [
    {
      code: `import * as Effect from 'effect/Effect';
const findById = Effect.fn('UserService.findById')(function* (id: string) {
  return id;
});`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts'
    },
    {
      code: `import * as Effect from 'effect/Effect';
const runPollCycle = Effect.fn('ApexLog.pollCycle')(function* (knownIds: Set<string>, ref: unknown) {
  yield* Effect.succeed(undefined);
});`,
      filename: 'packages/salesforcedx-vscode-apex-log/src/test.ts'
    },
    {
      code: `import * as Effect from 'effect/Effect';
const fn = Effect.fn('noParams')(function* () { yield* Effect.void; });`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts'
    },
    {
      code: `import * as Effect from 'effect/Effect';
const createOrgPicker = Effect.fn('OrgPicker.createOrgPicker')(function* () {
  yield* Effect.succeed(undefined);
});`,
      filename: 'packages/salesforcedx-vscode-org/src/orgPicker/orgList.ts'
    }
  ],
  invalid: [
    {
      code: `import * as Effect from 'effect/Effect';
const fn = Effect.fn(function* () { yield* Effect.void; });`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts',
      errors: [{ messageId: 'requireSpanName' }]
    },
    {
      code: `import * as Effect from 'effect/Effect';
const hasActiveTraceFlagEffect = Effect.fn(function* () {
  yield* Effect.succeed(false);
});`,
      filename: 'packages/salesforcedx-vscode-apex-log/src/traceFlags/traceFlagsCodeLensProvider.ts',
      errors: [{ messageId: 'requireSpanName' }]
    },
    {
      code: `import * as Effect from 'effect/Effect';
const createOrgPicker = Effect.fn(function* () {
  yield* Effect.succeed(undefined);
});`,
      filename: 'packages/salesforcedx-vscode-org/src/orgPicker/orgList.ts',
      errors: [{ messageId: 'requireSpanName' }]
    }
  ]
});
