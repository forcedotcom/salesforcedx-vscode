/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { noDirectHashableUriImports } from '../src/noDirectHashableUriImports';

const ruleTester = new RuleTester();

ruleTester.run('no-direct-hashableuri-imports', noDirectHashableUriImports, {
  valid: [
    {
      code: `import { HashableUri } from 'salesforcedx-vscode-services';`,
      filename: 'packages/salesforcedx-vscode-metadata/src/test.ts'
    },
    {
      code: `import type { HashableUri } from 'salesforcedx-vscode-services';`,
      filename: 'packages/salesforcedx-vscode-metadata/test/jest/foo.test.ts'
    },
    {
      code: `import { something } from 'salesforcedx-vscode-services/src/vscode/editorService';`,
      filename: 'packages/salesforcedx-vscode-metadata/src/test.ts'
    }
  ],
  invalid: [
    {
      code: `import { HashableUri } from 'salesforcedx-vscode-services/src/vscode/hashableUri';`,
      filename: 'packages/salesforcedx-vscode-metadata/src/test.ts',
      errors: [{ messageId: 'noDirectImport' }]
    },
    {
      code: `import type { HashableUri } from 'salesforcedx-vscode-services/src/vscode/hashableUri';`,
      filename: 'packages/salesforcedx-vscode-metadata/test/jest/foo.test.ts',
      errors: [{ messageId: 'noDirectImport' }]
    },
    {
      code: `import { HashableUri } from 'salesforcedx-vscode-services/vscode/hashableUri';`,
      filename: 'packages/salesforcedx-vscode-metadata/src/test.ts',
      errors: [{ messageId: 'noDirectImport' }]
    }
  ]
});
