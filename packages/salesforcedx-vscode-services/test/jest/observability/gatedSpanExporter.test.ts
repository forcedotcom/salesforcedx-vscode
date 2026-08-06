/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import * as Effect from 'effect/Effect';
import * as Queue from 'effect/Queue';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { getDefaultOrgRef } from '../../../src/core/defaultOrgRef';
import { GatedSpanExporter } from '../../../src/observability/gatedSpanExporter';
import { OrgTelemetryClassification, OrgTelemetryPolicyState } from '../../../src/observability/orgTelemetryPolicy';
import {
  getSpanCreationIdentity,
  getSpanCreationOrgId,
  SpanTransformProcessor
} from '../../../src/observability/spanTransformProcessor';

// GatedSpanExporter is decoupled from telemetry config: the gate is an injected predicate.
const enabled = (): boolean => true;
const disabled = (): boolean => false;

const spans = [{ name: 'span' } as unknown as ReadableSpan];

const makeFakeExporter = (): SpanExporter & { export: jest.Mock; shutdown: jest.Mock } => ({
  export: jest.fn((_spans: ReadableSpan[], cb: (r: ExportResult) => void) => cb({ code: ExportResultCode.SUCCESS })),
  shutdown: jest.fn().mockResolvedValue(undefined)
});

const makePolicy = async (values: Record<string, OrgTelemetryClassification>) => {
  const changes = await Effect.runPromise(Queue.unbounded<OrgTelemetryPolicyState>());
  return {
    getClassification: (orgId: string) => Effect.succeed(values[orgId] ?? 'unknown'),
    changes: Stream.fromQueue(changes),
    resolve: (orgId: string, classification: OrgTelemetryClassification) => {
      values[orgId] = classification;
      return Effect.runPromise(Queue.offer(changes, { orgId, classification }));
    }
  };
};

const stampedSpan = (orgId: string, name: string): ReadableSpan => {
  const span = {
    name,
    attributes: {},
    parentSpanContext: undefined,
    resource: { attributes: {} }
  } as unknown as Parameters<SpanTransformProcessor['onStart']>[0];
  const processor = new SpanTransformProcessor(
    makeFakeExporter(),
    undefined,
    () => false,
    () => ({ orgId })
  );
  processor.onStart(span, {} as Parameters<SpanTransformProcessor['onStart']>[1]);
  return span as unknown as ReadableSpan;
};

const ignoredSpan = (orgId: string, name: string): ReadableSpan => {
  const span = stampedSpan(orgId, name);
  (span.attributes as Record<string, unknown>).telemetryIgnore = true;
  return span;
};

describe('GatedSpanExporter', () => {
  it('disabled: returns SUCCESS and NEVER constructs the delegate (no Statsbeat/network setup)', () => {
    const make = jest.fn(makeFakeExporter);
    const exporter = new GatedSpanExporter(make, disabled);

    const cb = jest.fn();
    exporter.export(spans, cb);

    expect(cb).toHaveBeenCalledWith({ code: ExportResultCode.SUCCESS });
    // the assertion the injected-fake-sender fixture could not make: delegate ctor never runs
    expect(make).not.toHaveBeenCalled();
  });

  it('enabled: constructs the delegate once, caches it, and forwards spans on each export', () => {
    const fake = makeFakeExporter();
    const make = jest.fn(() => fake);
    const exporter = new GatedSpanExporter(make, enabled);

    exporter.export(spans, jest.fn());
    exporter.export(spans, jest.fn());

    expect(make).toHaveBeenCalledTimes(1);
    expect(fake.export).toHaveBeenCalledTimes(2);
    expect(fake.export.mock.calls[0][0]).toBe(spans);
  });

  it('re-checks the gate per export: enabled then disabled stops forwarding without re-construct', () => {
    const fake = makeFakeExporter();
    const make = jest.fn(() => fake);
    let on = true;
    const exporter = new GatedSpanExporter(make, () => on);

    exporter.export(spans, jest.fn());
    on = false;
    const cb = jest.fn();
    exporter.export(spans, cb);

    expect(make).toHaveBeenCalledTimes(1);
    expect(fake.export).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ code: ExportResultCode.SUCCESS });
  });

  it('shutdown before any export resolves without constructing the delegate', async () => {
    const make = jest.fn(makeFakeExporter);
    const exporter = new GatedSpanExporter(make, enabled);

    await expect(exporter.shutdown()).resolves.toBeUndefined();
    expect(make).not.toHaveBeenCalled();
  });

  it('shutdown after an enabled export delegates to the constructed exporter', async () => {
    const fake = makeFakeExporter();
    const exporter = new GatedSpanExporter(() => fake, enabled);

    exporter.export(spans, jest.fn());
    await exporter.shutdown();

    expect(fake.shutdown).toHaveBeenCalledTimes(1);
  });

  it('partitions mixed batches, calls back once, and constructs only for known nonGov spans', async () => {
    const policy = await makePolicy({ allowed: 'nonGov', blocked: 'gov' });
    const fake = makeFakeExporter();
    fake.export.mockImplementation((_spans, delegateCallback) => {
      delegateCallback({ code: ExportResultCode.SUCCESS });
      delegateCallback({ code: ExportResultCode.FAILED });
    });
    const make = jest.fn(() => fake);
    const exporter = new GatedSpanExporter(make, enabled, policy);
    const callback = jest.fn();

    exporter.export(
      [stampedSpan('blocked', 'blocked'), stampedSpan('unknown', 'unknown'), stampedSpan('allowed', 'allowed')],
      callback
    );
    await exporter.forceFlush();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ code: ExportResultCode.SUCCESS });
    expect(make).toHaveBeenCalledTimes(1);
    expect(fake.export.mock.calls.map(call => call[0][0].name)).toEqual(['allowed']);
    await exporter.shutdown();
  });

  it('queues unknown spans with their immutable creation org and releases only nonGov', async () => {
    const policy = await makePolicy({});
    const fake = makeFakeExporter();
    const exporter = new GatedSpanExporter(() => fake, enabled, policy);
    const span = stampedSpan('pending', 'pending');

    exporter.export([span], jest.fn());
    expect(getSpanCreationOrgId(span)).toBe('pending');
    await policy.resolve('pending', 'nonGov');
    await exporter.forceFlush();

    expect(fake.export).toHaveBeenCalledTimes(1);
    await exporter.shutdown();
  });

  it('drops a queued unknown span when telemetry is disabled before it becomes nonGov', async () => {
    const policy = await makePolicy({});
    const fake = makeFakeExporter();
    const make = jest.fn(() => fake);
    const gate = { enabled: true };
    const exporter = new GatedSpanExporter(make, () => gate.enabled, policy);

    exporter.export([stampedSpan('pending', 'pending')], jest.fn());
    gate.enabled = false;
    await policy.resolve('pending', 'nonGov');
    await exporter.forceFlush();

    expect(make).not.toHaveBeenCalled();
    expect(fake.export).not.toHaveBeenCalled();
    await exporter.shutdown();
  });

  it('filters ineligible spans before pending-capacity admission and calls back once', async () => {
    const policy = await makePolicy({});
    const fake = makeFakeExporter();
    const exporter = new GatedSpanExporter(() => fake, enabled, policy);
    const callback = jest.fn();

    exporter.export(
      [
        stampedSpan('valid', 'valid'),
        ...Array.from({ length: 1000 }, (_, index) => ignoredSpan('noise', `noise-${index}`))
      ],
      callback
    );
    await policy.resolve('valid', 'nonGov');
    await exporter.forceFlush();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(fake.export.mock.calls.map(call => call[0][0].name)).toEqual(['valid']);
    await exporter.shutdown();
  });

  it('stamps command and child spans from the private creation identity', () => {
    const identity = { orgId: 'private', devHubOrgId: 'hub', userId: 'user', cliId: 'cli', webUserId: 'web' };
    const span = {
      name: 'child',
      parentSpanContext: { spanId: 'parent' },
      resource: { attributes: {} }
    } as unknown as Parameters<SpanTransformProcessor['onStart']>[0];
    const processor = new SpanTransformProcessor(
      makeFakeExporter(),
      undefined,
      () => false,
      () => identity
    );

    processor.onStart(span, {} as Parameters<SpanTransformProcessor['onStart']>[1]);

    expect(getSpanCreationIdentity(span)).toEqual({
      orgId: 'private',
      devHubOrgId: 'hub',
      userId: 'user',
      cliId: 'cli',
      webUserId: 'web'
    });
  });

  it.each([
    ['new private org with stale public org', 'new', 'old'],
    ['old private org with newer public org', 'old', 'new']
  ])('never mixes identity during %s', (_case, privateOrgId, publicOrgId) => {
    Effect.runSync(
      getDefaultOrgRef().pipe(
        Effect.flatMap(ref =>
          SubscriptionRef.set(ref, {
            orgId: publicOrgId,
            devHubOrgId: `${publicOrgId}-hub`,
            orgEdition: `${publicOrgId}-edition`,
            isScratch: true
          })
        )
      )
    );
    const attributes: Record<string, string> = {};
    const span = {
      name: 'switch',
      parentSpanContext: undefined,
      resource: { attributes: {} },
      setAttribute: (key: string, value: string) => {
        attributes[key] = value;
      }
    } as unknown as Parameters<SpanTransformProcessor['onStart']>[0];
    const processor = new SpanTransformProcessor(makeFakeExporter(), undefined, undefined, () => ({
      orgId: privateOrgId,
      userId: `${privateOrgId}-user`,
      cliId: 'cli',
      webUserId: 'web'
    }));

    processor.onStart(span, {} as Parameters<SpanTransformProcessor['onStart']>[1]);

    expect(getSpanCreationIdentity(span)).toEqual({
      orgId: privateOrgId,
      userId: `${privateOrgId}-user`,
      cliId: 'cli',
      webUserId: 'web'
    });
    expect(attributes).toMatchObject({ orgId: privateOrgId, userId: `${privateOrgId}-user` });
    expect(attributes).not.toHaveProperty('devHubOrgId');
    expect(attributes).not.toHaveProperty('orgEdition');
    expect(attributes).not.toHaveProperty('isScratch');
  });

  it('never constructs delegates for unknown and Gov-only sessions', async () => {
    const policy = await makePolicy({ blocked: 'gov' });
    const make = jest.fn(makeFakeExporter);
    const exporter = new GatedSpanExporter(make, enabled, policy);

    exporter.export([stampedSpan('pending', 'pending'), stampedSpan('blocked', 'blocked')], jest.fn());
    await exporter.forceFlush();
    await exporter.shutdown();

    expect(make).not.toHaveBeenCalled();
  });
});
