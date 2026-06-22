/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { noVscodeShowTextDocument } from '../src/noVscodeShowTextDocument';

const ruleTester = new RuleTester();

// NOTE: RuleTester ignores eslint.config file-scoping. The rule itself flags
// `vscode.window.showTextDocument` everywhere; test-file / services-package
// exclusions are enforced by the `off` overrides in eslint.config.mjs, not the rule.
ruleTester.run('no-vscode-show-text-document', noVscodeShowTextDocument, {
  valid: [
    {
      code: `const editor = fsService.showTextDocument(uri);`,
      filename: 'packages/salesforcedx-vscode-apex-log/src/test.ts'
    },
    {
      code: `const editor = yield* api.services.FsService.showTextDocument(uri);`,
      filename: 'packages/salesforcedx-vscode-soql/src/commands/test.ts'
    },
    {
      // unrelated window method — not flagged
      code: `vscode.window.showInformationMessage('hi');`,
      filename: 'packages/salesforcedx-vscode-metadata/src/test.ts'
    }
  ],
  invalid: [
    {
      code: `vscode.window.showTextDocument(doc);`,
      filename: 'packages/salesforcedx-vscode-metadata/src/test.ts',
      errors: [{ messageId: 'useFsService' }]
    },
    {
      code: `window.showTextDocument(doc);`,
      filename: 'packages/salesforcedx-vscode-apex-log/src/test.ts',
      errors: [{ messageId: 'useFsService' }]
    },
    {
      // openTextDocument is allowed; only the show call is flagged → 1 error
      code: `const d = await vscode.workspace.openTextDocument(u);
await vscode.window.showTextDocument(d);`,
      filename: 'packages/salesforcedx-vscode-apex-testing/src/test.ts',
      errors: [{ messageId: 'useFsService' }]
    }
  ]
});
