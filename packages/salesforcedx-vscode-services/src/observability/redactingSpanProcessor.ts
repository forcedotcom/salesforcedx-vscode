/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { NoopSpanProcessor, type Span } from '@opentelemetry/sdk-trace-base';
import { isNotUndefined, isString } from 'effect/Predicate';
import { JSONPath } from 'jsonpath-plus';
import { redactSensitiveData } from './redactSensitiveData';

type StringMatch = {
  value: unknown;
  parent: object;
  parentProperty: PropertyKey;
};

/** Rewrite every descendant string value without traversing SpanImpl's SDK internals. */
const redactStringValues = (json: object): void => {
  JSONPath({
    path: '$..*@string()',
    json,
    resultType: 'all',
    eval: false,
    callback: (_match, _type, result: StringMatch) => {
      if (!isString(result.value)) return;
      const redacted = redactSensitiveData(result.value);
      if (redacted !== result.value) Reflect.set(result.parent, result.parentProperty, redacted);
    }
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
    redactStringValues(span.attributes);
    redactStringValues(span.status);
    redactStringValues(span.events);
    span.links
      .map(link => link.attributes)
      .filter(isNotUndefined)
      .forEach(redactStringValues);
    redactStringValues(span.resource.attributes);
  }
}
