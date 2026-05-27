/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { type Attributes, type HrTime } from '@opentelemetry/api';
import { ReadableSpan } from '@opentelemetry/sdk-trace-base';

/** Check if a span is a top-level span (has no parent) */
const isTopLevelSpan = (span: ReadableSpan): boolean => span.parentSpanContext === undefined;

/** Check if a span has a command attribute */
const isCommandSpan = (span: ReadableSpan): boolean => span.attributes['command'] !== undefined;

/** Check if a span should be excluded from production telemetry */
const isTelemetryIgnored = (span: ReadableSpan): boolean => span.attributes['telemetryIgnore'] === true;

/** Span is not ignored and is either a top-level span or a command span */
export const isSpanValidForProductionTelemetry = (span: ReadableSpan): boolean =>
  !isTelemetryIgnored(span) && (isTopLevelSpan(span) || isCommandSpan(span));

/** Convert span attributes to string key-value pairs, filtering out undefined/null values */
export const convertAttributes = (attributes: Attributes): Attributes =>
  Object.fromEntries(
    Object.entries(attributes)
      .filter(([, value]) => value !== undefined && value !== null)
      .filter(([key]) => key !== 'extension.name' && key !== 'extension.version')
      .map(([key, value]) => [key, String(value)])
  );

/** Calculate span duration in milliseconds */
export const spanDuration = (span: ReadableSpan): number =>
  span.duration ? span.duration[0] * 1000 + span.duration[1] / 1_000_000 : 0;

export const getExtensionNameAndVersionAttributes = (
  attributes: Attributes
): { 'common.extname': string; 'common.extversion': string } => {
  const extensionName = attributes['extension.name'] ?? 'unknown';
  const extensionVersion = attributes['extension.version'] ?? 'unknown';
  return { 'common.extname': String(extensionName), 'common.extversion': String(extensionVersion) };
};

/** Convert HrTime [seconds, nanoseconds] to nanosecond-precision string */
const hrTimeToNano = (hrTime: HrTime): string => (BigInt(hrTime[0]) * 1_000_000_000n + BigInt(hrTime[1])).toString();

/** Serialize span to normalized OTLP-compatible JSON line for offline capture and replay. */
export const serializeSpanOtlp = (span: ReadableSpan, env?: { hostname?: string; processId?: string }): string => {
  const resourceAttrs: Record<string, unknown> = { ...span.resource.attributes };
  const sessionId = span.attributes['common.vscodesessionid'];
  if (sessionId !== undefined) resourceAttrs['captureSessionId'] = String(sessionId);
  if (env?.hostname) resourceAttrs['hostname'] = env.hostname;
  if (env?.processId) resourceAttrs['processId'] = env.processId;

  return JSON.stringify({
    kind: 'span',
    traceId: span.spanContext().traceId,
    spanId: span.spanContext().spanId,
    parentSpanId: span.parentSpanContext?.spanId ?? '',
    name: span.name,
    spanKind: span.kind + 1,
    startTimeUnixNano: hrTimeToNano(span.startTime),
    endTimeUnixNano: hrTimeToNano(span.endTime),
    attributes: span.attributes,
    events: span.events.map(e => ({
      timeUnixNano: hrTimeToNano(e.time),
      name: e.name,
      attributes: e.attributes ?? {}
    })),
    links: span.links.map(l => ({
      traceId: l.context.traceId,
      spanId: l.context.spanId,
      attributes: l.attributes ?? {}
    })),
    status: { code: span.status.code, message: span.status.message ?? '' },
    resource: { attributes: resourceAttrs },
    instrumentationScope: {
      name: span.instrumentationScope.name,
      version: span.instrumentationScope.version ?? ''
    }
  });
};
