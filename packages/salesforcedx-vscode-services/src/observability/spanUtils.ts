/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { type Attributes, SpanStatusCode } from '@opentelemetry/api';
import { ReadableSpan } from '@opentelemetry/sdk-trace-base';

/** Check if a span is a top-level span (has no parent) */
export const isTopLevelSpan = (span: ReadableSpan): boolean => span.parentSpanContext === undefined;

/** Check if a span has a command attribute */
export const isCommandSpan = (span: ReadableSpan): boolean => span.attributes['command'] !== undefined;

/** Check if a span should be excluded from production telemetry */
export const isTelemetryIgnored = (span: ReadableSpan): boolean => span.attributes['telemetryIgnore'] === true;

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

/** Serialize span to flat JSON line for file export (AI-optimized). */
export const serializeSpanForFile = (span: ReadableSpan): string =>
  JSON.stringify({
    name: span.name,
    traceId: span.spanContext().traceId,
    spanId: span.spanContext().spanId,
    parentSpanId: span.parentSpanContext?.spanId ?? '',
    durationMs: spanDuration(span),
    status: span.status?.code === SpanStatusCode.ERROR ? 'ERROR' : 'OK',
    startTime: new Date(span.startTime[0] * 1000 + span.startTime[1] / 1_000_000).toISOString(),
    attributes: convertAttributes(span.attributes)
  });
