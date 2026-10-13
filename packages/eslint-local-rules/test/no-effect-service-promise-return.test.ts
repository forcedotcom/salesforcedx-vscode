/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'node:path';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { noEffectServicePromiseReturn } from '../src/noEffectServicePromiseReturn';

const fixtureDir = join(__dirname, 'fixtures/no-effect-service-promise-return');
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

ruleTester.run('no-effect-service-promise-return', noEffectServicePromiseReturn, {
  valid: [
    {
      filename,
      code: `${effectImport}
class UserService extends Effect.Service<UserService>()('UserService', {
  effect: Effect.gen(function* () {
    const findById = Effect.fn('UserService.findById')(function* (id: string) {
      return id;
    });
    return { findById };
  })
}) {}`
    },
    {
      filename,
      code: `${effectImport}
class UserService extends Effect.Service<UserService>()('UserService', {
  effect: Effect.sync(() => ({
    read: () => Effect.succeed(1)
  }))
}) {}`
    },
    {
      filename,
      code: `${effectImport}
class UserService extends Effect.Service<UserService>()('UserService', {
  effect: Effect.succeed({
    read: Effect.fn('UserService.read')(function* () {
      return 1;
    })
  })
}) {}`
    },
    {
      filename,
      code: `${effectImport}
class UserService extends Effect.Service<UserService>()('UserService', {
  effect: Effect.gen(function* () {
    const helper = async (): Promise<number> => 1;
    const read = Effect.fn('UserService.read')(function* () {
      return yield* Effect.promise(() => helper());
    });
    return { read };
  })
}) {}`
    },
    {
      filename,
      code: `${effectImport}
const findById = async (id: string): Promise<string> => id;
class Box {
  load = (): Promise<string> => Promise.resolve('x');
}`
    }
  ],
  invalid: [
    {
      filename,
      code: `${effectImport}
class UserService extends Effect.Service<UserService>()('UserService', {
  effect: Effect.gen(function* () {
    const findById = async (id: string): Promise<string> => id;
    return { findById };
  })
}) {}`,
      errors: [{ messageId: 'promiseReturn', data: { methodName: 'findById' } }]
    },
    {
      filename,
      code: `${effectImport}
class UserService extends Effect.Service<UserService>()('UserService', {
  effect: Effect.gen(function* () {
    const findById = (id: string) => Promise.resolve(id);
    return { findById };
  })
}) {}`,
      errors: [{ messageId: 'promiseReturn', data: { methodName: 'findById' } }]
    },
    {
      filename,
      code: `${effectImport}
class UserService extends Effect.Service<UserService>()('UserService', {
  effect: Effect.sync(() => ({
    findById: async (id: string) => id,
    save: (name: string): Promise<string> => Promise.resolve(name)
  }))
}) {}`,
      errors: [
        { messageId: 'promiseReturn', data: { methodName: 'findById' } },
        { messageId: 'promiseReturn', data: { methodName: 'save' } }
      ]
    },
    {
      filename,
      code: `${effectImport}
class UserService extends Effect.Service<UserService>()('UserService', {
  scoped: (name: string) =>
    Effect.gen(function* () {
      const read = async () => name;
      return { read };
    })
}) {}`,
      errors: [{ messageId: 'promiseReturn', data: { methodName: 'read' } }]
    }
  ]
});
