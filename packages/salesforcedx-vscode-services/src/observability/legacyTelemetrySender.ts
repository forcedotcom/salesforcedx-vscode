/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Tracer as OtelTracer } from '@effect/opentelemetry';
import * as Effect from 'effect/Effect';
import { isString } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { workspace, type ExtensionContext } from 'vscode';
import { SFDX_CORE_SECTION } from '../constants';
import { runOnServicesRuntime } from './redactingConsoleLogger';
import { getSdkLayerConfigFromContext, resolveConnectionString } from './sdkLayerConfig';
import { setSpanCreationIdentity } from './spanTransformProcessor';

// legacy install-stats key fallback, not services span default
export const LEGACY_DEFAULT_AI_CONNECTION_STRING = 'InstrumentationKey=ec3632a4-df47-47a4-98dc-8134cacbaf7e';

// marker attributing spans to the legacy TelemetryService path; doubles as queryable dimension
export const LEGACY_TELEMETRY_SOURCE_ATTR = 'telemetrySource';
export const LEGACY_TELEMETRY_SOURCE_VALUE = 'legacy';

// caller O11y config stamped at send time so the router restores per-caller routing
export const LEGACY_O11Y_ENDPOINT_ATTR = 'legacy.o11yEndpoint';
export const LEGACY_O11Y_ENABLED_ATTR = 'legacy.o11yEnabled';
export const LEGACY_PRODUCT_FEATURE_ID_ATTR = 'legacy.productFeatureId';

// marker set by getLegacyTelemetrySender; doubles as queryable dimension, never stripped
export const isLegacySpan = (span: { attributes: Record<string, unknown> }): boolean =>
  span.attributes[LEGACY_TELEMETRY_SOURCE_ATTR] === LEGACY_TELEMETRY_SOURCE_VALUE;

// caller extension name stamped by sender via common.extname override
export const legacyCallerExtName = (span: { attributes: Record<string, unknown> }): string => {
  const value = span.attributes['common.extname'];
  return isString(value) ? value : 'unknown';
};

type LegacyTelemetryIdentity = {
  cliId?: string;
  webUserId: string;
  orgId?: string;
  orgShape?: string;
  devHubId?: string;
  orgEdition?: string;
  telemetryClassification: 'gov' | 'nonGov' | 'unknown';
};

export type LegacyTelemetryPayload = {
  kind: 'event' | 'exception';
  name: string;
  message?: string;
  properties?: Readonly<Record<string, string>>;
  measurements?: Readonly<Record<string, number>>;
  identity: LegacyTelemetryIdentity;
};

// otelConnectionString as-is, aiKey normalized, else legacy default; precedence shared with sdkLayerConfig
export const resolveLegacyConnectionString = (packageJSON?: {
  otelConnectionString?: string;
  aiKey?: string;
}): string => resolveConnectionString(packageJSON, LEGACY_DEFAULT_AI_CONNECTION_STRING);

export const legacySpanName = (extensionName: string, eventName: string): string => `${extensionName}/${eventName}`;

// payload-derived attributes; resource/common + frozen identity applied by sender post-onStart
export const buildLegacySpanAttributes = (
  payload: LegacyTelemetryPayload,
  callerO11y?: { endpoint?: string; enabled: boolean; productFeatureId?: string }
): Record<string, string | number> => {
  const properties = payload.properties ?? {};
  const measurements = payload.measurements ?? {};
  const attributes: Record<string, string | number> = {
    ...properties,
    ...measurements,
    [LEGACY_TELEMETRY_SOURCE_ATTR]: LEGACY_TELEMETRY_SOURCE_VALUE
  };
  // PFT: O11ySpanExporter emits vscodeExtension.executed when command is string
  if (
    payload.kind !== 'exception' &&
    payload.name === 'commandExecution' &&
    typeof properties.commandName === 'string'
  ) {
    attributes.command = properties.commandName;
  }
  // org identity so properties carry org context like SpanTransformProcessor top-level spans
  const { identity } = payload;
  if (identity.orgId) attributes.orgId = identity.orgId;
  if (identity.devHubId) {
    attributes.devHubOrgId = identity.devHubId;
    attributes.devHubId = identity.devHubId;
  }
  if (identity.orgShape) attributes.orgShape = identity.orgShape;
  if (identity.orgEdition) attributes.orgEdition = identity.orgEdition;
  if (identity.cliId) {
    attributes.cliId = identity.cliId;
    attributes.userId = identity.cliId;
  }
  if (identity.webUserId) attributes.webUserId = identity.webUserId;
  // caller O11y config for the router; dropped there when not enabled (never stripped, like the marker)
  if (callerO11y) {
    attributes[LEGACY_O11Y_ENABLED_ATTR] = callerO11y.enabled ? 'true' : 'false';
    if (callerO11y.endpoint) attributes[LEGACY_O11Y_ENDPOINT_ATTR] = callerO11y.endpoint;
    if (callerO11y.productFeatureId) attributes[LEGACY_PRODUCT_FEATURE_ID_ATTR] = callerO11y.productFeatureId;
  }
  const telemetryTag = workspace.getConfiguration(SFDX_CORE_SECTION)?.get<string>('telemetry-tag');
  if (isString(telemetryTag)) attributes.telemetryTag = telemetryTag;
  return attributes;
};

// packageJSON enableO11y is a stringbool ("true") or boolean; raw caller packageJSON is unvalidated
const isO11yEnabled = (value: unknown): boolean =>
  value === true || (isString(value) && /^(true|1|y|yes|on)$/i.test(value.trim()));

const readEnableO11y = (packageJSON: unknown): unknown =>
  typeof packageJSON === 'object' && packageJSON !== null && 'enableO11y' in packageJSON
    ? packageJSON.enableO11y
    : undefined;

type LegacyTelemetrySenderConfig = {
  extensionName: string;
  extensionVersion: string;
  callerO11y: { endpoint?: string; enabled: boolean; productFeatureId?: string };
};

class LegacyTelemetryException extends Schema.TaggedError<LegacyTelemetryException>()('LegacyTelemetryException', {
  exceptionName: Schema.String,
  message: Schema.String
}) {}

/** Create a legacy event as a root span in the services Effect runtime. */
export const createLegacyTelemetrySpan = (config: LegacyTelemetrySenderConfig, payload: LegacyTelemetryPayload) => {
  const { extensionName, extensionVersion, callerO11y } = config;
  const attributes = {
    ...buildLegacySpanAttributes(payload, callerO11y),
    ...(payload.kind === 'exception' ? { exceptionName: payload.name, exceptionMessage: payload.message ?? '' } : {}),
    'common.extname': extensionName,
    'common.extversion': extensionVersion
  };

  return Effect.gen(function* () {
    const span = yield* OtelTracer.currentOtelSpan;
    // SpanTransformProcessor.onStart stamps live org identity. Restore the legacy
    // send-time snapshot and caller metadata on the underlying SDK span before end.
    Object.entries(attributes).forEach(([key, value]) => span.setAttribute(key, value));
    setSpanCreationIdentity(span, {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- branded OrgId from plain string
      orgId: payload.identity.orgId as never,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- branded OrgId from plain string
      devHubOrgId: payload.identity.devHubId as never,
      userId: payload.identity.cliId,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- CliId brand from plain string
      cliId: payload.identity.cliId as never,
      webUserId: payload.identity.webUserId,
      orgEdition: payload.identity.orgEdition,
      telemetryClassification: payload.identity.telemetryClassification
    });
    if (payload.kind === 'exception') {
      return yield* new LegacyTelemetryException({ exceptionName: payload.name, message: payload.message ?? '' });
    }
  }).pipe(
    Effect.withSpan(legacySpanName(extensionName, payload.name), {
      kind: 'internal',
      root: true,
      attributes
    }),
    // Handle only the expected exception event after withSpan records its failure
    // status. Missing runtime span errors must still reach the sender's caller.
    Effect.catchTag('LegacyTelemetryException', () => Effect.void)
  );
};

// cached sender, built once per TelemetryService instance
export const getLegacyTelemetrySender = (
  context: ExtensionContext
): ((payload: LegacyTelemetryPayload) => Promise<void>) => {
  const { extensionName, extensionVersion, o11yEndpoint, productFeatureId } = getSdkLayerConfigFromContext(context);
  const config = {
    extensionName,
    extensionVersion,
    callerO11y: {
      endpoint: o11yEndpoint,
      enabled: isO11yEnabled(readEnableO11y(context.extension.packageJSON)),
      productFeatureId
    }
  };
  return payload => createLegacyTelemetrySpan(config, payload).pipe(runOnServicesRuntime, Effect.runPromise);
};
