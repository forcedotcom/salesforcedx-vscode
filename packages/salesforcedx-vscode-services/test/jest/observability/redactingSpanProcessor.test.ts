/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  type Attributes,
  type AttributeValue,
  type Span as ApiSpan,
  SpanStatusCode,
  TraceFlags
} from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BasicTracerProvider, type ReadableSpan, type Span, type SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { JSONPath } from 'jsonpath-plus';
import { RedactingSpanProcessor } from '../../../src/observability/redactingSpanProcessor';

// shaped like a real opaque access token, with the -/=/+ tail bytes core's regex would leave behind
const TOKEN = '00D000000000000!AQEAQKa-b+c=d';
const TARGET_ORG_COMMAND = 'sf org display --target-org "my-scratch-org" --json';

const snapshotSpan = (span: Span | ReadableSpan) =>
  structuredClone({
    name: span.name,
    kind: span.kind,
    spanContext: span.spanContext(),
    parentSpanContext: span.parentSpanContext,
    startTime: span.startTime,
    endTime: span.endTime,
    duration: span.duration,
    attributes: span.attributes,
    status: span.status,
    events: span.events,
    links: span.links,
    resource: {
      attributes: span.resource.attributes,
      schemaUrl: span.resource.schemaUrl
    },
    instrumentationScope: span.instrumentationScope
  });

type StringLeaf = {
  pointer: string;
  value: unknown;
};

const stringLeavesByPointer = (json: object): Record<string, string> =>
  Object.fromEntries(
    JSONPath<StringLeaf[]>({ path: '$..*@string()', json, resultType: 'all', eval: false })
      .filter((match): match is StringLeaf & { value: string } => typeof match.value === 'string')
      .map(match => [match.pointer, match.value])
  );

const changedStringPaths = (before: object, after: object): string[] => {
  const beforeLeaves = stringLeavesByPointer(before);
  const afterLeaves = stringLeavesByPointer(after);
  return Object.entries(beforeLeaves)
    .filter(([pointer, value]) => afterLeaves[pointer] !== value)
    .map(([pointer]) => pointer)
    .toSorted();
};

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
  extraProcessors: SpanProcessor[] = [],
  resourceAttributes: Attributes = {}
): ReadableSpan => {
  const { processor: recorder, ended } = makeRecorder();
  const redactor = new RedactingSpanProcessor();
  const provider = new BasicTracerProvider({
    resource: resourceFromAttributes(resourceAttributes),
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

  it('redacts target-org PII from attributes, status, and exception events', () => {
    const error = new Error(`Command failed: ${TARGET_ORG_COMMAND}`);
    error.stack = `Error: Command failed: ${TARGET_ORG_COMMAND}`;
    const span = endSpanThrough(s => {
      s.setAttribute('command', TARGET_ORG_COMMAND);
      s.setAttribute('contact', 'first.last@example.com');
      s.setStatus({ code: SpanStatusCode.ERROR, message: `Command failed: ${TARGET_ORG_COMMAND}` });
      s.recordException(error);
    });

    const redactedCommand = 'sf org display --target-org "<REDACTED_TARGET_ORG>" --json';
    expect(span.attributes.command).toBe(redactedCommand);
    expect(span.attributes.contact).toBe('<REDACTED_USERNAME_OR_EMAIL>');
    expect(span.status.message).toBe(`Command failed: ${redactedCommand}`);
    expect(span.events[0].attributes?.['exception.message']).toBe(`Command failed: ${redactedCommand}`);
    expect(span.events[0].attributes?.['exception.stacktrace']).toBe(`Error: Command failed: ${redactedCommand}`);
  });

  it('redacts every mutable exported string surface', () => {
    const span = endSpanThrough(
      s => {
        s.updateName('first.last@example.com');
        s.addEvent('event for first.last@example.com');
        s.addLink({
          context: {
            traceId: '00000000000000000000000000000001',
            spanId: '0000000000000001',
            traceFlags: TraceFlags.SAMPLED
          },
          attributes: { contact: 'link@example.com' }
        });
      },
      'redactorFirst',
      [],
      { contact: 'resource@example.com' }
    );

    expect(span.name).toBe('<REDACTED_USERNAME_OR_EMAIL>');
    expect(span.events[0].name).toBe('event for <REDACTED_USERNAME_OR_EMAIL>');
    expect(span.links[0].attributes?.contact).toBe('<REDACTED_USERNAME_OR_EMAIL>');
    expect(span.resource.attributes.contact).toBe('<REDACTED_USERNAME_OR_EMAIL>');
  });

  it('changes only the approved payload surfaces and preserves structural fields and keys', () => {
    const beforeRedaction: ReturnType<typeof snapshotSpan>[] = [];
    const ended: ReadableSpan[] = [];
    const captureBeforeRedaction: SpanProcessor = {
      onStart: () => {},
      onEnding: sdkSpan => beforeRedaction.push(snapshotSpan(sdkSpan)),
      onEnd: () => {},
      forceFlush: () => Promise.resolve(),
      shutdown: () => Promise.resolve()
    };
    const recorder: SpanProcessor = {
      onStart: () => {},
      onEnd: readableSpan => ended.push(readableSpan),
      forceFlush: () => Promise.resolve(),
      shutdown: () => Promise.resolve()
    };
    const resourceSchemaUrl = 'https://schemas.example.com/user@example.com';
    const provider = new BasicTracerProvider({
      resource: resourceFromAttributes(
        {
          'resource-key@example.com': 'structural key is preserved',
          email: 'resource-value@example.com',
          stable: 'resource value is preserved'
        },
        { schemaUrl: resourceSchemaUrl }
      ),
      spanProcessors: [captureBeforeRedaction, new RedactingSpanProcessor(), recorder]
    });
    const instrumentationVersion = 'version@example.com';
    const span = provider.getTracer(TOKEN, instrumentationVersion).startSpan('operation@example.com');
    const originalSpanContext = span.spanContext();
    span.setAttributes({
      'attribute-key@example.com': 'structural key is preserved',
      email: 'attribute-value@example.com',
      stable: 'attribute value is preserved',
      values: ['array value is preserved', 'array-value@example.com']
    });
    span.setStatus({ code: SpanStatusCode.ERROR, message: `status@example.com ${TOKEN}` });
    span.addEvent('event@example.com', {
      'event-key@example.com': 'structural key is preserved',
      email: 'event-value@example.com',
      stable: 'event value is preserved'
    });
    span.addLink({
      context: {
        traceId: '00000000000000000000000000000001',
        spanId: '0000000000000001',
        traceFlags: TraceFlags.SAMPLED
      },
      attributes: {
        'link-key@example.com': 'structural key is preserved',
        email: 'link-value@example.com',
        stable: 'link value is preserved'
      }
    });
    span.end();

    const before = beforeRedaction[0];
    const after = snapshotSpan(ended[0]);
    expect(changedStringPaths(before, after)).toEqual(
      [
        '/attributes/email',
        '/attributes/values/1',
        '/events/0/attributes/email',
        '/events/0/name',
        '/links/0/attributes/email',
        '/name',
        '/resource/attributes/email',
        '/status/message'
      ].toSorted()
    );

    expect(after.instrumentationScope).toEqual({ name: TOKEN, version: instrumentationVersion, schemaUrl: undefined });
    expect(after.resource.schemaUrl).toBe(resourceSchemaUrl);
    expect(after.spanContext).toEqual(originalSpanContext);
    expect(after.attributes['attribute-key@example.com']).toBe('structural key is preserved');
    expect(after.events[0].attributes?.['event-key@example.com']).toBe('structural key is preserved');
    expect(after.links[0].attributes?.['link-key@example.com']).toBe('structural key is preserved');
    expect(after.resource.attributes['resource-key@example.com']).toBe('structural key is preserved');
    expect(after.status.message).toBe('<REDACTED_USERNAME_OR_EMAIL> <REDACTED ACCESS TOKEN>');
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
});
