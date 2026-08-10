/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/** Executable extension directories in the same canonical order as `.vscode/launch.json`. */
export const DRIVABLE_VSCODE_EXTENSION_DIRS = [
  'salesforcedx-vscode-visualforce',
  'salesforcedx-vscode-soql',
  'salesforcedx-vscode-lwc',
  'salesforcedx-vscode-lightning',
  'salesforcedx-vscode-core',
  'salesforcedx-vscode-services',
  'salesforcedx-vscode-org-browser',
  'salesforcedx-vscode-org',
  'salesforcedx-vscode-apex',
  'salesforcedx-vscode-metadata',
  'salesforcedx-vscode-apex-testing',
  'salesforcedx-vscode-apex-oas',
  'salesforcedx-vscode-apex-log',
  'salesforcedx-vscode-apex-replay-debugger',
  'salesforcedx-vscode-apex-debugger'
] as const;

export const QUICK_INPUT_WIDGET = '.quick-input-widget';
export const WORKBENCH = '.monaco-workbench';
