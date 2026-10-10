/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExportResultCode, type ExportResult } from '@opentelemetry/core';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { O11yRoutingExporter } from '../../../src/observability/o11yRoutingExporter';
import {
  LEGACY_O11Y_ENABLED_ATTR,
  LEGACY_O11Y_ENDPOINT_ATTR,
  LEGACY_PRODUCT_FEATURE_ID_ATTR,
  LEGACY_TELEMETRY_SOURCE_ATTR,
  LEGACY_TELEMETRY_SOURCE_VALUE
} from '../../../src/observability/legacyTelemetrySender';

const makeSpan = (attributes: Record<string, string>): ReadableSpan =>
  ({ name: 'span', attributes }) as unknown as ReadableSpan;

const legacyAttributes = (overrides: Record<string, string> = {}): Record<string, string> => ({
  [LEGACY_TELEMETRY_SOURCE_ATTR]: LEGACY_TELEMETRY_SOURCE_VALUE,
  [LEGACY_O11Y_ENABLED_ATTR]: 'true',
  [LEGACY_O11Y_ENDPOINT_ATTR]: 'https://caller.test/metrics',
  'common.extname': 'ext-a',
  ...overrides
});

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

describe('O11yRoutingExporter', () => {
  it('routes rest spans to the default delegate and legacy spans by caller endpoint', async () => {
    const madeLegacy: Array<[string, string | undefined, string]> = [];
    const defaultDelegate = makeRecordingDelegate();
    const legacyDelegates = new Map<string, SpanExporter & { spans: ReadableSpan[] }>();
    const router = new O11yRoutingExporter({
      makeDefault: () => defaultDelegate,
      makeLegacy: (endpoint, productFeatureId, extensionName) => {
        madeLegacy.push([endpoint, productFeatureId, extensionName]);
        const delegate = makeRecordingDelegate();
        legacyDelegates.set(endpoint, delegate);
        return delegate;
      }
    });

    const legacy = makeSpan(legacyAttributes({ [LEGACY_PRODUCT_FEATURE_ID_ATTR]: 'aJC123' }));
    const rest = makeSpan({ command: 'other' });
    const result = await exportThrough(router, [legacy, rest]);

    expect(result.code).toBe(ExportResultCode.SUCCESS);
    expect(defaultDelegate.spans).toEqual([rest]);
    expect(madeLegacy).toEqual([['https://caller.test/metrics', 'aJC123', 'ext-a']]);
    expect(legacyDelegates.get('https://caller.test/metrics')?.spans).toEqual([legacy]);
  });

  it('drops legacy spans from callers without enableO11y or endpoint', async () => {
    const makeDefault = vi.fn(makeRecordingDelegate);
    const makeLegacy = vi.fn(makeRecordingDelegate);
    const router = new O11yRoutingExporter({ makeDefault, makeLegacy });

    const result = await exportThrough(router, [
      makeSpan(legacyAttributes({ [LEGACY_O11Y_ENABLED_ATTR]: 'false' })),
      makeSpan({
        [LEGACY_TELEMETRY_SOURCE_ATTR]: LEGACY_TELEMETRY_SOURCE_VALUE,
        [LEGACY_O11Y_ENABLED_ATTR]: 'true',
        'common.extname': 'ext-b'
      })
    ]);

    expect(result.code).toBe(ExportResultCode.SUCCESS);
    expect(makeLegacy).not.toHaveBeenCalled();
    expect(makeDefault).not.toHaveBeenCalled();
  });

  it('drops rest spans when the host configured no endpoint', async () => {
    const makeLegacy = vi.fn(makeRecordingDelegate);
    const router = new O11yRoutingExporter({ makeDefault: undefined, makeLegacy });

    const result = await exportThrough(router, [makeSpan({ command: 'other' })]);

    expect(result.code).toBe(ExportResultCode.SUCCESS);
    expect(makeLegacy).not.toHaveBeenCalled();
  });

  it('skips the default delegate when every span is legacy', async () => {
    const makeDefault = vi.fn(makeRecordingDelegate);
    const router = new O11yRoutingExporter({ makeDefault, makeLegacy: makeRecordingDelegate });

    await exportThrough(router, [makeSpan(legacyAttributes())]);

    expect(makeDefault).not.toHaveBeenCalled();
  });

  it('separates delegates per caller extension on a shared endpoint', async () => {
    const madeLegacy: string[] = [];
    const router = new O11yRoutingExporter({
      makeDefault: makeRecordingDelegate,
      makeLegacy: (_endpoint, _pft, extensionName) => {
        madeLegacy.push(extensionName);
        return makeRecordingDelegate();
      }
    });

    await exportThrough(router, [
      makeSpan(legacyAttributes({ 'common.extname': 'ext-a' })),
      makeSpan(legacyAttributes({ 'common.extname': 'ext-b' }))
    ]);

    expect(madeLegacy).toEqual(['ext-a', 'ext-b']);
  });
});
