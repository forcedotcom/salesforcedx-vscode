/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { NodeSdkLayerFor } from './spansNode';
import { WebSdkLayerFor } from './spansWeb';

export type SdkLayerConfig = {
  extensionName: string;
  extensionVersion: string;
  o11yEndpoint?: string;
};

/**
 * Factory for per-extension SDK layers.
 * Each extension gets its own tracer with extension.name in resource attributes.
 */
export const SdkLayerFor = (config: SdkLayerConfig) =>
  process.env.ESBUILD_PLATFORM === 'web' ? WebSdkLayerFor(config) : NodeSdkLayerFor(config);

/** Pre-built SDK layer factory for the services extension itself */
export const ServicesSdkLayer = () => {
  const extension = vscode.extensions.getExtension('salesforce.salesforcedx-vscode-services');
  const extensionVersion = extension?.packageJSON?.version ?? 'unknown';
  return SdkLayerFor({ extensionName: 'salesforcedx-vscode-services', extensionVersion });
};
