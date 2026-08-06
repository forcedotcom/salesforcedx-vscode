/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { toO11yEvent } from '../../../src/observability/o11ySpanExporter';
import { getSpanCreationIdentity, SpanTransformProcessor } from '../../../src/observability/spanTransformProcessor';

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
      duration: [1, 0]
    } as unknown as Parameters<SpanTransformProcessor['onStart']>[0];
    const processor = new SpanTransformProcessor(
      {} as never,
      undefined,
      () => false,
      () => snapshot
    );
    processor.onStart(span, {} as Parameters<SpanTransformProcessor['onStart']>[1]);

    const identity = getSpanCreationIdentity(span);
    const event = toO11yEvent(span as unknown as ReadableSpan, identity);

    expect(identity).toEqual({ orgId: 'created', devHubOrgId: 'hub', userId: 'user', cliId: 'cli' });
    expect(event.properties).toMatchObject({ userId: 'user', cliId: 'cli' });
  });
});
