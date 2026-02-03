/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Attributes } from '@opentelemetry/api';
import { ReadableSpan } from '@opentelemetry/sdk-trace-base';

/** Check if a span is a top-level span (has no parent) */
export const isTopLevelSpan = (span: ReadableSpan): boolean => span.parentSpanContext === undefined;

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
