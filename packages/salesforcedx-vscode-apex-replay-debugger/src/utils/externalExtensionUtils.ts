/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ApexVSCodeApi } from 'salesforcedx-vscode-apex';
import type { SalesforceVSCodeCoreApi } from 'salesforcedx-vscode-core';
import * as vscode from 'vscode';

let vscodeCoreExtension: vscode.Extension<SalesforceVSCodeCoreApi> | undefined;
let apexExtension: vscode.Extension<ApexVSCodeApi> | undefined;

/** makes sure the extension is active and returns the instance */
export const getVscodeCoreExtension = async (): Promise<vscode.Extension<SalesforceVSCodeCoreApi>> => {
  if (!vscodeCoreExtension) {
    vscodeCoreExtension = vscode.extensions.getExtension<SalesforceVSCodeCoreApi>(
      'salesforce.salesforcedx-vscode-core'
    );
    if (!vscodeCoreExtension) {
      throw new Error('Could not fetch a SalesforceVSCodeCoreApi instance');
    }
  }
  // vscode could deactivate extensions, so just in case.
  if (!vscodeCoreExtension.isActive) {
    await vscodeCoreExtension.activate();
  }
  return vscodeCoreExtension;
};

export const getApexExtension = async (): Promise<vscode.Extension<ApexVSCodeApi>> => {
  if (!apexExtension) {
    apexExtension = vscode.extensions.getExtension<ApexVSCodeApi>('salesforce.salesforcedx-vscode-apex');
    throw new Error('Could not fetch a ApexVSCodeApi instance');
  }
  if (!apexExtension.isActive) {
    await apexExtension.activate();
  }
  return apexExtension;
};
