/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Tracer as OtelTracer } from '@effect/opentelemetry';
import { trace } from '@opentelemetry/api';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { ExtensionContext } from 'vscode';
import { CliId } from '../../../src/observability/cliTelemetry';
import { OrgId } from '../../../src/core/schemas/salesforceId';
import { getDefaultOrgRef } from '../../../src/core/defaultOrgRef';
import { getSpanCreationIdentity, setSpanCreationIdentity } from '../../../src/observability/spanTransformProcessor';
import {
  buildLegacySpanAttributes,
  createLegacyTelemetrySpan,
  getLegacyCallerFalcon,
  getLegacyTelemetrySender,
  LEGACY_DEFAULT_AI_CONNECTION_STRING,
  LEGACY_O11Y_ENABLED_ATTR,
  LEGACY_O11Y_ENDPOINT_ATTR,
  LEGACY_PRODUCT_FEATURE_ID_ATTR,
  LEGACY_TELEMETRY_SOURCE_ATTR,
  LEGACY_TELEMETRY_SOURCE_VALUE,
  legacySpanName,
  resolveLegacyConnectionString
} from '../../../src/observability/legacyTelemetrySender';

jest.mock('../../../src/observability/redactingConsoleLogger', () => ({
  runOnServicesRuntime: (effect: unknown) => effect
}));

const baseIdentity = {
  cliId: 'cli-id' as CliId,
  webUserId: 'web-id',
  orgId: '00Dxx0000000000' as OrgId,
  devHubId: '00Dhub0000000000' as OrgId,
  orgEdition: 'Developer Edition',
  orgShape: 'Production' as const,
  telemetryClassification: 'nonGov' as const
};

describe('resolveLegacyConnectionString', () => {
  it('uses ec3632 key when no aiKey and no otelConnectionString', () => {
    expect(resolveLegacyConnectionString({})).toBe(LEGACY_DEFAULT_AI_CONNECTION_STRING);
    expect(resolveLegacyConnectionString(undefined)).toBe(LEGACY_DEFAULT_AI_CONNECTION_STRING);
    expect(LEGACY_DEFAULT_AI_CONNECTION_STRING).toBe('InstrumentationKey=ec3632a4-df47-47a4-98dc-8134cacbaf7e');
  });

  it('uses caller aiKey when present', () => {
    expect(resolveLegacyConnectionString({ aiKey: 'ec3632a4-df47-47a4-98dc-8134cacbaf7e' })).toBe(
      'InstrumentationKey=ec3632a4-df47-47a4-98dc-8134cacbaf7e'
    );
  });

  it('prefers otelConnectionString over aiKey', () => {
    const full = 'InstrumentationKey=abc;IngestionEndpoint=https://east.in.applicationinsights.azure.com/';
    expect(resolveLegacyConnectionString({ otelConnectionString: full, aiKey: 'other' })).toBe(full);
  });
});

describe('legacySpanName', () => {
  it('names spans extensionId/eventName', () => {
    expect(legacySpanName('my-ext', 'activationEvent')).toBe('my-ext/activationEvent');
  });
});

describe('buildLegacySpanAttributes', () => {
  it('marks spans with the legacy telemetry source', () => {
    const attributes = buildLegacySpanAttributes({ kind: 'event', name: 'e', identity: baseIdentity });
    expect(attributes[LEGACY_TELEMETRY_SOURCE_ATTR]).toBe(LEGACY_TELEMETRY_SOURCE_VALUE);
  });

  it('commandExecution carries attribute command equal to properties.commandName', () => {
    const attributes = buildLegacySpanAttributes({
      kind: 'event',
      name: 'commandExecution',
      properties: { extensionName: 'my-ext', commandName: 'myCommand' },
      identity: baseIdentity
    });
    expect(attributes.command).toBe('myCommand');
  });

  it('carries org identity for span properties', () => {
    const attributes = buildLegacySpanAttributes({ kind: 'event', name: 'e', identity: baseIdentity });
    expect(attributes).toMatchObject({
      orgId: '00Dxx0000000000',
      devHubOrgId: '00Dhub0000000000',
      cliId: 'cli-id',
      webUserId: 'web-id'
    });
  });
});

describe('setSpanCreationIdentity', () => {
  it('stamps gov identity for GatedSpanExporter', () => {
    const span = {};
    setSpanCreationIdentity(span, { telemetryClassification: 'gov' });
    expect(getSpanCreationIdentity(span as never).telemetryClassification).toBe('gov');
  });
});

const captureOtelSpan = () => {
  const attributes = new Map<string, string | number>();
  const span = {
    setAttribute: jest.fn((key: string, value: string | number) => attributes.set(key, value))
  };
  jest.replaceProperty(OtelTracer, 'currentOtelSpan', Effect.succeed(span as never));
  return { span, attributes };
};

describe('createLegacyTelemetrySpan', () => {
  const senderConfig = {
    extensionName: 'test-ext',
    extensionVersion: '1.0.0',
    callerO11y: { enabled: false }
  };

  afterEach(() => jest.restoreAllMocks());

  it('stamps send-time identity on the current Effect span', async () => {
    const { span, attributes } = captureOtelSpan();
    await Effect.runPromise(
      createLegacyTelemetrySpan(senderConfig, {
        kind: 'event',
        name: 'commandExecution',
        properties: { extensionName: 'test-ext', commandName: 'myCommand' },
        identity: baseIdentity
      })
    );

    expect(attributes.get('command')).toBe('myCommand');
    expect(attributes.get(LEGACY_TELEMETRY_SOURCE_ATTR)).toBe(LEGACY_TELEMETRY_SOURCE_VALUE);
    expect(attributes.get('common.extname')).toBe('test-ext');
    expect(getSpanCreationIdentity(span as never).telemetryClassification).toBe('nonGov');
  });

  it('keeps exception name and message on the error span without rejecting the sender', async () => {
    const { attributes } = captureOtelSpan();
    await Effect.runPromise(
      createLegacyTelemetrySpan(senderConfig, {
        kind: 'exception',
        name: 'myError',
        message: 'boom',
        identity: baseIdentity
      })
    );
    expect(attributes.get('exceptionName')).toBe('myError');
    expect(attributes.get('exceptionMessage')).toBe('boom');
  });

  it('stamps the caller O11y config for the router when enabled', async () => {
    const { attributes } = captureOtelSpan();
    await Effect.runPromise(
      createLegacyTelemetrySpan(
        {
          ...senderConfig,
          callerO11y: {
            endpoint: 'https://caller.test/metrics',
            enabled: true,
            productFeatureId: 'aJC123'
          }
        },
        { kind: 'event', name: 'e', identity: baseIdentity }
      )
    );
    expect(attributes.get(LEGACY_O11Y_ENABLED_ATTR)).toBe('true');
    expect(attributes.get(LEGACY_O11Y_ENDPOINT_ATTR)).toBe('https://caller.test/metrics');
    expect(attributes.get(LEGACY_PRODUCT_FEATURE_ID_ATTR)).toBe('aJC123');
  });

  it('stamps O11y disabled when the caller never opted in', async () => {
    const { attributes } = captureOtelSpan();
    await Effect.runPromise(
      createLegacyTelemetrySpan(senderConfig, { kind: 'event', name: 'e', identity: baseIdentity })
    );
    expect(attributes.get(LEGACY_O11Y_ENABLED_ATTR)).toBe('false');
    expect(attributes.get(LEGACY_O11Y_ENDPOINT_ATTR)).toBeUndefined();
  });
});

describe('getLegacyTelemetrySender', () => {
  afterEach(() => jest.restoreAllMocks());

  it('snapshots DefaultOrgInfo before deferred send executes', async () => {
    const context = {
      extension: { packageJSON: { name: 'test-ext', version: '1.0.0' } },
      extensionMode: 1
    } as unknown as ExtensionContext;
    const ref = await Effect.runPromise(getDefaultOrgRef());
    await Effect.runPromise(
      SubscriptionRef.set(ref, {
        cliId: 'first-cli' as CliId,
        webUserId: 'first-web',
        orgId: '00Dxx0000000000' as OrgId,
        isSandbox: true
      })
    );
    const send = getLegacyTelemetrySender(context)({ kind: 'event', name: 'e' });
    await Effect.runPromise(
      SubscriptionRef.set(ref, {
        cliId: 'later-cli' as CliId,
        webUserId: 'later-web',
        orgId: '00Dxx0000000000' as OrgId,
        isScratch: true
      })
    );
    const { attributes } = captureOtelSpan();

    try {
      await send();

      expect(attributes.get('cliId')).toBe('first-cli');
      expect(attributes.get('userId')).toBe('first-cli');
      expect(attributes.get('webUserId')).toBe('first-web');
      expect(attributes.get('orgShape')).toBe('Sandbox');
    } finally {
      await Effect.runPromise(SubscriptionRef.set(ref, {}));
    }
  });

  it('does not use the process-global OTel tracer API', async () => {
    const getTracer = jest.spyOn(trace, 'getTracer');
    const context = {
      extension: { packageJSON: { name: 'test-ext', version: '1.0.0' } },
      extensionMode: 1
    } as unknown as ExtensionContext;

    await getLegacyTelemetrySender(context)({ kind: 'event', name: 'e' });

    expect(getTracer).not.toHaveBeenCalled();
  });

  it('registers caller falcon opt-in in memory without stamping it on span attributes', async () => {
    const context = {
      extension: {
        packageJSON: { name: 'falcon-ext', version: '1.0.0', falconApiKey: 'test-key', falconEnvironment: 'dev' }
      },
      extensionMode: 1
    } as unknown as ExtensionContext;
    const { attributes } = captureOtelSpan();

    await getLegacyTelemetrySender(context)({ kind: 'event', name: 'e' })();

    expect(getLegacyCallerFalcon('falcon-ext')).toEqual({ apiKey: 'test-key', environment: 'dev' });
    expect([...attributes.values()].map(String)).not.toContain('test-key');
  });

  it('does not register falcon when the caller has no falconApiKey', () => {
    const context = {
      extension: { packageJSON: { name: 'plain-ext', version: '1.0.0' } },
      extensionMode: 1
    } as unknown as ExtensionContext;

    getLegacyTelemetrySender(context);

    expect(getLegacyCallerFalcon('plain-ext')).toBeUndefined();
  });

  it('inherits the host falcon opt-in when the caller has none of its own', () => {
    const hostFalcon = { apiKey: 'host-key', environment: 'prod' as const };
    const context = {
      extension: { packageJSON: { name: 'inheriting-ext', version: '1.0.0' } },
      extensionMode: 1
    } as unknown as ExtensionContext;

    getLegacyTelemetrySender(context);

    expect(getLegacyCallerFalcon('inheriting-ext', hostFalcon)).toEqual(hostFalcon);
  });

  it("prefers the caller's own falcon opt-in over the host's", async () => {
    const context = {
      extension: {
        packageJSON: { name: 'own-falcon-ext', version: '1.0.0', falconApiKey: 'caller-key', falconEnvironment: 'dev' }
      },
      extensionMode: 1
    } as unknown as ExtensionContext;

    await getLegacyTelemetrySender(context)({ kind: 'event', name: 'e' })();

    expect(getLegacyCallerFalcon('own-falcon-ext', { apiKey: 'host-key', environment: 'prod' })).toEqual({
      apiKey: 'caller-key',
      environment: 'dev'
    });
  });
});
