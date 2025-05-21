/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SFDX_CORE_CONFIGURATION_NAME } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';

// Eligibility for OpenAPI Document ONLY, should not be changed by users unless overwriting in settings.json
const APEX_ACTION_CLASS_DEF_MODIFIERS = ['withsharing', 'withoutsharing', 'inheritedsharing'];
const APEX_ACTION_CLASS_ACCESS_MODIFIERS = ['global', 'public'];
const APEX_ACTION_METHOD_DEF_MODIFIERS = ['static'];
const APEX_ACTION_METHOD_ACCESS_MODIFIERS = ['global', 'public'];
const APEX_ACTION_PROP_DEF_MODIFIERS = ['static'];
const APEX_ACTION_PROP_ACCESS_MODIFIERS = ['global', 'public'];
const APEX_ACTION_CLASS_REST_ANNOTATION = ['RestResource'];
const APEX_ACTION_METHOD_REST_ANNOTATION = ['HttpDelete', 'HttpGet', 'HttpPatch', 'HttpPost', 'HttpPut'];
// 'AuraEnabled' was removed for W-17550288 and should be added back with W-17579102
const APEX_ACTION_METHOD_ANNOTATION: string[] = [];

// Default eligibility for general OAS generation. Users can changed the setting through VSCode configurations
const DEFAULT_CLASS_ACCESS_MODIFIERS = ['global', 'public'];
const DEFAULT_METHOD_ACCESS_MODIFIERS = ['global', 'public'];
const DEFAULT_PROP_ACCESS_MODIFIERS = ['global', 'public'];

export const retrieveTestCodeCoverage = (): boolean =>
  vscode.workspace.getConfiguration(SFDX_CORE_CONFIGURATION_NAME).get<boolean>('retrieve-test-code-coverage', false);

export const retrieveEnableSyncInitJobs = (): boolean =>
  vscode.workspace.getConfiguration().get<boolean>('salesforcedx-vscode-apex.wait-init-jobs', true);

export const retrieveEnableApexLSErrorToTelemetry = (): boolean =>
  vscode.workspace.getConfiguration().get<boolean>('salesforcedx-vscode-apex.enable-apex-ls-error-to-telemetry', false);

// Configurations of the definitions of eligible apex classes/methods/properties
// We want to lock the eligibility criteria for apexoas, so we do not expose the settings to customer
// But we can still modify the config through settings.json
export const retrieveAAClassDefModifiers = (): string[] => {
  const userDefinedModifiers = vscode.workspace
    .getConfiguration()
    .get<string[]>('salesforcedx-vscode-apex.apexoas.aa.class.definition-modifiers', []);

  return [...new Set([...APEX_ACTION_CLASS_DEF_MODIFIERS, ...userDefinedModifiers])];
};

export const retrieveAAClassAccessModifiers = (): string[] => {
  const userDefinedModifiers = vscode.workspace
    .getConfiguration()
    .get<string[]>('salesforcedx-vscode-apex.apexoas.aa.class.access-modifiers', []);
  return [...new Set([...APEX_ACTION_CLASS_ACCESS_MODIFIERS, ...userDefinedModifiers])];
};

export const retrieveAAMethodDefModifiers = (): string[] => {
  const userDefinedModifiers = vscode.workspace
    .getConfiguration()
    .get<string[]>('salesforcedx-vscode-apex.apexoas.aa.method.definition-modifiers', []);
  return [...new Set([...APEX_ACTION_METHOD_DEF_MODIFIERS, ...userDefinedModifiers])];
};

export const retrieveAAMethodAccessModifiers = (): string[] => {
  const userDefinedModifiers = vscode.workspace
    .getConfiguration()
    .get<string[]>('salesforcedx-vscode-apex.apexoas.aa.method.access-modifiers', []);
  return [...new Set([...APEX_ACTION_METHOD_ACCESS_MODIFIERS, ...userDefinedModifiers])];
};

export const retrieveAAPropDefModifiers = (): string[] => {
  const userDefinedModifiers = vscode.workspace
    .getConfiguration()
    .get<string[]>('salesforcedx-vscode-apex.apexoas.aa.prop.definition-modifiers', []);
  return [...new Set([...APEX_ACTION_PROP_DEF_MODIFIERS, ...userDefinedModifiers])];
};

export const retrieveAAPropAccessModifiers = (): string[] => {
  const userDefinedModifiers = vscode.workspace
    .getConfiguration()
    .get<string[]>('salesforcedx-vscode-apex.apexoas.aa.prop.definition-modifiers', []);
  return [...new Set([...APEX_ACTION_PROP_ACCESS_MODIFIERS, ...userDefinedModifiers])];
};

export const retrieveAAMethodAnnotations = (): string[] => {
  const userDefinedModifiers = vscode.workspace
    .getConfiguration()
    .get<string[]>('salesforcedx-vscode-apex.apexoas.aa.method.annotations', []);
  return [...new Set([...APEX_ACTION_METHOD_ANNOTATION, ...userDefinedModifiers])];
};

// The REST-related annotations should not be edited by users
export const retrieveAAClassRestAnnotations = (): string[] => [...new Set([...APEX_ACTION_CLASS_REST_ANNOTATION])];

export const retrieveAAMethodRestAnnotations = (): string[] => [...new Set([...APEX_ACTION_METHOD_REST_ANNOTATION])];

export const retrieveGeneralClassAccessModifiers = (): string[] =>
  vscode.workspace
    .getConfiguration()
    .get<string[]>('salesforcedx-vscode-apex.apexoas.general.class.access-modifiers', DEFAULT_CLASS_ACCESS_MODIFIERS);

export const retrieveGeneralMethodAccessModifiers = (): string[] =>
  vscode.workspace
    .getConfiguration()
    .get<string[]>('salesforcedx-vscode-apex.apexoas.general.method.access-modifiers', DEFAULT_METHOD_ACCESS_MODIFIERS);

export const retrieveGeneralPropAccessModifiers = (): string[] =>
  vscode.workspace
    .getConfiguration()
    .get<string[]>('salesforcedx-vscode-apex.apexoas.general.prop.access-modifiers', DEFAULT_PROP_ACCESS_MODIFIERS);

export function getApexLanguageServerRestartBehavior(): string {
  return vscode.workspace
    .getConfiguration('salesforcedx-vscode-apex')
    .get<string>('languageServer.restartBehavior', 'prompt');
}
