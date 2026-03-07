/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { noVscodeUri } from '../src/noVscodeUri';

const ruleTester = new RuleTester();

ruleTester.run('no-vscode-uri', noVscodeUri, {
  valid: [
    {
      code: `import type { URI } from 'vscode-uri';
const fn = (uri: URI) => uri;`,
      filename: 'packages/salesforcedx-vscode-services/src/core/test.ts'
    },
    {
      code: `import { URI } from 'vscode-uri';
const u = URI.file('/path');`,
      filename: 'packages/salesforcedx-vscode-apex-log/src/test.ts'
    },
    {
      code: `import { URI } from 'vscode-uri';
const u = URI.parse('file:///path');`,
      filename: 'packages/salesforcedx-vscode-metadata/src/test.ts'
    }
  ],
  invalid: [
    {
      code: `import * as vscode from 'vscode';
const fn = (uri: vscode.Uri) => uri;`,
      filename: 'packages/salesforcedx-vscode-services/src/core/test.ts',
      errors: [{ messageId: 'useVscodeUri' }]
    },
    {
      code: `import * as vscode from 'vscode';
const u = vscode.Uri.file('/path');`,
      filename: 'packages/salesforcedx-vscode-apex-log/src/test.ts',
      errors: [{ messageId: 'useVscodeUri' }]
    },
    {
      code: `import * as vscode from 'vscode';
const u = vscode.Uri.parse('file:///path');`,
      filename: 'packages/salesforcedx-vscode-metadata/src/test.ts',
      errors: [{ messageId: 'useVscodeUri' }]
    }
  ]
});
