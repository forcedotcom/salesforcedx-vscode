/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SalesforceVSCodeCoreApi } from 'salesforcedx-vscode-core';
import * as vscode from 'vscode';

const getSalesforceCoreExtension = (): vscode.Extension<SalesforceVSCodeCoreApi> => {
  const extension = vscode.extensions.getExtension<SalesforceVSCodeCoreApi>('salesforce.salesforcedx-vscode-core');
  if (!extension) {
    throw new Error('Salesforce Core Extension not available');
  }
  return extension;
};

/** Get the active Salesforce Core extension */
export const getActiveSalesforceCoreExtension = async (): Promise<vscode.Extension<SalesforceVSCodeCoreApi>> => {
  const salesforceCoreExtension = getSalesforceCoreExtension();
  if (!salesforceCoreExtension.isActive) {
    await salesforceCoreExtension.activate();
  }
  return salesforceCoreExtension;
};

/** Get the channel service from the Salesforce Core extension */
export const getChannelService = async () => (await getActiveSalesforceCoreExtension()).exports.channelService;

/** Get the task view service from the Salesforce Core extension */
export const getTaskViewService = async () => (await getActiveSalesforceCoreExtension()).exports.taskViewService;

/** Get the SfCommandlet class from the Salesforce Core extension */
export const getSfCommandlet = async () => (await getActiveSalesforceCoreExtension()).exports.SfCommandlet;

/** Get the telemetry service from the Salesforce Core extension */
export const getTelemetryService = async () => (await getActiveSalesforceCoreExtension()).exports.telemetryService;

/** Get the SfCommandletExecutor class from the Salesforce Core extension */
export const getSfCommandletExecutorClass = () => {
  const salesforceCoreExtension = getSalesforceCoreExtension();
  if (!salesforceCoreExtension.exports) {
    throw new Error('Salesforce Core Extension not available');
  }
  return salesforceCoreExtension.exports.SfCommandletExecutor;
};
