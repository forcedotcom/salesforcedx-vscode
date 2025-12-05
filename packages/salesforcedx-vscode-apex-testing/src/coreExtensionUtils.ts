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
  // Re-fetch if extension was deactivated or doesn't exist
  if (!vscodeCoreExtension?.isActive) {
    vscodeCoreExtension = vscode.extensions.getExtension<SalesforceVSCodeCoreApi>(
      'salesforce.salesforcedx-vscode-core'
    );
    if (!vscodeCoreExtension) {
      throw new Error('Could not fetch a SalesforceVSCodeCoreApi instance');
    }
  }
  // vscode could deactivate extensions, so just in case.
  if (!vscodeCoreExtension.isActive) {
    try {
      await vscodeCoreExtension.activate();
    } catch (error) {
      // If activation fails, clear the cached extension so we try again next time
      vscodeCoreExtension = undefined;
      throw error;
    }
  }
  return vscodeCoreExtension;
};

/** makes sure the Apex extension is active and returns the instance */
export const getApexExtension = async (): Promise<vscode.Extension<ApexVSCodeApi>> => {
  // Re-fetch if extension was deactivated or doesn't exist
  if (!apexExtension?.isActive) {
    apexExtension = vscode.extensions.getExtension<ApexVSCodeApi>('salesforce.salesforcedx-vscode-apex');
    if (!apexExtension) {
      throw new Error('Could not fetch Apex extension');
    }
  }
  // vscode could deactivate extensions, so just in case.
  if (!apexExtension.isActive) {
    try {
      await apexExtension.activate();
    } catch (error) {
      // If activation fails, clear the cached extension so we try again next time
      apexExtension = undefined;
      throw error;
    }
  }
  return apexExtension;
};
