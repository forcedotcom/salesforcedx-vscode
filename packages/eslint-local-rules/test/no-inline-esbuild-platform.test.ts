/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { noInlineEsbuildPlatform } from '../src/noInlineEsbuildPlatform';

const ruleTester = new RuleTester();

// NOTE: RuleTester ignores eslint.config file-scoping. The rule flags any
// non-inline use of process.env.ESBUILD_PLATFORM everywhere; test-file
// set/delete/save-restore plumbing is allowed via the `off` override in
// eslint.config.mjs (packages/**/test/**/*.ts, **/__tests__/**/*.ts), not the rule.
ruleTester.run('no-inline-esbuild-platform', noInlineEsbuildPlatform, {
  valid: [
    {
      code: `if (process.env.ESBUILD_PLATFORM === 'web') { doWeb(); }`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts'
    },
    {
      code: `if (process.env.ESBUILD_PLATFORM !== 'web') { doNode(); }`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts'
    },
    {
      // ternary test = BinaryExpression operand
      code: `const reporter = process.env.ESBUILD_PLATFORM === 'web' ? webReporter : nodeReporter;`,
      filename: 'packages/salesforcedx-utils-vscode/src/test.ts'
    },
    {
      code: `return process.env.ESBUILD_PLATFORM === 'web';`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts'
    },
    {
      // unrelated env var — not flagged
      code: `const x = process.env.NODE_ENV;`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts'
    },
    {
      // unrelated destructure — not flagged
      code: `const { NODE_ENV } = process.env;`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts'
    }
  ],
  invalid: [
    {
      code: `const platform = process.env.ESBUILD_PLATFORM;`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts',
      errors: [{ messageId: 'inlineLiteral' }]
    },
    {
      code: `let platform = process.env.ESBUILD_PLATFORM;`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts',
      errors: [{ messageId: 'inlineLiteral' }]
    },
    {
      code: `const config = { platform: process.env.ESBUILD_PLATFORM };`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts',
      errors: [{ messageId: 'inlineLiteral' }]
    },
    {
      code: `class C { platform = process.env.ESBUILD_PLATFORM; }`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts',
      errors: [{ messageId: 'inlineLiteral' }]
    },
    {
      code: `const { ESBUILD_PLATFORM } = process.env;`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts',
      errors: [{ messageId: 'inlineLiteral' }]
    },
    {
      code: `doThing(process.env.ESBUILD_PLATFORM);`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts',
      errors: [{ messageId: 'inlineLiteral' }]
    },
    {
      // assignment to existing variable
      code: `platform = process.env.ESBUILD_PLATFORM;`,
      filename: 'packages/salesforcedx-vscode-services/src/test.ts',
      errors: [{ messageId: 'inlineLiteral' }]
    }
  ]
});
