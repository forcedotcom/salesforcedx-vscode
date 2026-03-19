/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { noVscodeValidateinputLiterals } from '../src/noVscodeValidateinputLiterals';

const ruleTester = new RuleTester();

ruleTester.run('no-vscode-validateinput-literals', noVscodeValidateinputLiterals, {
  valid: [
    {
      code: `vscode.window.showInputBox({
        prompt: nls.localize('prompt'),
        validateInput: (value) => value ? undefined : nls.localize('error_empty')
      });`,
      options: []
    },
    {
      code: `vscode.window.showInputBox({
        prompt: nls.localize('prompt'),
        validateInput: (value) => {
          if (!value) return nls.localize('error_empty');
          if (value.length > 10) return nls.localize('error_max_length', 10);
          return undefined;
        }
      });`,
      options: []
    },
    {
      code: `vscode.window.showInputBox({
        prompt: nls.localize('prompt'),
        validateInput: validateUrl
      });`,
      options: []
    },
    {
      code: `vscode.window.showInputBox({
        prompt: nls.localize('prompt')
      });`,
      options: []
    }
  ],
  invalid: [
    {
      code: `vscode.window.showInputBox({
        prompt: nls.localize('prompt'),
        validateInput: (value) => value ? undefined : 'Class name cannot be empty'
      });`,
      errors: [{ messageId: 'noLiteral' }]
    },
    {
      code: `vscode.window.showInputBox({
        validateInput: (value: string) => {
          if (!value || value.trim().length === 0) return 'Class name cannot be empty';
          if (value.toLowerCase() === 'default') return 'Class name cannot be "default"';
          return undefined;
        }
      });`,
      errors: [{ messageId: 'noLiteral' }, { messageId: 'noLiteral' }]
    },
    {
      code: `vscode.window.showInputBox({
        validateInput: (value) =>
          !value?.trim()
            ? 'Script name cannot be empty'
            : !/^[A-Za-z]/.test(value)
              ? 'Name must start with a letter'
              : undefined
      });`,
      errors: [{ messageId: 'noLiteral' }, { messageId: 'noLiteral' }]
    }
  ]
});
