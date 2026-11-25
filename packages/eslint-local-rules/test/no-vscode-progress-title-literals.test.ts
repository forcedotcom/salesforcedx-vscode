/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { noVscodeProgressTitleLiterals } from '../src/noVscodeProgressTitleLiterals';

const ruleTester = new RuleTester();

ruleTester.run('no-vscode-progress-title-literals', noVscodeProgressTitleLiterals, {
  valid: [
    {
      code: `promptService.withProgressReporting({ command: 'SFDX: Retrieve', title: nls.localize('fetching_metadata'), cancellable: true })(work);`
    },
    {
      code: `promptService.withProgress({ command: 'SFDX: Retrieve', title: nls.localize('fetching_metadata'), cancellable: false })(fetchMetadata);`
    },
    {
      code: `vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: nls.localize('checking_conflicts'), cancellable: false },
        () => tracking.reReadLocalTrackingCache()
      );`,
      options: []
    },
    {
      code: `vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: input.title, cancellable: true },
        async (_, token) => { /* ... */ }
      );`,
      options: []
    },
    {
      code: `const title = nls.localize('retrieving'); vscode.window.withProgress({ title, location: vscode.ProgressLocation.Notification }, fn);`,
      options: []
    },
    {
      code: `vscode.window.withProgress(
        { title: nls.localize('apex_log_list_text'), location: vscode.ProgressLocation.Notification },
        fn
      );`,
      options: []
    },
    {
      code: `const title = nls.localize('fetching_metadata'); promptService.withProgress({ title, location, cancellable: false })(fetchMetadata);`,
      options: []
    }
  ],
  invalid: [
    ...['withProgress', 'withProgressReporting'].map(method => ({
      code: `promptService.${method}({ command, title: 'Fetching metadata', cancellable: true })(work);`,
      errors: [{ messageId: 'noLiteral' as const }]
    })),
    {
      code: `promptService.withProgress({ command, title: 'Fetching metadata', cancellable: false })(fetchMetadata);`,
      errors: [{ messageId: 'noLiteral' }]
    },
    {
      code: `vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Checking for conflicts', cancellable: false },
        () => tracking.reReadLocalTrackingCache()
      );`,
      errors: [{ messageId: 'noLiteral' }]
    },
    {
      code: `vscode.window.withProgress({ title: 'Hardcoded title', location: vscode.ProgressLocation.Window }, fn);`,
      errors: [{ messageId: 'noLiteral' }]
    },
    {
      code: `const t = 'Some progress'; vscode.window.withProgress({ title: t, location: vscode.ProgressLocation.Notification }, fn);`,
      errors: [{ messageId: 'noLiteral' }]
    },
    {
      code: `const t = 'Fetching metadata…'; promptService.withProgress({ title: t, location, cancellable: false })(fetchMetadata);`,
      errors: [{ messageId: 'noLiteral' }]
    }
  ]
});
