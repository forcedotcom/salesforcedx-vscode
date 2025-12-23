/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { noExplicitEffectReturnType } from '../src/noExplicitEffectReturnType';

const ruleTester = new RuleTester();

ruleTester.run('no-explicit-effect-return-type', noExplicitEffectReturnType, {
  valid: [
    {
      code: `import * as Effect from 'effect/Effect';
const fn = () => Effect.succeed(1);`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts'
    },
    {
      code: `import * as Effect from 'effect/Effect';
function fn() {
  return Effect.succeed(1);
}`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts'
    },
    {
      code: `const fn = (): string => 'hello';`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts'
    },
    {
      code: `function fn(): number {
  return 42;
}`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts'
    },
    {
      code: `import * as Effect from 'effect/Effect';
class Test {
  method() {
    return Effect.succeed(1);
  }
}`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts'
    },
    {
      code: `import * as Effect from 'effect/Effect';
const fn: () => Effect.Effect<number> = () => Effect.succeed(1);`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts'
    }
  ],
  invalid: [
    {
      code: `import * as Effect from 'effect/Effect';
const fn = (): Effect.Effect<number> => Effect.succeed(1);`,
      output: `import * as Effect from 'effect/Effect';
const fn = () => Effect.succeed(1);`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts',
      errors: [
        {
          messageId: 'noExplicitEffectReturnType'
        }
      ]
    },
    {
      code: `import * as Effect from 'effect/Effect';
function fn(): Effect.Effect<number> {
  return Effect.succeed(1);
}`,
      output: `import * as Effect from 'effect/Effect';
function fn() {
  return Effect.succeed(1);
}`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts',
      errors: [
        {
          messageId: 'noExplicitEffectReturnType'
        }
      ]
    },
    {
      code: `import * as Effect from 'effect/Effect';
class Test {
  method(): Effect.Effect<void> {
    return Effect.succeed(undefined);
  }
}`,
      output: `import * as Effect from 'effect/Effect';
class Test {
  method() {
    return Effect.succeed(undefined);
  }
}`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts',
      errors: [
        {
          messageId: 'noExplicitEffectReturnType'
        }
      ]
    },
    {
      code: `import * as Effect from 'effect/Effect';
const fn = function(): Effect.Effect<string> {
  return Effect.succeed('hello');
};`,
      output: `import * as Effect from 'effect/Effect';
const fn = function() {
  return Effect.succeed('hello');
};`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts',
      errors: [
        {
          messageId: 'noExplicitEffectReturnType'
        }
      ]
    },
    {
      code: `import * as Effect from 'effect/Effect';
const fn = (): Effect.Effect<readonly string[], Error> => Effect.succeed(['a']);`,
      output: `import * as Effect from 'effect/Effect';
const fn = () => Effect.succeed(['a']);`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts',
      errors: [
        {
          messageId: 'noExplicitEffectReturnType'
        }
      ]
    }
  ]
});
