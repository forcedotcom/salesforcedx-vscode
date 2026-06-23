/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SpanStatusCode } from '@opentelemetry/api';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { O11yService } from '@salesforce/o11y-reporter';
import { O11ySpanExporter } from '../../../src/observability/o11ySpanExporter';

const buildSpan = (attributes: Record<string, unknown>): ReadableSpan =>
  ({
    name: 'someCommand',
    // no parentSpanContext => top-level span, passes isSpanValidForProductionTelemetry
    parentSpanContext: undefined,
    status: { code: SpanStatusCode.OK },
    duration: [0, 0],
    attributes,
    resource: { attributes: { 'extension.name': 'salesforcedx-vscode-core', 'extension.version': '1.0.0' } },
    spanContext: () => ({ traceId: 'trace-id', spanId: 'span-id' })
  }) as unknown as ReadableSpan;

const exportSpan = (exporter: O11ySpanExporter, span: ReadableSpan): Promise<ExportResult> =>
  new Promise(resolve => exporter.export([span], resolve));

const buildStub = () => ({
  initialize: jest.fn().mockResolvedValue(undefined),
  enableAutoBatching: jest.fn(),
  logEvent: jest.fn(),
  logEventWithSchema: jest.fn(),
  forceFlush: jest.fn().mockResolvedValue(undefined)
});

describe('O11ySpanExporter pdp schema contract', () => {
  it('resolves pdpEventSchema from the o11y_schema/sf_pdp path', async () => {
    // same dynamic import path the exporter uses; guards a missing/renamed sf_pdp export on future bumps
    // @ts-ignore - o11y_schema has no types
    const mod = await import('o11y_schema/sf_pdp');
    expect(mod.pdpEventSchema).toBeDefined();
    expect(typeof mod.pdpEventSchema).toBe('object');
  });

  it('passes the resolved pdpEventSchema into logEventWithSchema for command spans with a productFeatureId', async () => {
    const stub = buildStub();
    jest.spyOn(O11yService, 'getInstance').mockReturnValue(stub as unknown as O11yService);

    const exporter = new O11ySpanExporter('salesforcedx-vscode-core', 'https://endpoint', 'pft-123');
    const result = await exportSpan(exporter, buildSpan({ command: 'SFDX: Deploy' }));

    expect(result.code).toBe(ExportResultCode.SUCCESS);
    expect(stub.logEventWithSchema).toHaveBeenCalledTimes(1);

    // @ts-ignore - o11y_schema has no types
    const { pdpEventSchema } = await import('o11y_schema/sf_pdp');
    const [payload, schemaArg] = stub.logEventWithSchema.mock.calls[0];
    expect(schemaArg).toBe(pdpEventSchema);
    expect(payload).toMatchObject({
      eventName: 'vscodeExtension.executed',
      productFeatureId: 'pft-123',
      componentId: 'salesforcedx-vscode-core.SFDX: Deploy'
    });
  });

  it('skips logEventWithSchema when productFeatureId is absent', async () => {
    const stub = buildStub();
    jest.spyOn(O11yService, 'getInstance').mockReturnValue(stub as unknown as O11yService);

    const exporter = new O11ySpanExporter('salesforcedx-vscode-core', 'https://endpoint');
    const result = await exportSpan(exporter, buildSpan({ command: 'SFDX: Deploy' }));

    expect(result.code).toBe(ExportResultCode.SUCCESS);
    expect(stub.logEvent).toHaveBeenCalledTimes(1);
    expect(stub.logEventWithSchema).not.toHaveBeenCalled();
  });
});
