/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'node:path';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { noStandalonePipeableValue } from '../src/noStandalonePipeableValue';

const fixtureDir = join(__dirname, 'fixtures/no-standalone-pipeable-value');
const filename = join(fixtureDir, 'subject.ts');

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: fixtureDir
    }
  }
});

const imports = `import { pipe } from 'effect/Function';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as Schema from 'effect/Schema';
`;

ruleTester.run('no-standalone-pipeable-value', noStandalonePipeableValue, {
  valid: [
    { filename, code: `${imports}pipe([1, 2], xs => xs.length);` },
    { filename, code: `${imports}pipe('hello', s => s.length);` },
    { filename, code: `${imports}pipe(JSON.parse('{}'), Schema.decodeUnknown(Schema.Unknown));` },
    { filename, code: `${imports}Effect.succeed(1).pipe(Effect.map(n => n + 1));` },
    { filename, code: `${imports}Stream.fromIterable([1]).pipe(Stream.map(n => n + 1));` },
    { filename, code: `${imports}Schema.String.pipe(Schema.minLength(1));` },
    {
      filename,
      code: `${imports}const choice = Math.random() > 0.5 ? Effect.void : 1;
pipe(choice, x => x);`
    },
    {
      filename,
      code: `${imports}const pipeable = { pipe: (f: (n: number) => number) => f(1) };
pipe(pipeable, x => x.pipe(n => n + 1));`
    },
    {
      filename,
      code: `import * as Function from 'effect/Function';
import * as Effect from 'effect/Effect';
Function.pipe(Effect.void, Effect.as(1));`
    },
    {
      filename,
      code: `const pipe = (value: { pipe: (f: (n: number) => number) => number }, f: (n: number) => number) => value.pipe(f);
pipe({ pipe: f => f(1) }, n => n + 1);`
    }
  ],
  invalid: [
    {
      filename,
      code: `${imports}pipe(Effect.succeed(1), Effect.map(n => n + 1));`,
      errors: [{ messageId: 'useMethodPipe' }]
    },
    {
      filename,
      code: `${imports}const effect: Effect.Effect<number> = Effect.succeed(1);
pipe(effect, Effect.map(n => n + 1));`,
      errors: [{ messageId: 'useMethodPipe' }]
    },
    {
      filename,
      code: `${imports}pipe(Stream.fromIterable([1]), Stream.map(n => n + 1));`,
      errors: [{ messageId: 'useMethodPipe' }]
    },
    {
      filename,
      code: `${imports}pipe(Schema.String, Schema.minLength(1));`,
      errors: [{ messageId: 'useMethodPipe' }]
    },
    {
      filename,
      code: `${imports}const schema: Schema.Schema<string> = Schema.String;
pipe(schema, Schema.minLength(1));`,
      errors: [{ messageId: 'useMethodPipe' }]
    },
    {
      filename,
      code: `${imports}const choice = Math.random() > 0.5 ? Effect.succeed(1) : Effect.fail('no');
pipe(choice, Effect.as(1));`,
      errors: [{ messageId: 'useMethodPipe' }]
    },
    {
      filename,
      code: `import { pipe as compose } from 'effect/Function';
import * as Effect from 'effect/Effect';
compose(Effect.void, Effect.as(1));`,
      errors: [{ messageId: 'useMethodPipe' }]
    }
  ]
});
