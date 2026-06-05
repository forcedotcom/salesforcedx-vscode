/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { ExtensionContext } from 'vscode';
import { getDefaultOrgRef } from '../../../src/core/defaultOrgRef';
import * as cliTelemetryModule from '../../../src/observability/cliTelemetry';
import { seedTelemetryIdentities } from '../../../src/observability/seedTelemetryIdentities';
import * as Schema from 'effect/Schema';
import { CliId } from '../../../src/observability/cliTelemetry';
import { UNAUTHENTICATED_USER } from '../../../src/observability/webUserId';
import { ExtensionContextService } from '../../../src/vscode/extensionContextService';

const PERSISTED_CLI_ID = '11111111-1111-4111-8111-111111111111';
const CLI_FROM_SF = '22222222-2222-4222-8222-222222222222';
const brandedCliId = (value: string) => Schema.decodeSync(CliId)(value);

type GlobalState = Map<string, string>;

const buildContextService = (state: GlobalState) => {
  const update = jest.fn(async (key: string, value: string) => {
    state.set(key, value);
  });
  const get = jest.fn(<T>(key: string): T | undefined => state.get(key) as T | undefined);
  const ctx = { globalState: { get, update } } as unknown as ExtensionContext;
  const service = { getContext: Effect.succeed(ctx) } as unknown as ExtensionContextService;
  return { update, get, layer: Layer.succeed(ExtensionContextService, service) };
};

describe('seedTelemetryIdentities', () => {
  const originalPlatform = process.env.ESBUILD_PLATFORM;

  beforeEach(async () => {
    const ref = await Effect.runPromise(getDefaultOrgRef());
    await Effect.runPromise(SubscriptionRef.set(ref, {}));
  });

  afterEach(() => {
    if (originalPlatform === undefined) delete process.env.ESBUILD_PLATFORM;
    else process.env.ESBUILD_PLATFORM = originalPlatform;
    jest.restoreAllMocks();
  });

  it('uses cliId from globalState when present', async () => {
    delete process.env.ESBUILD_PLATFORM;
    const state: GlobalState = new Map([['telemetryUserId', PERSISTED_CLI_ID]]);
    const { update, layer } = buildContextService(state);

    await Effect.runPromise(seedTelemetryIdentities().pipe(Effect.provide(layer)));

    const ref = await Effect.runPromise(getDefaultOrgRef());
    const info = await Effect.runPromise(SubscriptionRef.get(ref));
    expect(info.cliId).toBe(PERSISTED_CLI_ID);
    expect(info.webUserId).toBe(UNAUTHENTICATED_USER);
    expect(update).toHaveBeenCalledWith('telemetryWebUserId', UNAUTHENTICATED_USER);
  });

  it('desktop falls back to getCliId when globalState empty', async () => {
    delete process.env.ESBUILD_PLATFORM;
    jest.spyOn(cliTelemetryModule, 'getCliId').mockReturnValue(Effect.succeed(Option.some(brandedCliId(CLI_FROM_SF))));
    const state: GlobalState = new Map();
    const { update, layer } = buildContextService(state);

    await Effect.runPromise(seedTelemetryIdentities().pipe(Effect.provide(layer)));

    expect(update).toHaveBeenCalledWith('telemetryUserId', CLI_FROM_SF);
  });

  it('desktop generates UUID when getCliId returns None', async () => {
    delete process.env.ESBUILD_PLATFORM;
    jest.spyOn(cliTelemetryModule, 'getCliId').mockReturnValue(Effect.succeed(Option.none()));
    const state: GlobalState = new Map();
    const { update, layer } = buildContextService(state);

    await Effect.runPromise(seedTelemetryIdentities().pipe(Effect.provide(layer)));

    const persistedCliId = state.get('telemetryUserId');
    expect(persistedCliId).toMatch(/^[0-9a-f-]{36}$/);
    expect(update).toHaveBeenCalledWith('telemetryUserId', persistedCliId);
  });

  it('web generates UUID without invoking sf telemetry', async () => {
    process.env.ESBUILD_PLATFORM = 'web';
    const cliSpy = jest.spyOn(cliTelemetryModule, 'getCliId');
    const state: GlobalState = new Map();
    const { layer } = buildContextService(state);

    await Effect.runPromise(seedTelemetryIdentities().pipe(Effect.provide(layer)));

    expect(cliSpy).not.toHaveBeenCalled();
    const persistedCliId = state.get('telemetryUserId');
    expect(persistedCliId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('preserves existing webUserId when already present', async () => {
    delete process.env.ESBUILD_PLATFORM;
    jest.spyOn(cliTelemetryModule, 'getCliId').mockReturnValue(Effect.succeed(Option.some(brandedCliId(CLI_FROM_SF))));
    const state: GlobalState = new Map([['telemetryWebUserId', 'sha256-existing']]);
    const { update, layer } = buildContextService(state);

    await Effect.runPromise(seedTelemetryIdentities().pipe(Effect.provide(layer)));

    expect(update).not.toHaveBeenCalledWith('telemetryWebUserId', expect.anything());
    const ref = await Effect.runPromise(getDefaultOrgRef());
    const info = await Effect.runPromise(SubscriptionRef.get(ref));
    expect(info.webUserId).toBe('sha256-existing');
  });
});
