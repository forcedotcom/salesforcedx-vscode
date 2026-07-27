/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type AttributeValue, type Span as ApiSpan, SpanStatusCode } from '@opentelemetry/api';
import { BasicTracerProvider, type ReadableSpan, type SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { RedactingSpanProcessor } from '../../../src/observability/redactingSpanProcessor';

// shaped like a real opaque access token, with the -/=/+ tail bytes core's regex would leave behind
const TOKEN = '00D000000000000!AQEAQKa-b+c=d';

const makeRecorder = (): { processor: SpanProcessor; ended: ReadableSpan[] } => {
  const ended: ReadableSpan[] = [];
  return {
    ended,
    processor: {
      onStart: () => {},
      onEnd: span => ended.push(span),
      forceFlush: () => Promise.resolve(),
      shutdown: () => Promise.resolve()
    }
  };
};

/**
 * Drives a real BasicTracerProvider so the fan-out contract is exercised rather than mocked:
 * MultiSpanProcessor runs onEnding on every processor before any onEnd.
 */
const endSpanThrough = (
  populate: (span: ApiSpan) => void,
  order: 'redactorFirst' | 'recorderFirst' = 'redactorFirst',
  extraProcessors: SpanProcessor[] = []
): ReadableSpan => {
  const { processor: recorder, ended } = makeRecorder();
  const redactor = new RedactingSpanProcessor();
  const provider = new BasicTracerProvider({
    spanProcessors:
      order === 'redactorFirst' ? [redactor, ...extraProcessors, recorder] : [recorder, ...extraProcessors, redactor]
  });
  const span = provider.getTracer('test').startSpan('sf.command');
  populate(span);
  span.end();
  return ended[0];
};

describe('RedactingSpanProcessor', () => {
  it('redacts a string attribute value before any exporter sees the span', () => {
    const span = endSpanThrough(s => s.setAttribute('errorMessage', `refresh failed for ${TOKEN}`));

    expect(span.attributes.errorMessage).toBe('refresh failed for <REDACTED ACCESS TOKEN>');
  });

  it('redacts status.message and keeps the status code', () => {
    // the @effect/opentelemetry leak: internal/tracer sets status.message = Cause.pretty(cause)
    const span = endSpanThrough(s => s.setStatus({ code: SpanStatusCode.ERROR, message: `Bad_OAuth_Token: ${TOKEN}` }));

    expect(span.status).toEqual({ code: SpanStatusCode.ERROR, message: 'Bad_OAuth_Token: <REDACTED ACCESS TOKEN>' });
  });

  it('redacts exception.message and exception.stacktrace of a recordException event', () => {
    // shape @effect/opentelemetry produces: recordException(firstError) with stack = Cause.pretty(cause)
    const error = new Error(`Bad_OAuth_Token: ${TOKEN}`);
    error.stack = [
      `Error: Bad_OAuth_Token: ${TOKEN}`,
      `    at Connection.refresh (/x/node_modules/@jsforce/jsforce-node/lib/connection.js:100:11) token=${TOKEN}`,
      '    at Object.run (/x/node_modules/@salesforce/core/lib/org.js:42:9)'
    ].join('\n');

    const span = endSpanThrough(s => s.recordException(error));

    const event = span.events[0];
    expect(event.name).toBe('exception');
    expect(event.attributes?.['exception.message']).toBe('Bad_OAuth_Token: <REDACTED ACCESS TOKEN>');
    expect(event.attributes?.['exception.stacktrace']).toBe(
      [
        'Error: Bad_OAuth_Token: <REDACTED ACCESS TOKEN>',
        '    at Connection.refresh (/x/node_modules/@jsforce/jsforce-node/lib/connection.js:100:11) token=<REDACTED ACCESS TOKEN>',
        '    at Object.run (/x/node_modules/@salesforce/core/lib/org.js:42:9)'
      ].join('\n')
    );
    // the type is not secret-bearing and must survive for triage
    expect(event.attributes?.['exception.type']).toBe('Error');
  });

  it('redacts a string[] attribute element-wise', () => {
    const span = endSpanThrough(s => s.setAttribute('args', ['--json', `--token=${TOKEN}`, '--loglevel=debug']));

    expect(span.attributes.args).toEqual(['--json', '--token=<REDACTED ACCESS TOKEN>', '--loglevel=debug']);
  });

  it('ADR-0019: orgId / userId / webUserId / devHubOrgId attributes are untouched', () => {
    const identities = {
      orgId: '00D000000000000AAA',
      userId: '005000000000000AAA',
      webUserId: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      devHubOrgId: '00Dxx0000001gPLEAY'
    };

    const span = endSpanThrough(s => s.setAttributes({ ...identities, errorMessage: `boom ${TOKEN}` }));

    expect(span.attributes).toMatchObject(identities);
    expect(span.attributes.errorMessage).toBe('boom <REDACTED ACCESS TOKEN>');
  });

  it('redacts for a processor registered BEFORE it, because all onEnding run before any onEnd', () => {
    const span = endSpanThrough(s => s.setAttribute('errorMessage', `boom ${TOKEN}`), 'recorderFirst');

    expect(span.attributes.errorMessage).toBe('boom <REDACTED ACCESS TOKEN>');
  });

  it('guard: a span with no hint-bearing text is left alone, arrays included (no reallocation)', () => {
    const seenArrays: (AttributeValue | undefined)[] = [];
    // runs before the redactor, so it captures the array reference the redactor is handed
    const capture: SpanProcessor = {
      onStart: () => {},
      onEnding: s => seenArrays.push(s.attributes.tags),
      onEnd: () => {},
      forceFlush: () => Promise.resolve(),
      shutdown: () => Promise.resolve()
    };

    const span = endSpanThrough(
      s => s.setAttributes({ command: 'sf.lightning.generate.aura.component', tags: ['local', 'desktop'] }),
      'recorderFirst',
      [capture]
    );

    expect(span.attributes.command).toBe('sf.lightning.generate.aura.component');
    expect(span.attributes.tags).toBe(seenArrays[0]);
  });

  it('forceFlush and shutdown resolve', async () => {
    const redactor = new RedactingSpanProcessor();

    await expect(redactor.forceFlush()).resolves.toBeUndefined();
    await expect(redactor.shutdown()).resolves.toBeUndefined();
  });
});
