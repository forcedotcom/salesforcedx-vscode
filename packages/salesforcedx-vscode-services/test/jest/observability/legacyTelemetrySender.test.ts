/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Tracer as OtelTracer } from '@effect/opentelemetry';
import { trace } from '@opentelemetry/api';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { window, type ExtensionContext } from 'vscode';
import { getDefaultOrgRef } from '../../../src/core/defaultOrgRef';
import * as cliTelemetryModule from '../../../src/observability/cliTelemetry';
import { CliId } from '../../../src/observability/cliTelemetry';
import { getSpanCreationIdentity, setSpanCreationIdentity } from '../../../src/observability/spanTransformProcessor';
import {
  buildLegacySpanAttributes,
  createLegacyTelemetrySpan,
  getLegacyTelemetrySender,
  prepareLegacyTelemetrySender,
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
  cliId: 'cli-id',
  webUserId: 'web-id',
  orgId: '00Dxx0000000000',
  devHubId: '00Dhub0000000000',
  orgEdition: 'Developer Edition',
  telemetryClassification: 'nonGov' as const
};

const captureOtelSpan = () => {
  const attributes = new Map<string, string | number>();
  const span = {
    setAttribute: jest.fn((key: string, value: string | number) => attributes.set(key, value))
  };
  jest.replaceProperty(OtelTracer, 'currentOtelSpan', Effect.succeed(span as never));
  return { span, attributes };
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

describe('legacy telemetry senders', () => {
  const originalPlatform = process.env.ESBUILD_PLATFORM;

  beforeEach(async () => {
    process.env.ESBUILD_PLATFORM = 'web';
    const ref = await Effect.runPromise(getDefaultOrgRef());
    await Effect.runPromise(SubscriptionRef.set(ref, {}));
  });

  afterEach(() => {
    if (originalPlatform === undefined) delete process.env.ESBUILD_PLATFORM;
    else process.env.ESBUILD_PLATFORM = originalPlatform;
    jest.restoreAllMocks();
  });

  const contextFor = (name = 'test-ext') =>
    ({
      extension: { packageJSON: { name, version: '1.0.0' } },
      extensionMode: 1
    }) as unknown as ExtensionContext;

  it('does not use the process-global OTel tracer API', async () => {
    const getTracer = jest.spyOn(trace, 'getTracer');
    await getLegacyTelemetrySender(contextFor())({ kind: 'event', name: 'e', identity: baseIdentity });

    expect(getTracer).not.toHaveBeenCalled();
  });

  it('keeps the org identity captured before deferred execution', async () => {
    const { span, attributes } = captureOtelSpan();
    const ref = await Effect.runPromise(getDefaultOrgRef());
    await Effect.runPromise(
      SubscriptionRef.set(ref, {
        cliId: baseIdentity.cliId as never,
        webUserId: baseIdentity.webUserId,
        orgId: baseIdentity.orgId as never,
        devHubOrgId: baseIdentity.devHubId as never,
        isScratch: true,
        orgEdition: baseIdentity.orgEdition,
        instanceName: 'usa9102'
      })
    );

    const sender = await prepareLegacyTelemetrySender(contextFor());
    const deferredSend = sender({ kind: 'event', name: 'e' });
    await Effect.runPromise(
      SubscriptionRef.set(ref, {
        cliId: 'later-cli' as never,
        webUserId: 'later-web',
        orgId: 'later-org' as never,
        instanceName: 'stg9402s'
      })
    );
    await deferredSend();

    expect(attributes.get('orgId')).toBe(baseIdentity.orgId);
    expect(attributes.get('cliId')).toBe(baseIdentity.cliId);
    expect(attributes.get('webUserId')).toBe(baseIdentity.webUserId);
    expect(attributes.get('orgShape')).toBe('Scratch');
    expect(getSpanCreationIdentity(span as never).telemetryClassification).toBe('nonGov');
  });

  it('warns in the caller channel when the CLI telemetry command returns no ID', async () => {
    delete process.env.ESBUILD_PLATFORM;
    jest.spyOn(cliTelemetryModule, 'getCliId').mockReturnValue(Effect.succeed(Option.none()));
    const appendLine = jest.fn();
    jest.spyOn(window, 'createOutputChannel').mockReturnValue({ appendLine } as never);

    await prepareLegacyTelemetrySender(contextFor('no-cli-seed-ext'));

    expect(appendLine).toHaveBeenCalledWith('telemetry seed missing — degraded session');
  });

  it('does not warn when the CLI telemetry command provides an ID', async () => {
    delete process.env.ESBUILD_PLATFORM;
    const cliId = Schema.decodeSync(CliId)('22222222-2222-4222-8222-222222222222');
    jest.spyOn(cliTelemetryModule, 'getCliId').mockReturnValue(Effect.succeed(Option.some(cliId)));
    const createOutputChannel = jest.spyOn(window, 'createOutputChannel');

    await prepareLegacyTelemetrySender(contextFor('has-cli-seed-ext'));

    expect(createOutputChannel).not.toHaveBeenCalled();
  });
});
