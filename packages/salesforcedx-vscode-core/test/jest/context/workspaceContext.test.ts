/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService, closeExtensionScope } from '@salesforce/effect-ext-utils';
import { refreshAllExtensionReporters } from '@salesforce/salesforcedx-utils-vscode';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { DefaultOrgInfoSchema } from 'salesforcedx-vscode-services';
import { WorkspaceContext } from '../../../src/context';

jest.mock('@salesforce/salesforcedx-utils-vscode', () => ({
  ...jest.requireActual('@salesforce/salesforcedx-utils-vscode'),
  refreshAllExtensionReporters: jest.fn().mockResolvedValue(undefined)
}));

const targetOrgRef = Effect.runSync(SubscriptionRef.make({}));
let getTargetOrgRef = () => Effect.succeed(targetOrgRef);
const connection = { getAuthInfoFields: () => ({ orgId: '00D' }) };
const servicesApi = {
  services: {
    ConnectionService: { getConnection: () => Effect.succeed(connection) },
    TargetOrgRef: () => getTargetOrgRef()
  }
};
const providerLayer = Layer.succeed(ExtensionProviderService, {
  getServicesApi: Effect.succeed(servicesApi)
} as never);
const runPromise = <A, E, R>(effect: Effect.Effect<A, E, R>, options?: { signal?: AbortSignal }): Promise<A> =>
  Effect.runPromise(effect.pipe(Effect.provide(providerLayer as Layer.Layer<R>)), options);
const runCallback = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  options?: Parameters<typeof Effect.runCallback<A, E>>[1]
) => effect.pipe(Effect.provide(providerLayer as Layer.Layer<R>), provided => Effect.runCallback(provided, options));

jest.mock('../../../src/services/runtime', () => ({
  getRuntime: () => ({ runPromise, runCallback })
}));

const coreContext = {
  extension: { id: 'salesforce.salesforcedx-vscode-core' },
  subscriptions: []
};
const replayContext = {
  extension: { id: 'salesforce.salesforcedx-vscode-apex-replay-debugger' },
  subscriptions: []
};

const flushEffects = () => new Promise(resolve => setImmediate(resolve));

const setTargetOrg = (identity: typeof DefaultOrgInfoSchema.Type) =>
  Effect.runPromise(SubscriptionRef.set(targetOrgRef, identity));

describe('WorkspaceContext', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    coreContext.subscriptions.length = 0;
    replayContext.subscriptions.length = 0;
    getTargetOrgRef = () => Effect.succeed(targetOrgRef);
    await runPromise(closeExtensionScope());
    WorkspaceContext.getInstance(true);
    await flushEffects();
    jest.clearAllMocks();
    await setTargetOrg({});
  });

  afterEach(async () => {
    await runPromise(closeExtensionScope());
  });

  it('seeds synchronous getters from the initial snapshot without firing an event', async () => {
    await setTargetOrg({ username: 'initial@example.com', alias: 'initial', orgId: '00Dinitial' });
    const context = WorkspaceContext.getInstance(true);
    const listener = jest.fn();
    context.onOrgChange(listener);

    await context.initialize(coreContext as never);

    expect({ username: context.username, alias: context.alias, orgId: context.orgId }).toEqual({
      username: 'initial@example.com',
      alias: 'initial',
      orgId: '00Dinitial'
    });
    expect(listener).not.toHaveBeenCalled();
    expect(refreshAllExtensionReporters).not.toHaveBeenCalled();
  });

  it('fires once per distinct identity after updating getters and refreshes telemetry', async () => {
    const context = WorkspaceContext.getInstance(true);
    const observedGetters: object[] = [];
    context.onOrgChange(() =>
      observedGetters.push({ username: context.username, alias: context.alias, orgId: context.orgId })
    );
    await context.initialize(coreContext as never);
    await flushEffects();

    const switched = { username: 'switched@example.com', alias: 'configured', orgId: '00Dswitched' };
    await setTargetOrg(switched);
    await setTargetOrg({ ...switched });
    await flushEffects();

    expect(observedGetters).toEqual([switched]);
    expect(refreshAllExtensionReporters).toHaveBeenCalledWith(coreContext);
  });

  it('fires when orgId changes and suppresses an exact duplicate snapshot', async () => {
    await setTargetOrg({ username: 'initial@example.com', alias: 'initial' });
    const context = WorkspaceContext.getInstance(true);
    const listener = jest.fn();
    context.onOrgChange(listener);
    await context.initialize(coreContext as never);

    await setTargetOrg({ username: 'initial@example.com', alias: 'initial', orgId: '00Dinitial' });
    await setTargetOrg({ username: 'initial@example.com', alias: 'initial', orgId: '00Dinitial' });
    await flushEffects();

    expect(context.orgId).toBe('00Dinitial');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(refreshAllExtensionReporters).toHaveBeenCalledTimes(1);
  });

  it('normalizes no-org values to undefined', async () => {
    await setTargetOrg({ username: 'before@example.com', alias: 'before', orgId: '00Dbefore' });
    const context = WorkspaceContext.getInstance(true);
    await context.initialize(replayContext as never);
    await flushEffects();

    const changed = new Promise<void>(resolve => context.onOrgChange(() => resolve()));
    await setTargetOrg({});
    await changed;

    expect({ username: context.username, alias: context.alias, orgId: context.orgId }).toEqual({
      username: undefined,
      alias: undefined,
      orgId: undefined
    });
    expect(refreshAllExtensionReporters).not.toHaveBeenCalled();
  });

  it('initializes once and keeps connection delegation unchanged', async () => {
    const context = WorkspaceContext.getInstance(true);

    await Promise.all([
      context.initialize(coreContext as never),
      context.initialize(coreContext as never),
      context.initialize(coreContext as never)
    ]);

    expect(await context.getConnection()).toBe(connection);
    expect(coreContext.subscriptions).toHaveLength(1);
  });

  it('disposes the replaced singleton watcher and isolates identity across instances', async () => {
    await setTargetOrg({ username: 'first@example.com', alias: 'first', orgId: '00Dfirst' });
    const first = WorkspaceContext.getInstance(true);
    const firstListener = jest.fn();
    first.onOrgChange(firstListener);
    await first.initialize(coreContext as never);

    const replacement = WorkspaceContext.getInstance(true);
    expect({ username: replacement.username, alias: replacement.alias, orgId: replacement.orgId }).toEqual({
      username: undefined,
      alias: undefined,
      orgId: undefined
    });
    const replacementListener = jest.fn();
    replacement.onOrgChange(replacementListener);
    await replacement.initialize(coreContext as never);
    jest.clearAllMocks();

    const switched = { username: 'second@example.com', alias: 'second', orgId: '00Dsecond' };
    await setTargetOrg(switched);
    await flushEffects();

    expect(firstListener).not.toHaveBeenCalled();
    expect(replacementListener).toHaveBeenCalledTimes(1);
    expect(refreshAllExtensionReporters).toHaveBeenCalledTimes(1);
    expect({ username: first.username, alias: first.alias, orgId: first.orgId }).toEqual({
      username: 'first@example.com',
      alias: 'first',
      orgId: '00Dfirst'
    });
    expect({ username: replacement.username, alias: replacement.alias, orgId: replacement.orgId }).toEqual(switched);

    first.orgShape = 'Sandbox';
    first.devHubId = '00Dstale';
    first.orgEdition = 'Enterprise';
    expect({ orgShape: replacement.orgShape, devHubId: replacement.devHubId, orgEdition: replacement.orgEdition }).toEqual({
      orgShape: 'Production',
      devHubId: undefined,
      orgEdition: undefined
    });
  });

  it('interrupts initialization when the singleton is replaced before the initial snapshot', async () => {
    const releaseTargetOrgRef = Effect.runSync(Deferred.make<void>());
    getTargetOrgRef = () => Deferred.await(releaseTargetOrgRef).pipe(Effect.as(targetOrgRef));
    const first = WorkspaceContext.getInstance(true);
    const firstListener = jest.fn();
    first.onOrgChange(firstListener);
    const initialization = first.initialize(coreContext as never);
    WorkspaceContext.getInstance(true);

    await expect(initialization).rejects.toThrow();
    Effect.runSync(Deferred.succeed(releaseTargetOrgRef, undefined));
    await setTargetOrg({ username: 'stale@example.com', alias: 'stale', orgId: '00Dstale' });
    await flushEffects();

    expect(firstListener).not.toHaveBeenCalled();
    expect(refreshAllExtensionReporters).not.toHaveBeenCalled();
  });

  it('stops watching when VS Code disposes the extension subscriptions', async () => {
    const context = WorkspaceContext.getInstance(true);
    const listener = jest.fn();
    context.onOrgChange(listener);
    await context.initialize(coreContext as never);

    coreContext.subscriptions.forEach(subscription => (subscription as { dispose: () => void }).dispose());
    await setTargetOrg({ username: 'after-disposal@example.com', orgId: '00Ddisposed' });
    await flushEffects();

    expect(listener).not.toHaveBeenCalled();
    expect(refreshAllExtensionReporters).not.toHaveBeenCalled();
  });

  it('retries initialization after a transient startup failure', async () => {
    getTargetOrgRef = jest
      .fn()
      .mockReturnValueOnce(Effect.fail(new Error('TargetOrgRef unavailable')))
      .mockReturnValue(Effect.succeed(targetOrgRef));
    const context = WorkspaceContext.getInstance(true);

    await expect(context.initialize(coreContext as never)).rejects.toThrow('TargetOrgRef unavailable');
    await context.initialize(coreContext as never);

    expect(context.username).toBeUndefined();
    expect(getTargetOrgRef).toHaveBeenCalledTimes(2);
  });

  it('preserves legacy org metadata accessors', async () => {
    await setTargetOrg({
      username: 'scratch@example.com',
      alias: 'scratch',
      isScratch: true,
      devHubOrgId: '00Ddevhub',
      orgEdition: 'Developer'
    });
    const context = WorkspaceContext.getInstance(true);
    await context.initialize(coreContext as never);

    expect({ orgShape: context.orgShape, devHubId: context.devHubId, orgEdition: context.orgEdition }).toEqual({
      orgShape: 'Scratch',
      devHubId: '00Ddevhub',
      orgEdition: 'Developer'
    });

    context.orgShape = 'Sandbox';
    context.devHubId = '00Dother';
    context.orgEdition = 'Enterprise';
    expect({ orgShape: context.orgShape, devHubId: context.devHubId, orgEdition: context.orgEdition }).toEqual({
      orgShape: 'Sandbox',
      devHubId: '00Dother',
      orgEdition: 'Enterprise'
    });
  });
});
