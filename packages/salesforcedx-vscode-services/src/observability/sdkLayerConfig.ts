/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { ExtensionContext } from 'vscode';

export type SdkLayerConfig = {
  extensionName: string;
  extensionVersion: string;
  o11yEndpoint?: string;
  productFeatureId?: string;
  enableCustomEventsFromSpans?: boolean; // Emit LogRecords for customEvents table routing
  connectionString?: string; // Consumer's App Insights key (overrides DEFAULT_AI_CONNECTION_STRING)
};

export const getSdkLayerConfigFromContext = (context: ExtensionContext): SdkLayerConfig => ({
  extensionName: context.extension.packageJSON.name,
  extensionVersion: context.extension.packageJSON.version,
  o11yEndpoint: process.env.O11Y_ENDPOINT ?? context.extension.packageJSON?.o11yUploadEndpoint,
  productFeatureId: context.extension.packageJSON?.productFeatureId,
  enableCustomEventsFromSpans: context.extension.packageJSON?.enableCustomEventsFromSpans,
  connectionString: context.extension.packageJSON?.aiKey
});
export const isExtensionContext = (input: SdkLayerConfig | vscode.ExtensionContext): input is vscode.ExtensionContext =>
  'extension' in input;
