/*
 * Copyright (c) 2025, salesforce.com, inc.
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
};

export const getSdkLayerConfigFromContext = (context: ExtensionContext): SdkLayerConfig => ({
  extensionName: context.extension.packageJSON.name,
  extensionVersion: context.extension.packageJSON.version,
  o11yEndpoint: process.env.O11Y_ENDPOINT ?? context.extension.packageJSON?.o11yUploadEndpoint,
  productFeatureId: context.extension.packageJSON?.productFeatureId
});
export const isExtensionContext = (input: SdkLayerConfig | vscode.ExtensionContext): input is vscode.ExtensionContext =>
  'extension' in input;
