/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExportResultCode, type ExportResult } from '@opentelemetry/core';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import * as vscode from 'vscode';
import { AppInsightsRoutingExporter } from '../../../src/observability/appInsightsRoutingExporter';
import {
  LEGACY_DEFAULT_AI_CONNECTION_STRING,
  LEGACY_TELEMETRY_SOURCE_ATTR,
  LEGACY_TELEMETRY_SOURCE_VALUE
} from '../../../src/observability/legacyTelemetrySender';

const makeSpan = (attributes: Record<string, string>): ReadableSpan =>
  ({ name: 'span', attributes }) as unknown as ReadableSpan;

const makeRecordingDelegate = (): SpanExporter & { spans: ReadableSpan[] } => {
  const recorded: { spans: ReadableSpan[] } = { spans: [] };
  return {
    spans: recorded.spans,
    export: (spans: ReadableSpan[], callback: (result: ExportResult) => void): void => {
      recorded.spans.push(...spans);
      callback({ code: ExportResultCode.SUCCESS });
    },
    shutdown: () => Promise.resolve()
  };
};

const exportThrough = (exporter: SpanExporter, spans: ReadableSpan[]): Promise<ExportResult> =>
  new Promise(resolve => exporter.export(spans, resolve));

describe('AppInsightsRoutingExporter', () => {
  const extensionsWithAll = vscode.extensions as unknown as { all?: unknown };

  afterEach(() => {
    delete extensionsWithAll.all;
  });

  it('routes rest spans to the default delegate and legacy spans by caller key', async () => {
    extensionsWithAll.all = [{ packageJSON: { name: 'ext-a', aiKey: 'AAA-KEY' } }];
    const madeLegacyKeys: string[] = [];
    const defaultDelegate = makeRecordingDelegate();
    const legacyDelegates = new Map<string, SpanExporter & { spans: ReadableSpan[] }>();
    const router = new AppInsightsRoutingExporter({
      makeDefault: () => defaultDelegate,
      makeLegacy: (connectionString: string) => {
        madeLegacyKeys.push(connectionString);
        const delegate = makeRecordingDelegate();
        legacyDelegates.set(connectionString, delegate);
        return delegate;
      }
    });

    const legacy = makeSpan({
      [LEGACY_TELEMETRY_SOURCE_ATTR]: LEGACY_TELEMETRY_SOURCE_VALUE,
      'common.extname': 'ext-a'
    });
    const rest = makeSpan({ command: 'other' });
    const result = await exportThrough(router, [legacy, rest]);

    expect(result.code).toBe(ExportResultCode.SUCCESS);
    expect(defaultDelegate.spans).toEqual([rest]);
    expect(madeLegacyKeys).toEqual(['InstrumentationKey=AAA-KEY']);
    expect(legacyDelegates.get('InstrumentationKey=AAA-KEY')?.spans).toEqual([legacy]);
  });

  it('falls back to the legacy default key for unknown extensions', async () => {
    const madeLegacyKeys: string[] = [];
    const router = new AppInsightsRoutingExporter({
      makeDefault: makeRecordingDelegate,
      makeLegacy: (connectionString: string) => {
        madeLegacyKeys.push(connectionString);
        return makeRecordingDelegate();
      }
    });

    await exportThrough(router, [makeSpan({ [LEGACY_TELEMETRY_SOURCE_ATTR]: LEGACY_TELEMETRY_SOURCE_VALUE })]);

    expect(madeLegacyKeys).toEqual([LEGACY_DEFAULT_AI_CONNECTION_STRING]);
  });

  it('skips the default delegate when every span is legacy', async () => {
    const makeDefault = jest.fn(makeRecordingDelegate);
    const router = new AppInsightsRoutingExporter({ makeDefault, makeLegacy: makeRecordingDelegate });

    await exportThrough(router, [makeSpan({ [LEGACY_TELEMETRY_SOURCE_ATTR]: LEGACY_TELEMETRY_SOURCE_VALUE })]);

    expect(makeDefault).not.toHaveBeenCalled();
  });

  it('preserves the marker attribute for downstream exporters', async () => {
    const legacyDelegate = makeRecordingDelegate();
    const router = new AppInsightsRoutingExporter({
      makeDefault: makeRecordingDelegate,
      makeLegacy: () => legacyDelegate
    });

    const legacy = makeSpan({ [LEGACY_TELEMETRY_SOURCE_ATTR]: LEGACY_TELEMETRY_SOURCE_VALUE });
    await exportThrough(router, [legacy]);

    expect(legacyDelegate.spans[0]?.attributes[LEGACY_TELEMETRY_SOURCE_ATTR]).toBe(LEGACY_TELEMETRY_SOURCE_VALUE);
  });
});
