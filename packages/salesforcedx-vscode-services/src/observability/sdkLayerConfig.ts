/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { ExtensionContext } from 'vscode';
import { DEFAULT_AI_CONNECTION_STRING } from './appInsights';

export type SdkLayerConfig = {
  extensionName: string;
  extensionVersion: string;
  o11yEndpoint?: string;
  productFeatureId?: string;
  enableCustomEventsFromSpans?: boolean;
  /**
   * Full Azure Monitor connection string for the OTEL path.
   * Expected format: "InstrumentationKey=...;IngestionEndpoint=..."
   * Resolved from packageJSON: otelConnectionString preferred over aiKey (normalized),
   * falling back to DEFAULT_AI_CONNECTION_STRING.
   */
  connectionString?: string;
};

/**
 * Resolves the OTEL connection string from packageJSON with precedence:
 * 1. otelConnectionString — dedicated OTEL field, full format, used as-is
 * 2. aiKey — legacy field; normalized from bare UUID to InstrumentationKey= format if needed
 * 3. undefined — NodeSdkLayerFor falls back to DEFAULT_AI_CONNECTION_STRING
 */
const resolveConnectionString = (packageJSON: ExtensionPackageJSON): string | undefined => {
  const otelConnectionString = packageJSON?.otelConnectionString;
  if (typeof otelConnectionString === 'string' && otelConnectionString) return otelConnectionString;
  const aiKey = packageJSON?.aiKey;
  if (typeof aiKey !== 'string' || !aiKey) return undefined;
  return aiKey.includes('InstrumentationKey=') ? aiKey : `InstrumentationKey=${aiKey}`;
};

type ExtensionPackageJSON = {
  name: string;
  version: string;
  o11yUploadEndpoint?: string;
  productFeatureId?: string;
  enableCustomEventsFromSpans?: boolean;
  otelConnectionString?: string;
  aiKey?: string;
};

export const getSdkLayerConfigFromPackageJSON = (packageJSON: ExtensionPackageJSON): SdkLayerConfig => ({
  extensionName: packageJSON.name,
  extensionVersion: packageJSON.version,
  o11yEndpoint: process.env.O11Y_ENDPOINT ?? packageJSON?.o11yUploadEndpoint,
  productFeatureId: packageJSON?.productFeatureId,
  enableCustomEventsFromSpans: packageJSON?.enableCustomEventsFromSpans,
  connectionString: resolveConnectionString(packageJSON) ?? DEFAULT_AI_CONNECTION_STRING
});

export const getSdkLayerConfigFromContext = (context: ExtensionContext): SdkLayerConfig =>
  getSdkLayerConfigFromPackageJSON(context.extension.packageJSON);
export const isExtensionContext = (input: SdkLayerConfig | vscode.ExtensionContext): input is vscode.ExtensionContext =>
  'extension' in input;
