/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'node:path';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { noNestedEffectTernary } from '../src/noNestedEffectTernary';

const fixtureDir = join(__dirname, 'fixtures/no-nested-effect-ternary');
const filename = join(fixtureDir, 'subject.ts');

const ruleTester = new RuleTester({
  languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: fixtureDir
      }
  }
});

const effectImport = `import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as Layer from 'effect/Layer';
const cond = true;
const other = false;
const third = false;
`;

ruleTester.run('no-nested-effect-ternary', noNestedEffectTernary, {
  valid: [
    {
      filename,
      code: `${effectImport}
const chosen = cond ? Effect.succeed(1) : Effect.void;`
    },
    {
      filename,
      code: `${effectImport}
const label = cond ? 'a' : other ? 'b' : 'c';`
    },
    {
      filename,
      code: `${effectImport}
const n = cond ? 1 : other ? 2 : 3;`
    },
    {
      filename,
      code: `${effectImport}
const layer = cond ? Layer.empty : other ? Layer.empty : Layer.empty;`
    },
    {
      filename,
      code: `${effectImport}
const mixed = cond ? 'a' : other ? Effect.succeed(1) : Effect.void;`
    },
    {
      filename,
      code: `${effectImport}
const chosen = Match.value(cond).pipe(
  Match.when(true, () => Effect.succeed(1)),
  Match.when(false, () => Effect.succeed(2)),
  Match.orElse(() => Effect.void)
);`
    }
  ],
  invalid: [
    {
      filename,
      code: `${effectImport}
const chosen = cond ? Effect.succeed(1) : other ? Effect.succeed(2) : Effect.void;`,
      errors: [{ messageId: 'useMatch' }]
    },
    {
      filename,
      code: `${effectImport}
const chosen = cond ? Effect.succeed(1) : other ? Effect.fail('no') : third ? Effect.succeed(3) : Effect.void;`,
      errors: [{ messageId: 'useMatch' }]
    },
    {
      filename,
      code: `${effectImport}
const chosen = cond ? Effect.succeed(1) : (other ? Effect.succeed(2) : Effect.void);`,
      errors: [{ messageId: 'useMatch' }]
    }
  ]
});
