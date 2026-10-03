/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { toO11yEvent } from '../../../src/observability/o11ySpanExporter';
import { getSpanCreationIdentity, SpanTransformProcessor } from '../../../src/observability/spanTransformProcessor';
import {
  LEGACY_TELEMETRY_SOURCE_ATTR,
  LEGACY_TELEMETRY_SOURCE_VALUE
} from '../../../src/observability/legacyTelemetrySender';

describe('O11ySpanExporter attribution', () => {
  it('uses complete immutable creation identity after the default org switches', () => {
    const snapshot = { orgId: 'created', devHubOrgId: 'hub', userId: 'user', cliId: 'cli' };
    const span = {
      name: 'command',
      parentSpanContext: undefined,
      resource: { attributes: {} },
      attributes: {},
      status: {},
      spanContext: () => ({ traceId: 'trace', spanId: 'span' }),
      startTime: [0, 0],
      endTime: [1, 0],
      duration: [1, 0],
      setAttribute: jest.fn()
    } as unknown as Parameters<SpanTransformProcessor['onStart']>[0];
    const processor = new SpanTransformProcessor({
      exporter: {} as never,
      getIdentitySnapshot: () => snapshot as never
    });
    processor.onStart(span, {} as Parameters<SpanTransformProcessor['onStart']>[1]);

    const identity = getSpanCreationIdentity(span);
    const event = toO11yEvent(span as unknown as ReadableSpan, identity);

    expect(identity).toEqual({ orgId: 'created', devHubOrgId: 'hub', userId: 'user', cliId: 'cli' });
    expect(event.properties).toMatchObject({ userId: 'user', cliId: 'cli' });
  });

  it('keeps legacy numeric measurements as numbers alongside duration', () => {
    const legacy = {
      name: 'ext/commandExecution',
      resource: { attributes: {} },
      attributes: {
        [LEGACY_TELEMETRY_SOURCE_ATTR]: LEGACY_TELEMETRY_SOURCE_VALUE,
        executionTime: 50,
        customMetric: 42,
        commandName: 'myCommand'
      },
      status: {},
      spanContext: () => ({ traceId: 'trace', spanId: 'span' }),
      startTime: [0, 0],
      endTime: [0, 50_000_000],
      duration: [0, 50_000_000]
    } as unknown as ReadableSpan;
    const event = toO11yEvent(legacy, {});
    expect(event.measurements).toEqual({ executionTime: 50, customMetric: 42, duration: 50 });
  });

  it('emits duration-only measurements for non-legacy spans', () => {
    const span = {
      name: 'plain',
      resource: { attributes: {} },
      attributes: { count: 7 },
      status: {},
      spanContext: () => ({ traceId: 'trace', spanId: 'span' }),
      startTime: [0, 0],
      endTime: [1, 0],
      duration: [1, 0]
    } as unknown as ReadableSpan;
    expect(toO11yEvent(span, {}).measurements).toEqual({ duration: 1000 });
  });
});
