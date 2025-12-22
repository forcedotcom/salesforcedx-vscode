/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { noDirectServicesImports } from '../src/noDirectServicesImports';

const ruleTester = new RuleTester();

ruleTester.run('no-direct-services-imports', noDirectServicesImports, {
  valid: [
    {
      code: `import type { EditorService } from 'salesforcedx-vscode-services/src/vscode/editorService';`,
      filename: 'packages/salesforcedx-vscode-metadata/src/test.ts'
    },
    {
      code: `import type { foo, bar } from 'salesforcedx-vscode-services/src/vscode/editorService';`,
      filename: 'packages/salesforcedx-vscode-metadata/src/test.ts'
    },
    {
      code: `import { type EditorService, type NoActiveEditorError } from 'salesforcedx-vscode-services/src/vscode/editorService';`,
      filename: 'packages/salesforcedx-vscode-metadata/src/test.ts'
    },
    {
      code: `import { type foo, type bar } from 'salesforcedx-vscode-services/src/vscode/editorService';`,
      filename: 'packages/salesforcedx-vscode-metadata/src/test.ts'
    },
    {
      code: `import { EditorService } from 'some-other-package';`,
      filename: 'packages/salesforcedx-vscode-metadata/src/test.ts'
    }
  ],
  invalid: [
    {
      code: `import { EditorService } from 'salesforcedx-vscode-services/src/vscode/editorService';`,
      filename: 'packages/salesforcedx-vscode-metadata/src/test.ts',
      errors: [
        {
          messageId: 'noDirectImport'
        }
      ]
    },
    {
      code: `import { foo, type bar } from 'salesforcedx-vscode-services/src/vscode/editorService';`,
      filename: 'packages/salesforcedx-vscode-metadata/src/test.ts',
      errors: [
        {
          messageId: 'noDirectImport'
        }
      ]
    },
    {
      code: `import * as Services from 'salesforcedx-vscode-services';`,
      filename: 'packages/salesforcedx-vscode-metadata/src/test.ts',
      errors: [
        {
          messageId: 'noDirectImport'
        }
      ]
    }
  ]
});
