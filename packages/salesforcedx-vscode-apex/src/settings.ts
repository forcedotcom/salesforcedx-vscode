/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SFDX_CORE_CONFIGURATION_NAME } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';

export const retrieveTestCodeCoverage = (): boolean => {
  return vscode.workspace
    .getConfiguration(SFDX_CORE_CONFIGURATION_NAME)
    .get<boolean>('retrieve-test-code-coverage', false);
};

export const retrieveEnableSyncInitJobs = (): boolean => {
  return vscode.workspace.getConfiguration().get<boolean>('salesforcedx-vscode-apex.wait-init-jobs', true);
};

// Configurations of the definitions of eligible apex classes/methods/properties
// We want to lock the eligibility criteria for apexoas, so we do not expose the settings to customer
// But we can still modify the config through settings.json
export const retrieveClassAccessModifiers = (): string[] =>
  vscode.workspace
    .getConfiguration()
    .get<string[]>('salesforcsalesforcedx-vscode-apex.apexoas.eligibility.class.access-modifiers', ['public']);

export const retrieveClassDefinitionModifiers = (): string[] =>
  vscode.workspace
    .getConfiguration()
    .get<string[]>('salesforcsalesforcedx-vscode-apex.apexoas.eligibility.class.definition-modifiers', ['withsharing']);

export const retrieveMethodAndPropertyModifiers = (): string[] =>
  vscode.workspace
    .getConfiguration()
    .get<string[]>('salesforcedx-vscode-apex.apexoas.eligibility.method.modifiers', ['global', 'public']);

export const retrieveMethodAndPropertyAnnotations = (): string[] =>
  vscode.workspace
    .getConfiguration()
    .get<string[]>('salesforcedx-vscode-apex.apexoas.eligibility.method.annotations', ['AuraEnabled', 'RestResource']);
