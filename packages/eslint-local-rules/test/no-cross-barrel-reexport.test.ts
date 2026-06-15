/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import * as path from 'node:path';
import { noCrossBarrelReexport } from '../src/noCrossBarrelReexport';

const ruleTester = new RuleTester();

const options: [{ knownWorkspacePackages: string[] }] = [
  {
    knownWorkspacePackages: ['salesforcedx-vscode-services', '@salesforce/vscode-services', '@salesforce/soql-common']
  }
];

// A real source file under repo `packages/` so the fs self-discovery path resolves this repo's workspace names.
const repoFileUnderPackages = path.join(__dirname, '..', 'src', 'someFile.ts');

ruleTester.run('no-cross-barrel-reexport', noCrossBarrelReexport, {
  valid: [
    // 3rd-party npm re-exports are deliberate API surface (NOT in the workspace option array)
    { code: `export { foo } from 'jsforce';`, options },
    { code: `export type { Foo } from '@salesforce/core';`, options },
    { code: `export { bar } from '@salesforce/templates';`, options },
    { code: `export * from 'vscode-languageserver-protocol';`, options },
    // any re-export allowed in index.ts barrels (any depth)
    {
      code: `export { foo } from './foo';`,
      filename: '/repo/packages/pkg/src/index.ts',
      options
    },
    {
      code: `export * from 'salesforcedx-vscode-services';`,
      filename: '/repo/packages/pkg/src/sub/index.ts',
      options
    },
    // plain imports are out of scope
    { code: `import { foo } from './foo';`, options },
    { code: `import { foo } from 'salesforcedx-vscode-services';`, options },
    // local exports (no source) are fine
    { code: `export const foo = 1;`, options },
    { code: `const x = 1; export { x };`, options },
    // fs-default case (NO option): 'jsforce' is 3rd-party, not a discovered workspace package
    { code: `export { foo } from 'jsforce';`, filename: repoFileUnderPackages }
  ],
  invalid: [
    {
      code: `export { foo } from './foo';`,
      filename: '/repo/packages/pkg/src/notIndex.ts',
      options,
      errors: [{ messageId: 'noCrossBarrelReexport', data: { source: './foo' } }]
    },
    {
      code: `export * from '../sibling';`,
      filename: '/repo/packages/pkg/src/notIndex.ts',
      options,
      errors: [{ messageId: 'noCrossBarrelReexport', data: { source: '../sibling' } }]
    },
    {
      code: `export type { Foo } from '../sibling';`,
      filename: '/repo/packages/pkg/src/notIndex.ts',
      options,
      errors: [{ messageId: 'noCrossBarrelReexport', data: { source: '../sibling' } }]
    },
    {
      code: `export type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';`,
      filename: '/repo/packages/pkg/src/notIndex.ts',
      options,
      errors: [{ messageId: 'noCrossBarrelReexport', data: { source: 'salesforcedx-vscode-services' } }]
    },
    {
      code: `export { x } from '@salesforce/vscode-services';`,
      filename: '/repo/packages/pkg/src/notIndex.ts',
      options,
      errors: [{ messageId: 'noCrossBarrelReexport', data: { source: '@salesforce/vscode-services' } }]
    },
    // subpath of a workspace package matches by package-name prefix
    {
      code: `export * from '@salesforce/soql-common/model/model';`,
      filename: '/repo/packages/pkg/src/notIndex.ts',
      options,
      errors: [{ messageId: 'noCrossBarrelReexport', data: { source: '@salesforce/soql-common/model/model' } }]
    },
    {
      code: `export { foo } from '.';`,
      filename: '/repo/packages/pkg/src/notIndex.ts',
      options,
      errors: [{ messageId: 'noCrossBarrelReexport', data: { source: '.' } }]
    }
  ]
});
