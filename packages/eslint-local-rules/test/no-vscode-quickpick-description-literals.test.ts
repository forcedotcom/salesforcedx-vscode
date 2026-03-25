/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { noVscodeQuickpickDescriptionLiterals } from '../src/noVscodeQuickpickDescriptionLiterals';

const ruleTester = new RuleTester();

ruleTester.run('no-vscode-quickpick-description-literals', noVscodeQuickpickDescriptionLiterals, {
  valid: [
    {
      code: `vscode.window.showQuickPick([
        { label: 'ApexUnitTest', description: nls.localize('apex_unit_test_template_description') },
        { label: 'BasicUnitTest', description: nls.localize('basic_unit_test_template_description') }
      ], { placeHolder: nls.localize('prompt') });`,
      options: []
    },
    {
      code: `vscode.window.showQuickPick([
        { label: 'JavaScript', value: 'default' },
        { label: 'TypeScript', value: 'typeScript' }
      ]);`,
      options: []
    },
    {
      code: `vscode.window.showQuickPick(items, { placeHolder: nls.localize('prompt') });`,
      options: []
    }
  ],
  invalid: [
    {
      code: `vscode.window.showQuickPick([
        { label: defaultUri.fsPath, description: '(default)', uri: defaultUri }
      ]);`,
      errors: [{ messageId: 'noLiteral' }]
    },
    {
      code: `vscode.window.showQuickPick([
        { label: 'A', description: 'Hardcoded description' },
        { label: 'B', description: nls.localize('key') }
      ]);`,
      errors: [{ messageId: 'noLiteral' }]
    },
    {
      code: `vscode.window.showQuickPick([
        { label: 'A', description: 'First' },
        { label: 'B', description: 'Second' }
      ]);`,
      errors: [{ messageId: 'noLiteral' }, { messageId: 'noLiteral' }]
    }
  ]
});
