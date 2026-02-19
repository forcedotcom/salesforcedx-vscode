/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { noEffectFnWrapper } from '../src/noEffectFnWrapper';

const ruleTester = new RuleTester();

ruleTester.run('no-effect-fn-wrapper', noEffectFnWrapper, {
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
    }
  ],
  invalid: [
    {
      code: `import * as Effect from 'effect/Effect';
const fn = () => Effect.fn('name')(function* () { yield* Effect.void; });`,
      output: `import * as Effect from 'effect/Effect';
const fn = Effect.fn('name')(function* () { yield* Effect.void; });`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts',
      errors: [{ messageId: 'noEffectFnWrapper' }]
    },
    {
      code: `import * as Effect from 'effect/Effect';
const findById = (id: string) =>
  Effect.fn('UserService.findById')(function* () {
    return id;
  });`,
      output: `import * as Effect from 'effect/Effect';
const findById = Effect.fn('UserService.findById')(function* (id: string) {
    return id;
  });`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts',
      errors: [{ messageId: 'noEffectFnWrapper' }]
    },
    {
      code: `import * as Effect from 'effect/Effect';
const getText = (sel: boolean) =>
  Effect.fn('EditorService.getText')(function* () {
    return sel;
  })();`,
      output: `import * as Effect from 'effect/Effect';
const getText = Effect.fn('EditorService.getText')(function* (sel: boolean) {
    return sel;
  })();`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts',
      errors: [{ messageId: 'noEffectFnWrapper' }]
    }
  ]
});
