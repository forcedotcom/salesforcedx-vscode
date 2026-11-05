/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExportResultCode, type ExportResult } from '@opentelemetry/core';
import { trackExportCallbacks } from '../../../src/observability/exportCallbacks';

it('preserves a failed callback, still flushes the delegate and removes its pending record', async () => {
  const entered = Promise.withResolvers<(result: ExportResult) => void>();
  const forceFlush = vi.fn(() => Promise.resolve());
  const shutdown = vi.fn(() => Promise.resolve());
  const tracked = trackExportCallbacks({
    export: (_items: unknown[], callback) => entered.resolve(callback),
    forceFlush,
    shutdown
  });
  const resultCallback = vi.fn();
  tracked.export([], resultCallback);
  const complete = await entered.promise;
  const flushing = tracked.forceFlush();
  const error = new Error('export failed');
  complete({ code: ExportResultCode.FAILED, error });
  await expect(flushing).rejects.toBe(error);
  expect(resultCallback).toHaveBeenCalledExactlyOnceWith({ code: ExportResultCode.FAILED, error });
  expect(forceFlush).toHaveBeenCalledTimes(1);
  await tracked.forceFlush();
  await tracked.shutdown();
  expect(forceFlush).toHaveBeenCalledTimes(2);
  expect(shutdown).toHaveBeenCalledTimes(1);
});

it('preserves a synchronous export throw without leaving an orphaned pending record', async () => {
  const defect = new Error('native export threw');
  const forceFlush = vi.fn(() => Promise.resolve());
  const shutdown = vi.fn(() => Promise.resolve());
  const tracked = trackExportCallbacks({
    export: (_items: unknown[]) => {
      throw defect;
    },
    forceFlush,
    shutdown
  });
  expect(() => tracked.export([], vi.fn())).toThrow(defect);
  await tracked.forceFlush();
  await tracked.shutdown();
  expect(forceFlush).toHaveBeenCalledTimes(1);
  expect(shutdown).toHaveBeenCalledTimes(1);
});
