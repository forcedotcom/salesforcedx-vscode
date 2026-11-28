/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { TargetOrgRef } from './targetOrgRef.js';
import type * as Resource from '@effect/opentelemetry/Resource';
import type * as Layer from 'effect/Layer';
import type * as OtlpExporter from 'effect/observability/OtlpExporter';
import type * as vscode from 'vscode';

export type SdkLayerConfig = {
  extensionName: string;
  extensionVersion: string;
  o11yEndpoint?: string;
  productFeatureId?: string;
  enableCustomEventsFromSpans?: boolean;
  /** Full Azure Monitor connection string; otelConnectionString precedes normalized aiKey. */
  connectionString?: string;
  /** Development-only HTTP envelope sink; production keeps the normal Azure endpoint. */
  localIngestionEndpoint?: string;
};

/** Per-extension tracing/logging uses the provider's authoritative org ref, without another domain graph. */
export type V2SdkLayerFor = (
  input: SdkLayerConfig | vscode.ExtensionContext
) => Layer.Layer<Resource.Resource | OtlpExporter.Flusher, never, TargetOrgRef>;

export type LegacyTelemetryItem = {
  kind: 'event' | 'exception';
  name: string;
  message?: string;
  properties?: Readonly<Record<string, string>>;
  measurements?: Readonly<Record<string, number>>;
};
export type LegacyTelemetrySender = (
  context: vscode.ExtensionContext
) => (item: LegacyTelemetryItem) => () => Promise<void>;
