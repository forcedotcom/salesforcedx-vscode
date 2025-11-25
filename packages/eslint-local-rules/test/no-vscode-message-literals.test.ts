/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { noVscodeMessageLiterals } from '../src/noVscodeMessageLiterals';

const ruleTester = new RuleTester();

ruleTester.run('no-vscode-message-literals', noVscodeMessageLiterals, {
  valid: [
    {
      code: `vscode.window.showInformationMessage(nls.localize('key'));`,
      options: []
    },
    {
      code: `const message = nls.localize('key'); vscode.window.showInformationMessage(message);`,
      options: []
    },
    {
      code: `const msg = 'Some message'; vscode.window.showErrorMessage(msg);`,
      options: []
    },
    {
      code: `vscode.window.showWarningMessage(getLocalizedMessage());`,
      options: []
    },
    {
      code: `vscode.window.showErrorMessage(\`\${nls.localize('prefix')} - \${details}\`);`,
      options: []
    },
    {
      code: `vscode.window.showInformationMessage(\`\${nls.localize('key', arg1)} additional text\`);`,
      options: []
    },
    {
      code: `const result = someFunction();`,
      options: []
    }
  ],
  invalid: [
    {
      code: `vscode.window.showInformationMessage('Hardcoded message');`,
      errors: [
        {
          messageId: 'noLiteral',
          data: { method: 'showInformationMessage' }
        }
      ]
    },
    {
      code: `vscode.window.showErrorMessage("An error occurred");`,
      errors: [
        {
          messageId: 'noLiteral',
          data: { method: 'showErrorMessage' }
        }
      ]
    },
    {
      code: `vscode.window.showWarningMessage('Warning: something happened');`,
      errors: [
        {
          messageId: 'noLiteral',
          data: { method: 'showWarningMessage' }
        }
      ]
    },
    {
      code: `vscode.window.showErrorMessage(\`Error: \${errorMessage}\`);`,
      errors: [
        {
          messageId: 'noLiteral',
          data: { method: 'showErrorMessage' }
        }
      ]
    },
    {
      code: `vscode.window.showInformationMessage(\`Failed with code \${code}\`);`,
      errors: [
        {
          messageId: 'noLiteral',
          data: { method: 'showInformationMessage' }
        }
      ]
    }
  ]
});
