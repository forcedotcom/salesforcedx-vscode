/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExportResult } from '@opentelemetry/core';
import * as Effect from 'effect/Effect';
import { O11ySpanExporter } from '../../../src/observability/o11ySpanExporter';
import { disposeServicesRuntime } from '../../../src/servicesRuntime';

const initialize = jest.fn((..._args: unknown[]) => Promise.resolve());

jest.mock('@salesforce/o11y-reporter', () => ({
  O11yService: {
    getInstance: () => ({
      initialize,
      enableAutoBatching: jest.fn(),
      logEvent: jest.fn(),
      logEventWithSchema: jest.fn(),
      forceFlush: () => Promise.resolve()
    })
  }
}));

jest.mock('o11y_schema/sf_pdp', () => ({ pdpEventSchema: {} }), { virtual: true });

const exportVia = (exporter: O11ySpanExporter): Promise<ExportResult> =>
  new Promise(resolve => exporter.export([], resolve));

describe('O11ySpanExporter falcon opt-in', () => {
  beforeEach(() => {
    initialize.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await Effect.runPromise(disposeServicesRuntime());
  });

  it('initializes without options when falcon is not configured', async () => {
    await exportVia(new O11ySpanExporter('ext', 'https://example.test'));
    expect(initialize).toHaveBeenCalledWith('ext', 'https://example.test', expect.any(Function), undefined);
  });

  it('passes falcon options to initialize when configured', async () => {
    const falcon = { apiKey: 'test-key', environment: 'dev' as const, endpoint: 'https://falcon.test' };
    await exportVia(new O11ySpanExporter('ext', 'https://example.test', undefined, undefined, falcon));
    expect(initialize).toHaveBeenCalledWith('ext', 'https://example.test', expect.any(Function), { falcon });
  });

  it('never logs the falcon api key', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await exportVia(new O11ySpanExporter('ext', 'https://example.test', undefined, undefined, { apiKey: 'test-key' }));
    expect(log.mock.calls.flat().map(String).join('\n')).not.toContain('test-key');
  });
});
