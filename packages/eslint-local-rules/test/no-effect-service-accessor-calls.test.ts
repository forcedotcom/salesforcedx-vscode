/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { noEffectServiceAccessorCalls } from '../src/noEffectServiceAccessorCalls';

const ruleTester = new RuleTester();

ruleTester.run('no-effect-service-accessor-calls', noEffectServiceAccessorCalls, {
  valid: [
    {
      code: `import * as Effect from 'effect/Effect';
class MetadataDeleteService extends Effect.Service<MetadataDeleteService>()('MetadataDeleteService', {
  accessors: true,
  dependencies: [FsService.Default, MetadataRegistryService.Default],
  effect: Effect.gen(function* () {
    const registryService = yield* MetadataRegistryService;
    const fsService = yield* FsService;
    const markComponentsForDeletion = Effect.fn('mark')(function* (componentSet) {
      const x = yield* registryService.getRegistryAccess();
      return { x };
    });
    return { markComponentsForDeletion };
  })
}) {}`,
      filename: 'packages/salesforcedx-vscode-services/src/core/test.ts'
    },
    {
      code: `import * as Effect from 'effect/Effect';
class Foo extends Effect.Service<Foo>()('Foo', {
  dependencies: [],
  effect: Effect.gen(function* () { return {}; })
}) {}`,
      filename: 'packages/salesforcedx-vscode-services/src/core/test.ts'
    },
    {
      code: `import * as Effect from 'effect/Effect';
const x = MetadataRegistryService.getRegistryAccess();`,
      filename: 'packages/salesforcedx-vscode-services/src/core/test.ts'
    }
  ],
  invalid: [
    {
      code: `import * as Effect from 'effect/Effect';
class MetadataRetrieveService extends Effect.Service<MetadataRetrieveService>()('MetadataRetrieveService', {
  accessors: true,
  dependencies: [MetadataRegistryService.Default],
  effect: Effect.gen(function* () {
    const registryAccess = yield* MetadataRegistryService.getRegistryAccess();
    return { registryAccess };
  })
}) {}`,
      filename: 'packages/salesforcedx-vscode-services/src/core/test.ts',
      errors: [
        {
          messageId: 'useYieldedService',
          data: { serviceName: 'MetadataRegistryService', methodName: 'getRegistryAccess' }
        }
      ]
    },
    {
      code: `import * as Effect from 'effect/Effect';
class TestService extends Effect.Service<TestService>()('TestService', {
  dependencies: [FsService.Default],
  effect: Effect.gen(function* () {
    const data = yield* FsService.readFile('path');
    return { data };
  })
}) {}`,
      filename: 'packages/salesforcedx-vscode-services/src/core/test.ts',
      errors: [
        {
          messageId: 'useYieldedService',
          data: { serviceName: 'FsService', methodName: 'readFile' }
        }
      ]
    },
    {
      code: `import * as Effect from 'effect/Effect';
class TestService extends Effect.Service<TestService>()('TestService', {
  dependencies: [MetadataRegistryService.Default],
  effect: Effect.gen(function* () {
    const s = yield* MetadataRegistryService;
    const x = yield* s.getRegistryAccess();
    return { x };
  })
}) {}`,
      filename: 'packages/salesforcedx-vscode-services/src/core/test.ts',
      errors: [
        {
          messageId: 'accessorMustBeInEffectFn',
          data: { varName: 's', methodName: 'getRegistryAccess' }
        }
      ]
    }
  ]
});
