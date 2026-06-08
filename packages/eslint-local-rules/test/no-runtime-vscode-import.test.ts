/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { noRuntimeVscodeImport } from '../src/noRuntimeVscodeImport';

const ruleTester = new RuleTester();
const filename = 'packages/salesforcedx-vscode-core/test/playwright/example.test.ts';

ruleTester.run('no-runtime-vscode-import', noRuntimeVscodeImport, {
  valid: [
    { code: `import type * as vscode from 'vscode';`, filename },
    { code: `import type { Uri } from 'vscode';`, filename },
    // all-inline-type specifiers → declaration fully erased
    { code: `import { type Uri } from 'vscode';`, filename },
    { code: `import { type Uri, type Range } from 'vscode';`, filename },
    // extension-id string literal, not a module specifier
    { code: `const id = 'vscode.github';`, filename },
    // comment mentioning vscode.window
    { code: `// vscode.window\nconst x = 1;`, filename },
    // error-pattern literal
    { code: `const re = /Cannot find module 'vscode'/;`, filename },
    // unrelated node builtin
    { code: `import fs from 'node:fs';`, filename }
  ],
  invalid: [
    {
      code: `import * as vscode from 'vscode';`,
      filename,
      errors: [{ messageId: 'noRuntimeVscodeImport' }]
    },
    {
      code: `import { window } from 'vscode';`,
      filename,
      errors: [{ messageId: 'noRuntimeVscodeImport' }]
    },
    {
      // mixed inline-type + value specifier → runtime load; exactly one report on source
      code: `import { type Uri, window } from 'vscode';`,
      filename,
      errors: [{ messageId: 'noRuntimeVscodeImport' }]
    },
    {
      code: `import vscode from 'vscode';`,
      filename,
      errors: [{ messageId: 'noRuntimeVscodeImport' }]
    },
    {
      code: `import 'vscode';`,
      filename,
      errors: [{ messageId: 'noRuntimeVscodeImport' }]
    },
    {
      code: `const vscode = require('vscode');`,
      filename,
      errors: [{ messageId: 'noRuntimeVscodeImport' }]
    },
    {
      code: `const fn = async () => { await import('vscode'); };`,
      filename,
      errors: [{ messageId: 'noRuntimeVscodeImport' }]
    }
  ]
});
