/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { AttributeValue, Attributes } from '@opentelemetry/api';
import { NoopSpanProcessor, type Span } from '@opentelemetry/sdk-trace-base';
import { isNotUndefined, isNullable, isString, isUndefined } from 'effect/Predicate';
import { redactSensitiveData } from './redactSensitiveData';

const isStringArray = (value: AttributeValue): value is (string | null | undefined)[] =>
  Array.isArray(value) && value.every(item => isNullable(item) || isString(item));

const redactAttributeValue = (value: AttributeValue): AttributeValue => {
  if (isString(value)) {
    const redacted = redactSensitiveData(value);
    return redacted === value ? value : redacted;
  }
  if (isStringArray(value)) {
    const redacted = value.map(item => (isString(item) ? redactSensitiveData(item) : item));
    return redacted.every((item, i) => item === value[i]) ? value : redacted;
  }
  return value;
};

/** Rewrite string / string[] leaves. Does not recurse into objects. */
const redactAttributes = (attributes: Attributes): void => {
  Object.entries(attributes).forEach(([key, value]) => {
    if (isUndefined(value)) return;
    const redacted = redactAttributeValue(value);
    if (redacted !== value) attributes[key] = redacted;
  });
};

/**
 * Scrubs secrets and PII out of every span before any exporter sees it.
 *
 * Registered first and unconditionally in the `spanProcessor` array, which the Effect SDK wraps in a
 * `MultiSpanProcessor`: that runs `onEnding` on ALL processors before any `onEnd`, so this single
 * processor covers every sink (console, App Insights, O11y, OTLP http, OTLP file) — local files
 * included. `BatchSpanProcessor` has no `onEnding`, so array order can't defeat it, but first is the
 * honest expression of intent.
 *
 * Mutates the span in place: exporters read the same span object, and cloning would drop the
 * SpanImpl identity the SDK relies on.
 */
// extends NoopSpanProcessor for its no-op onStart/onEnd/forceFlush/shutdown: only onEnding matters here
export class RedactingSpanProcessor extends NoopSpanProcessor {
  // eslint-disable-next-line class-methods-use-this -- SpanProcessor interface method, no instance state
  public onEnding(span: Span): void {
    // Redaction boundary: payload strings are eligible; structural telemetry fields are not. In particular,
    // do not traverse SpanImpl itself: trace/span IDs, link contexts, timing, kind, instrumentation scope,
    // resource schema, and processor/exporter internals must remain unchanged.
    span.updateName(redactSensitiveData(span.name));
    redactAttributes(span.attributes);
    span.status.message = isString(span.status.message)
      ? redactSensitiveData(span.status.message)
      : span.status.message;
    span.events.forEach(event => {
      event.name = redactSensitiveData(event.name);
      if (isNotUndefined(event.attributes)) redactAttributes(event.attributes);
    });
    span.links
      .map(link => link.attributes)
      .filter(isNotUndefined)
      .forEach(redactAttributes);
    redactAttributes(span.resource.attributes);
  }
}
