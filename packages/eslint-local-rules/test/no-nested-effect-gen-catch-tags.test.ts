/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'node:path';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { noNestedEffectGenCatchTags } from '../src/noNestedEffectGenCatchTags';

const fixtureDir = join(__dirname, 'fixtures/no-nested-effect-gen-catch-tags');
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
`;

ruleTester.run('no-nested-effect-gen-catch-tags', noNestedEffectGenCatchTags, {
  valid: [
    {
      filename,
      code: `${effectImport}
const service = Effect.gen(function* () {
  yield* Effect.gen(function* () {
    yield* Effect.void;
  }).pipe(Effect.catchTags({}));
});`
    },
    {
      filename,
      code: `${effectImport}
const run = Effect.fn('Example.run')(function* () {
  yield* Effect.gen(function* () {
    yield* Effect.void;
  }).pipe(Effect.withSpan('Example.inner'));
});`
    },
    {
      filename,
      code: `${effectImport}
const run = Effect.fn('Example.run')(function* () {
  yield* Effect.void.pipe(Effect.catchTags({}));
});`
    },
    {
      filename,
      code: `${effectImport}
const run = Effect.fn('Example.run')(function* () {
  yield* Effect.gen(function* () {
    yield* Effect.gen(function* () {
      yield* Effect.void;
    }).pipe(Effect.catchTags({}));
  });
});`
    }
  ],
  invalid: [
    {
      filename,
      code: `${effectImport}
const run = Effect.fn('Example.run')(function* () {
  yield* Effect.gen(function* () {
    yield* Effect.void;
  }).pipe(Effect.catchTags({}));
});`,
      errors: [{ messageId: 'noNestedEffectGenCatchTags' }]
    },
    {
      filename,
      code: `${effectImport}
const run = Effect.fn('Example.run')(function* () {
  yield* Effect.gen(function* () {
    yield* Effect.void;
  }).pipe(
    Effect.map(() => 1),
    Effect.catchTags({})
  );
});`,
      errors: [{ messageId: 'noNestedEffectGenCatchTags' }]
    }
  ]
});
