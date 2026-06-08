/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getSdkLayerConfigFromContext } from '../../../src/observability/sdkLayerConfig';
import type { ExtensionContext } from 'vscode';

const makeContext = (packageJSON: Record<string, unknown>): ExtensionContext =>
  ({ extension: { packageJSON } }) as unknown as ExtensionContext;

describe('getSdkLayerConfigFromContext — connectionString resolution', () => {
  it('uses otelConnectionString as-is when present', () => {
    const full = 'InstrumentationKey=abc;IngestionEndpoint=https://east.in.applicationinsights.azure.com/';
    const config = getSdkLayerConfigFromContext(
      makeContext({ name: 'ext', version: '1.0.0', otelConnectionString: full })
    );
    expect(config.connectionString).toBe(full);
  });

  it('prefers otelConnectionString over aiKey when both present', () => {
    const full = 'InstrumentationKey=abc;IngestionEndpoint=https://east.in.applicationinsights.azure.com/';
    const config = getSdkLayerConfigFromContext(
      makeContext({
        name: 'ext',
        version: '1.0.0',
        otelConnectionString: full,
        aiKey: 'ec3632a4-df47-47a4-98dc-8134cacbaf7e'
      })
    );
    expect(config.connectionString).toBe(full);
  });

  it('normalizes bare UUID aiKey to InstrumentationKey= format', () => {
    const config = getSdkLayerConfigFromContext(
      makeContext({ name: 'ext', version: '1.0.0', aiKey: 'ec3632a4-df47-47a4-98dc-8134cacbaf7e' })
    );
    expect(config.connectionString).toBe('InstrumentationKey=ec3632a4-df47-47a4-98dc-8134cacbaf7e');
  });

  it('passes through full connection string aiKey unchanged', () => {
    const full =
      'InstrumentationKey=ec3632a4-df47-47a4-98dc-8134cacbaf7e;IngestionEndpoint=https://east.in.applicationinsights.azure.com/';
    const config = getSdkLayerConfigFromContext(makeContext({ name: 'ext', version: '1.0.0', aiKey: full }));
    expect(config.connectionString).toBe(full);
  });

  it('returns undefined when neither otelConnectionString nor aiKey are present', () => {
    const config = getSdkLayerConfigFromContext(makeContext({ name: 'ext', version: '1.0.0' }));
    expect(config.connectionString).toBeUndefined();
  });
});
