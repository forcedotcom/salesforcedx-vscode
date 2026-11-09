/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { noVscodeWithProgress } from '../src/noVscodeWithProgress';

const ruleTester = new RuleTester();

ruleTester.run('no-vscode-with-progress', noVscodeWithProgress, {
  valid: [
    { code: 'promptService.withProgress({ command, title, cancellable: true })(build);' },
    { code: 'vscode.window.showQuickPick(items);' },
    {
      code: 'vscode.window.withProgress(options, task);',
      filename: '/repo/packages/salesforcedx-vscode-services/src/vscode/prompts/promptService.ts'
    }
  ],
  invalid: [
    {
      code: 'vscode.window.withProgress(options, task);',
      filename: '/repo/packages/salesforcedx-vscode-services/src/core/metadataDeployService.ts',
      errors: [{ messageId: 'usePromptService' }]
    },
    {
      code: "import { window } from 'vscode'; window.withProgress(options, task);",
      filename: '/repo/packages/salesforcedx-vscode-soql/src/editor/soqlEditorInstance.ts',
      errors: [{ messageId: 'usePromptService' }]
    },
    {
      code: 'vscode.window.withProgress(options, task);',
      filename: '/repo/packages/other/src/promptService.ts',
      errors: [{ messageId: 'usePromptService' }]
    }
  ]
});
