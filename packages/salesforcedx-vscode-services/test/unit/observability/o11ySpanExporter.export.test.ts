/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import * as Effect from 'effect/Effect';
import { O11ySpanExporter } from '../../../src/observability/o11ySpanExporter';
import { disposeServicesRuntime } from '../../../src/servicesRuntime';

vi.mock('@salesforce/o11y-reporter', () => ({
  O11yService: {
    getInstance: () => ({
      initialize: () => Promise.reject(new Error('export failed 00D000000000000!export-secret')),
      enableAutoBatching: vi.fn(),
      logEvent: vi.fn(),
      logEventWithSchema: vi.fn(),
      forceFlush: () => Promise.resolve()
    })
  }
}));

const TOKEN = 'export-secret';

const exportFailed = (): Promise<ExportResult> =>
  new Promise(resolve => {
    new O11ySpanExporter('ext', 'https://example.test').export([], resolve);
  });

const consoleOutput = (): string =>
  vi
    .spyOn(console, 'log')
    .mock.calls.map(call => String(call[0]))
    .join('\n');

describe('O11ySpanExporter export failure', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Effect.runPromise(disposeServicesRuntime());
  });

  const assertRedactedFailure = (result: ExportResult, output: string): void => {
    expect(result.code).toBe(ExportResultCode.FAILED);
    expect(result.error?.message).toContain(TOKEN);
    expect(output).toContain('O11ySpanExporter export failed:');
    expect(output).toContain('<REDACTED ACCESS TOKEN>');
    expect(output).not.toContain(TOKEN);
  };

  it('runs the catchAll log through the redacting logger when the services runtime is unset', async () => {
    const result = await exportFailed();

    assertRedactedFailure(result, consoleOutput());
  });
});
