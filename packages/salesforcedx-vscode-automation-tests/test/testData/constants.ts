/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionConfig } from '@salesforce/salesforcedx-vscode-test-tools/lib/src';

/** Default extension configurations for the consuming project's tests */
export const defaultExtensionConfigs: ExtensionConfig[] = [
  {
    extensionId: 'salesforcedx-vscode-core',
    shouldVerifyActivation: true,
    shouldInstall: 'always'
  },
  {
    extensionId: 'salesforcedx-vscode-org',
    shouldVerifyActivation: true,
    shouldInstall: 'always'
  },
  {
    extensionId: 'salesforcedx-vscode-apex',
    shouldVerifyActivation: true,
    shouldInstall: 'always'
  }
];

/**
 * All Salesforce extensions for reference
 * This list is maintained in the consuming project and defines which extensions
 * should be checked when verifying that extensions are not loaded initially
 */
export const allSalesforceExtensions: ExtensionConfig[] = [
  {
    extensionId: 'salesforcedx-vscode',
    name: 'Salesforce Extension Pack',
    shouldInstall: 'never',
    shouldVerifyActivation: false
  },
  {
    extensionId: 'salesforcedx-vscode-expanded',
    name: 'Salesforce Extension Pack (Expanded)',
    shouldInstall: 'never',
    shouldVerifyActivation: false
  },
  {
    extensionId: 'salesforcedx-vscode-soql',
    name: 'SOQL',
    shouldInstall: 'optional',
    shouldVerifyActivation: false
  },
  {
    extensionId: 'salesforcedx-vscode-org',
    name: 'Salesforce Org Management',
    shouldInstall: 'always',
    shouldVerifyActivation: false
  },
  {
    extensionId: 'salesforcedx-einstein-gpt',
    name: 'Agentforce Vibes',
    shouldInstall: 'optional',
    shouldVerifyActivation: false
  },
  {
    extensionId: 'salesforcedx-vscode-core',
    name: 'Salesforce CLI Integration',
    shouldInstall: 'always',
    shouldVerifyActivation: true
  },
  {
    extensionId: 'salesforcedx-vscode-org',
    name: 'Salesforce Org Management',
    shouldInstall: 'optional',
    shouldVerifyActivation: false
  },
  {
    extensionId: 'salesforcedx-vscode-apex',
    name: 'Apex',
    shouldInstall: 'always',
    shouldVerifyActivation: true
  },
  {
    extensionId: 'salesforcedx-vscode-apex-debugger',
    name: 'Apex Interactive Debugger',
    shouldInstall: 'never',
    shouldVerifyActivation: false
  },
  {
    extensionId: 'salesforcedx-vscode-apex-replay-debugger',
    name: 'Apex Replay Debugger',
    shouldInstall: 'optional',
    shouldVerifyActivation: true
  },
  {
    extensionId: 'salesforcedx-vscode-apex-oas',
    name: 'Apex OAS',
    shouldInstall: 'optional',
    shouldVerifyActivation: false
  },
  {
    extensionId: 'salesforcedx-vscode-lightning',
    name: 'Aura Components',
    shouldInstall: 'optional',
    shouldVerifyActivation: true
  },
  {
    extensionId: 'salesforcedx-vscode-lwc',
    name: 'Lightning Web Components',
    shouldInstall: 'optional',
    shouldVerifyActivation: true
  },
  {
    extensionId: 'salesforcedx-vscode-visualforce',
    name: 'Visualforce',
    shouldInstall: 'optional',
    shouldVerifyActivation: true
  }
];
