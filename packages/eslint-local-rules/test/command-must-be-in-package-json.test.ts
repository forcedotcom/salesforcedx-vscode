/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { commandMustBeInPackageJson } from '../src/commandMustBeInPackageJson';

const ruleTester = new RuleTester();

// Use a fixture path that has a package.json with contributes.commands
const fixtureDir = path.join(__dirname, 'fixtures');

ruleTester.run('command-must-be-in-package-json', commandMustBeInPackageJson, {
  valid: [
    {
      // Command exists in fixture package.json
      code: `vscode.commands.registerCommand('sf.test.command', () => {});`,
      filename: path.join(fixtureDir, 'test.ts')
    },
    {
      // Another command that exists
      code: `vscode.commands.registerCommand('sf.another.command', handler);`,
      filename: path.join(fixtureDir, 'test.ts')
    },
    {
      // Not a registerCommand call
      code: `vscode.commands.executeCommand('sf.missing.command');`,
      filename: path.join(fixtureDir, 'test.ts')
    },
    {
      // Not vscode.commands
      code: `commands.registerCommand('sf.missing.command', () => {});`,
      filename: path.join(fixtureDir, 'test.ts')
    },
    {
      // Command ID is a variable (can't statically check)
      code: `vscode.commands.registerCommand(COMMAND_ID, () => {});`,
      filename: path.join(fixtureDir, 'test.ts')
    },
    {
      // Command matches ignore pattern (internal command)
      code: `vscode.commands.registerCommand('sf.internal.command', () => {});`,
      filename: path.join(fixtureDir, 'test.ts'),
      options: [{ ignorePatterns: ['\\.internal\\.'] }]
    },
    {
      // Command matches ignore pattern (telemetry)
      code: `vscode.commands.registerCommand('sf.vscode.core.get.telemetry', () => {});`,
      filename: path.join(fixtureDir, 'test.ts'),
      options: [{ ignorePatterns: ['\\.get\\.telemetry$'] }]
    }
  ],
  invalid: [
    {
      // Command not in package.json
      code: `vscode.commands.registerCommand('sf.missing.command', () => {});`,
      filename: path.join(fixtureDir, 'test.ts'),
      errors: [
        {
          messageId: 'missingCommand',
          data: { commandId: 'sf.missing.command' }
        }
      ]
    },
    {
      // Typo in command name
      code: `vscode.commands.registerCommand('sf.test.comand', () => {});`,
      filename: path.join(fixtureDir, 'test.ts'),
      errors: [
        {
          messageId: 'missingCommand',
          data: { commandId: 'sf.test.comand' }
        }
      ]
    },
    {
      // Command doesn't match ignore pattern
      code: `vscode.commands.registerCommand('sf.public.command', () => {});`,
      filename: path.join(fixtureDir, 'test.ts'),
      options: [{ ignorePatterns: ['\\.internal\\.'] }],
      errors: [
        {
          messageId: 'missingCommand',
          data: { commandId: 'sf.public.command' }
        }
      ]
    }
  ]
});
