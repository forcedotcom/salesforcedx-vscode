/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { AttributeValue, Attributes, SpanStatus } from '@opentelemetry/api';
import { NoopSpanProcessor, type Span } from '@opentelemetry/sdk-trace-base';
import { isNotUndefined, isString } from 'effect/Predicate';
import { redactSecrets } from './redactSecrets';

/** redact each element of a string-valued attribute array, keeping the original array when nothing changed */
const redactStringArray = (value: (string | null | undefined)[]): (string | null | undefined)[] => {
  const redacted = value.map(element => (isString(element) ? redactSecrets(element) : element));
  return redacted.some((element, index) => element !== value[index]) ? redacted : value;
};

const isStringArray = (value: AttributeValue): value is (string | null | undefined)[] =>
  Array.isArray(value) && value.every(element => isString(element) || element === null || element === undefined);

const redactAttributeValue = (value: AttributeValue): AttributeValue =>
  isString(value) ? redactSecrets(value) : isStringArray(value) ? redactStringArray(value) : value;

/** in-place rewrite of the string-valued entries of a span's (or span event's) attributes */
const redactAttributes = (attributes: Attributes): void =>
  Object.entries(attributes).forEach(([key, value]) => {
    const redacted = isNotUndefined(value) ? redactAttributeValue(value) : value;
    // only write when something changed, so unaffected values stay referentially identical
    if (redacted !== value) attributes[key] = redacted;
  });

// `status` is `readonly` on ReadableSpan, but a plain mutable field on SpanImpl, and `_ended` is still
// false during onEnding. Taking the argument as a mutable-status shape writes it without a type
// assertion (banned by consistent-type-assertions) and without setStatus, which early-returns for
// UNSET/OK codes and so would let a message through unredacted.
const redactStatusMessage = (span: { status: SpanStatus }): void => {
  if (isString(span.status.message)) {
    span.status = { ...span.status, message: redactSecrets(span.status.message) };
  }
};

/**
 * Scrubs Salesforce secrets out of every span before any exporter sees it.
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
    redactAttributes(span.attributes);
    redactStatusMessage(span);
    // exception events: @effect/opentelemetry records Cause.pretty output as exception.message /
    // exception.stacktrace, which is where third-party error text (jsforce, @salesforce/core) lands
    span.events
      .map(event => event.attributes)
      .filter(isNotUndefined)
      .forEach(redactAttributes);
  }
}
