/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { ExtensionContext, ExtensionMode } from 'vscode';
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
  /**
   * Dev/test only: local HTTP endpoint to divert App Insights envelopes to instead of Azure.
   * When set, NodeSdkLayerFor uses LocalDivertTraceExporter to POST envelopes here over plain HTTP.
   * The connection string is left pristine (the Azure SDK force-upgrades http→https, so the
   * endpoint cannot be carried inside it). Undefined in production = normal Azure export.
   */
  localIngestionEndpoint?: string;
};

/**
 * Resolves the OTEL connection string from packageJSON with precedence:
 * 1. otelConnectionString — dedicated OTEL field, full format, used as-is
 * 2. aiKey — legacy field; normalized from bare UUID to InstrumentationKey= format if needed
 * 3. undefined — NodeSdkLayerFor falls back to DEFAULT_AI_CONNECTION_STRING
 */
const resolveConnectionString = (packageJSON: ExtensionPackageJSON): string | undefined => {
  const otelConnectionString = packageJSON?.otelConnectionString;
  if (otelConnectionString) return otelConnectionString;
  const aiKey = packageJSON?.aiKey;
  if (!aiKey) return undefined;
  return aiKey.includes('InstrumentationKey=') ? aiKey : `InstrumentationKey=${aiKey}`;
};

/** Span file server's /v2.1/track endpoint — default local sink for dev/test telemetry. */
const DEFAULT_LOCAL_INGESTION_ENDPOINT = 'http://localhost:3003';

/**
 * Resolve the dev/test local divert endpoint (App Insights envelopes go here instead of Azure):
 * 1. SF_OTEL_INGESTION_ENDPOINT env var (explicit override, e.g. a custom port)
 * 2. localhost:3003 when in Development/Test extension mode (dev mode implies local divert)
 * 3. undefined — normal Azure export (production)
 *
 * Node-only: the web exporter targets a hard-coded connection string and cannot be diverted.
 */
const resolveLocalIngestionEndpoint = (isDevOrTest: boolean): string | undefined =>
  process.env.SF_OTEL_INGESTION_ENDPOINT ?? (isDevOrTest ? DEFAULT_LOCAL_INGESTION_ENDPOINT : undefined);

type ExtensionPackageJSON = {
  name: string;
  version: string;
  o11yUploadEndpoint?: string;
  productFeatureId?: string;
  enableCustomEventsFromSpans?: boolean;
  otelConnectionString?: string;
  aiKey?: string;
};

export const getSdkLayerConfigFromPackageJSON = (
  packageJSON: ExtensionPackageJSON,
  isDevOrTest = false
): SdkLayerConfig => ({
  extensionName: packageJSON.name,
  extensionVersion: packageJSON.version,
  o11yEndpoint: process.env.O11Y_ENDPOINT ?? packageJSON?.o11yUploadEndpoint,
  productFeatureId: packageJSON?.productFeatureId,
  enableCustomEventsFromSpans: packageJSON?.enableCustomEventsFromSpans,
  connectionString: resolveConnectionString(packageJSON) ?? DEFAULT_AI_CONNECTION_STRING,
  localIngestionEndpoint: resolveLocalIngestionEndpoint(isDevOrTest)
});

export const getSdkLayerConfigFromContext = (context: ExtensionContext): SdkLayerConfig =>
  getSdkLayerConfigFromPackageJSON(
    context.extension.packageJSON,
    context.extensionMode === ExtensionMode.Development || context.extensionMode === ExtensionMode.Test
  );
export const isExtensionContext = (input: SdkLayerConfig | vscode.ExtensionContext): input is vscode.ExtensionContext =>
  'extension' in input;
