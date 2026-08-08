/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DEFAULT_AI_CONNECTION_STRING } from '../../../src/observability/appInsights';
import {
  getSdkLayerConfigFromContext,
  getSdkLayerConfigFromPackageJSON
} from '../../../src/observability/sdkLayerConfig';
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

  it('falls back to DEFAULT_AI_CONNECTION_STRING when neither otelConnectionString nor aiKey are present', () => {
    const config = getSdkLayerConfigFromContext(makeContext({ name: 'ext', version: '1.0.0' }));
    expect(config.connectionString).toBe(DEFAULT_AI_CONNECTION_STRING);
  });
});

describe('local ingestion endpoint', () => {
  const original = process.env.SF_OTEL_INGESTION_ENDPOINT;

  afterEach(() => {
    process.env.SF_OTEL_INGESTION_ENDPOINT = original;
  });

  it('does not enable an environment override in production', () => {
    process.env.SF_OTEL_INGESTION_ENDPOINT = 'http://localhost:4000';
    expect(
      getSdkLayerConfigFromContext(makeContext({ name: 'ext', version: '1.0.0' })).localIngestionEndpoint
    ).toBeUndefined();
  });
});

describe('O11Y_ENDPOINT override', () => {
  const original = process.env.O11Y_ENDPOINT;
  const packageJSON = { name: 'ext', version: '1.0.0', o11yUploadEndpoint: 'https://configured.example/o11y' };

  afterEach(() => {
    if (original === undefined) delete process.env.O11Y_ENDPOINT;
    else process.env.O11Y_ENDPOINT = original;
  });

  it.each(['http://localhost:3002', 'https://127.0.0.1:4318', 'http://[::1]:3002'])(
    'preserves local development endpoint %s',
    endpoint => {
      process.env.O11Y_ENDPOINT = endpoint;
      expect(getSdkLayerConfigFromPackageJSON(packageJSON, true).o11yEndpoint).toBe(endpoint);
    }
  );

  it.each(['https://remote.example/o11y', 'file:///tmp/o11y', 'not a url'])(
    'rejects non-loopback override %s',
    endpoint => {
      process.env.O11Y_ENDPOINT = endpoint;
      expect(getSdkLayerConfigFromPackageJSON(packageJSON, true).o11yEndpoint).toBe(packageJSON.o11yUploadEndpoint);
    }
  );

  it('does not apply a loopback override in production', () => {
    process.env.O11Y_ENDPOINT = 'http://localhost:3002';
    expect(getSdkLayerConfigFromPackageJSON(packageJSON).o11yEndpoint).toBe(packageJSON.o11yUploadEndpoint);
  });
});
