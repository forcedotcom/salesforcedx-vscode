/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExportResultCode } from '@opentelemetry/core';
import type { ReadableLogRecord } from '@opentelemetry/sdk-logs';
import * as fs from 'node:fs';
import { OtlpFileLogExporterNode } from '../../../src/observability/otlpFileLogExporterNode';

jest.mock('node:fs');
jest.mock('../../../src/observability/otlpFileSpanExporterNode', () => ({
  getOtlpFilePath: () => '/tmp/test-otlp.jsonl'
}));

const mockAppendFileSync = fs.appendFileSync as jest.Mock;

const makeLogRecord = (overrides: Partial<ReadableLogRecord> = {}): ReadableLogRecord =>
  ({
    hrTime: [1_700_000_000, 500_000_000] as [number, number],
    hrTimeObserved: [1_700_000_000, 500_000_000] as [number, number],
    severityText: 'INFO',
    severityNumber: 9,
    body: 'test log message',
    spanContext: { traceId: 'abc123trace', spanId: 'def456span', traceFlags: 1 },
    attributes: { 'some.key': 'some-value' },
    resource: { attributes: {} },
    ...overrides
  }) as unknown as ReadableLogRecord;

describe('OtlpFileLogExporterNode', () => {
  beforeEach(() => {
    mockAppendFileSync.mockReturnValue(undefined);
  });

  it('writes to the shared OTLP file path', () => {
    const exporter = new OtlpFileLogExporterNode();
    const callback = jest.fn();

    exporter.export([makeLogRecord()], callback);

    expect(mockAppendFileSync).toHaveBeenCalledWith('/tmp/test-otlp.jsonl', expect.any(String));
    expect(callback).toHaveBeenCalledWith({ code: ExportResultCode.SUCCESS });
  });

  it('serializes log records with kind discriminator and trace correlation', () => {
    const exporter = new OtlpFileLogExporterNode();
    const callback = jest.fn();

    exporter.export([makeLogRecord()], callback);

    const written = mockAppendFileSync.mock.calls[0][1] as string;
    const parsed = JSON.parse(written.trim());

    expect(parsed.kind).toBe('log');
    expect(parsed.severityText).toBe('INFO');
    expect(parsed.severityNumber).toBe(9);
    expect(parsed.body).toBe('test log message');
    expect(parsed.traceId).toBe('abc123trace');
    expect(parsed.spanId).toBe('def456span');
    expect(parsed.attributes).toEqual({ 'some.key': 'some-value' });
    expect(parsed.timestamp).toBeDefined();
  });

  it('handles missing span context', () => {
    const exporter = new OtlpFileLogExporterNode();
    const callback = jest.fn();

    exporter.export([makeLogRecord({ spanContext: undefined })], callback);

    const written = mockAppendFileSync.mock.calls[0][1] as string;
    const parsed = JSON.parse(written.trim());

    expect(parsed.traceId).toBe('');
    expect(parsed.spanId).toBe('');
  });

  it('handles empty log array without writing', () => {
    const exporter = new OtlpFileLogExporterNode();
    const callback = jest.fn();

    exporter.export([], callback);

    expect(mockAppendFileSync).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith({ code: ExportResultCode.SUCCESS });
  });

  it('returns FAILED when file write throws', () => {
    mockAppendFileSync.mockImplementation(() => {
      throw new Error('disk full');
    });
    const exporter = new OtlpFileLogExporterNode();
    const callback = jest.fn();

    exporter.export([makeLogRecord()], callback);

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ code: ExportResultCode.FAILED }));
  });

  it('shutdown resolves', async () => {
    const exporter = new OtlpFileLogExporterNode();
    await expect(exporter.shutdown()).resolves.toBeUndefined();
  });
});
