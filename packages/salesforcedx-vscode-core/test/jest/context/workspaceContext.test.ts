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
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { DefaultOrgInfoSchema } from 'salesforcedx-vscode-services';
import { ConnectionService } from 'salesforcedx-vscode-services/src/core/connectionService';
import { ExtensionContextService } from 'salesforcedx-vscode-services/src/vscode/extensionContextService';
import { WorkspaceContext } from '../../../src/context/workspaceContext';
import { WorkspaceContextService } from '../../../src/context/workspaceContextService';

jest.mock('@salesforce/salesforcedx-utils-vscode', () => ({
  ...jest.requireActual('@salesforce/salesforcedx-utils-vscode'),
  refreshAllExtensionReporters: jest.fn().mockResolvedValue(undefined)
}));

const targetOrgRef = Effect.runSync(SubscriptionRef.make<typeof DefaultOrgInfoSchema.Type>({}));
let getTargetOrgRef = () => Effect.succeed(targetOrgRef);
const connection = { getAuthInfoFields: () => ({ orgId: '00D' }) };
const connectDefaultOrg = () =>
  SubscriptionRef.update(targetOrgRef, current => ({
    ...current,
    username: current.username ?? 'default@example.com',
    orgId: current.orgId ?? '00D'
  })).pipe(Effect.as(connection));
let getConnection: () => Effect.Effect<typeof connection> = connectDefaultOrg;
const servicesApi = {
  services: {
    ConnectionService: { getConnection: () => getConnection() },
    TargetOrgRef: () => getTargetOrgRef(),
    ExtensionContextService
  }
};
const coreContext = {
  extension: { id: 'salesforce.salesforcedx-vscode-core' },
  subscriptions: []
};
const replayContext = {
  extension: { id: 'salesforce.salesforcedx-vscode-apex-replay-debugger' },
  subscriptions: []
};
const providerLayer = Layer.succeed(ExtensionProviderService, {
  getServicesApi: Effect.succeed(servicesApi)
} as never);
const extensionContextLayer = Layer.succeed(
  ExtensionContextService,
  new ExtensionContextService({
    getContext: Effect.succeed(coreContext as never),
    getDisplayName: Effect.succeed('Salesforce CLI')
  })
);
const connectionServiceLayer = Layer.succeed(ConnectionService, servicesApi.services.ConnectionService as never);
const dependencies = Layer.mergeAll(providerLayer, extensionContextLayer, connectionServiceLayer);
const createRuntime = () =>
  ManagedRuntime.make(Layer.merge(dependencies, Layer.provide(WorkspaceContextService.Default, dependencies)));
let runtime = createRuntime();

jest.mock('../../../src/services/runtime', () => ({ getRuntime: () => runtime }));

const flushEffects = () => new Promise(resolve => setImmediate(resolve));

const setTargetOrg = (identity: typeof DefaultOrgInfoSchema.Type) =>
  Effect.runPromise(SubscriptionRef.set(targetOrgRef, identity));

describe('WorkspaceContext', () => {
  beforeEach(async () => {
    await runtime.dispose();
    await Effect.runPromise(closeExtensionScope());
    runtime = createRuntime();
    jest.clearAllMocks();
    coreContext.subscriptions.length = 0;
    replayContext.subscriptions.length = 0;
    getTargetOrgRef = () => Effect.succeed(targetOrgRef);
    getConnection = connectDefaultOrg;
    WorkspaceContext.disposeInstance();
    WorkspaceContext.getInstance(true);
    await flushEffects();
    jest.clearAllMocks();
    await setTargetOrg({});
    jest.clearAllMocks();
  });

  afterEach(async () => {
    WorkspaceContext.disposeInstance();
    await runtime.dispose();
    await Effect.runPromise(closeExtensionScope());
    runtime = createRuntime();
  });

  it('seeds synchronous getters from the initial snapshot without firing an event', async () => {
    await setTargetOrg({ username: 'initial@example.com', alias: 'initial', orgId: '00Dinitial' });
    const context = WorkspaceContext.getInstance(true);
    const listener = jest.fn();
    context.onOrgChange(listener);

    await context.initialize(coreContext as never);
    jest.clearAllMocks();

    expect({ username: context.username, alias: context.alias, orgId: context.orgId }).toEqual({
      username: 'initial@example.com',
      alias: 'initial',
      orgId: '00Dinitial'
    });
    expect(listener).not.toHaveBeenCalled();
    expect(refreshAllExtensionReporters).not.toHaveBeenCalled();
  });

  it('does not require a connection to initialize from an empty target-org snapshot', async () => {
    const getConnectionMock = jest.fn(() => Effect.succeed(connection));
    getConnection = getConnectionMock;
    const context = WorkspaceContext.getInstance(true);

    await context.initialize(coreContext as never);

    expect(getConnectionMock).not.toHaveBeenCalled();
    expect({ username: context.username, alias: context.alias, orgId: context.orgId }).toEqual({
      username: undefined,
      alias: undefined,
      orgId: undefined
    });
  });

  it('waits for a complete initial org identity without emitting setup changes', async () => {
    await setTargetOrg({ username: 'initial@example.com', alias: 'initial' });
    const context = WorkspaceContext.getInstance(true);
    const listener = jest.fn();
    context.onOrgChange(listener);
    const initialization = context.initialize(coreContext as never);
    const initialized = jest.fn();
    void initialization.then(initialized);

    await flushEffects();
    expect(initialized).not.toHaveBeenCalled();

    await setTargetOrg({ username: 'initial@example.com', alias: 'initial', orgId: '00Dinitial' });
    await initialization;

    expect(listener).not.toHaveBeenCalled();
    expect(refreshAllExtensionReporters).not.toHaveBeenCalled();
    expect({ username: context.username, alias: context.alias, orgId: context.orgId }).toEqual({
      username: 'initial@example.com',
      alias: 'initial',
      orgId: '00Dinitial'
    });
  });

  it('fires once per distinct identity after updating getters and refreshes telemetry', async () => {
    const context = WorkspaceContext.getInstance(true);
    const observedGetters: object[] = [];
    context.onOrgChange(() =>
      observedGetters.push({ username: context.username, alias: context.alias, orgId: context.orgId })
    );
    await context.initialize(coreContext as never);
    jest.clearAllMocks();

    const switched = { username: 'switched@example.com', alias: 'configured', orgId: '00Dswitched' };
    await setTargetOrg(switched);
    await setTargetOrg({ ...switched });
    await flushEffects();

    expect(observedGetters).toEqual([{ username: switched.username, alias: switched.alias, orgId: switched.orgId }]);
    expect(refreshAllExtensionReporters).toHaveBeenCalledWith(coreContext);
  });

  it('serializes telemetry refreshes across target-org changes', async () => {
    const firstRefresh = Promise.withResolvers<void>();
    jest.mocked(refreshAllExtensionReporters).mockImplementationOnce(() => firstRefresh.promise);
    const context = WorkspaceContext.getInstance(true);
    await context.initialize(coreContext as never);
    jest.clearAllMocks();
    jest.mocked(refreshAllExtensionReporters).mockImplementationOnce(() => firstRefresh.promise);

    await setTargetOrg({ username: 'first@example.com', orgId: '00Dfirst' });
    await flushEffects();
    await setTargetOrg({ username: 'second@example.com', orgId: '00Dsecond' });
    await flushEffects();

    expect(refreshAllExtensionReporters).toHaveBeenCalledTimes(1);
    firstRefresh.resolve();
    await flushEffects();
    await flushEffects();
    expect(refreshAllExtensionReporters).toHaveBeenCalledTimes(2);
  });

  it('fires when orgId changes and suppresses an exact duplicate snapshot', async () => {
    await setTargetOrg({ username: 'initial@example.com', alias: 'initial', orgId: '00Dinitial' });
    const context = WorkspaceContext.getInstance(true);
    const listener = jest.fn();
    context.onOrgChange(listener);
    await context.initialize(coreContext as never);
    jest.clearAllMocks();

    await setTargetOrg({ username: 'initial@example.com', alias: 'initial', orgId: '00Dchanged' });
    await setTargetOrg({ username: 'initial@example.com', alias: 'initial', orgId: '00Dchanged' });
    await flushEffects();

    expect(context.orgId).toBe('00Dchanged');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(refreshAllExtensionReporters).toHaveBeenCalledTimes(1);
  });

  it('fires when only the configured alias changes', async () => {
    await setTargetOrg({ username: 'initial@example.com', alias: 'first', orgId: '00Dinitial' });
    const context = WorkspaceContext.getInstance(true);
    const listener = jest.fn();
    context.onOrgChange(listener);
    await context.initialize(coreContext as never);
    jest.clearAllMocks();

    await setTargetOrg({ username: 'initial@example.com', alias: 'second', orgId: '00Dinitial' });
    await flushEffects();

    expect(context.alias).toBe('second');
    expect(listener).toHaveBeenCalledWith({ username: 'initial@example.com', alias: 'second' });
    expect(refreshAllExtensionReporters).toHaveBeenCalledTimes(1);
  });

  it('normalizes no-org values to undefined', async () => {
    await setTargetOrg({ username: 'before@example.com', alias: 'before', orgId: '00Dbefore' });
    const context = WorkspaceContext.getInstance(true);
    await context.initialize(replayContext as never);
    jest.clearAllMocks();

    const changed = new Promise<void>(resolve => context.onOrgChange(() => resolve()));
    await setTargetOrg({});
    await changed;

    expect({ username: context.username, alias: context.alias, orgId: context.orgId }).toEqual({
      username: undefined,
      alias: undefined,
      orgId: undefined
    });
    expect(refreshAllExtensionReporters).toHaveBeenCalledTimes(1);
  });

  it('initializes once and keeps connection delegation unchanged', async () => {
    await setTargetOrg({ username: 'user@example.com', orgId: '00Duser' });
    const context = WorkspaceContext.getInstance(true);

    await Promise.all([
      context.initialize(coreContext as never),
      context.initialize(coreContext as never),
      context.initialize(coreContext as never)
    ]);

    expect(await context.getConnection()).toBe(connection);
    expect(coreContext.subscriptions).toHaveLength(1);
  });

  it('initializes with empty identity when no target org is configured', async () => {
    const context = WorkspaceContext.getInstance(true);

    await context.initialize(coreContext as never);

    expect({ username: context.username, alias: context.alias, orgId: context.orgId }).toEqual({
      username: undefined,
      alias: undefined,
      orgId: undefined
    });
  });

  it('keeps retained facades live when the singleton reference is replaced', async () => {
    await setTargetOrg({ username: 'first@example.com', alias: 'first', orgId: '00Dfirst' });
    const first = WorkspaceContext.getInstance(true);
    const firstListener = jest.fn();
    first.onOrgChange(firstListener);
    await first.initialize(coreContext as never);

    const replacement = WorkspaceContext.getInstance(true);
    const replacementListener = jest.fn();
    replacement.onOrgChange(replacementListener);
    await replacement.initialize(coreContext as never);
    jest.clearAllMocks();

    const switched = { username: 'second@example.com', alias: 'second', orgId: '00Dsecond' };
    await setTargetOrg(switched);
    await flushEffects();

    expect(firstListener).toHaveBeenCalledTimes(1);
    expect(replacementListener).toHaveBeenCalledTimes(1);
    expect(refreshAllExtensionReporters).toHaveBeenCalledTimes(1);
    expect({ username: first.username, alias: first.alias, orgId: first.orgId }).toEqual({
      username: switched.username,
      alias: switched.alias,
      orgId: switched.orgId
    });
    expect({ username: replacement.username, alias: replacement.alias, orgId: replacement.orgId }).toEqual({
      username: switched.username,
      alias: switched.alias,
      orgId: switched.orgId
    });
  });

  it('disposes the public facade when VS Code disposes extension subscriptions', async () => {
    const context = WorkspaceContext.getInstance(true);
    const listener = jest.fn();
    context.onOrgChange(listener);
    await context.initialize(coreContext as never);

    coreContext.subscriptions.forEach(subscription => (subscription as { dispose: () => void }).dispose());
    expect(context.username).toBeUndefined();
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not retain service state when disposed during initialization', async () => {
    const targetOrgReady = Effect.runSync(
      Deferred.make<SubscriptionRef.SubscriptionRef<typeof DefaultOrgInfoSchema.Type>>()
    );
    getTargetOrgRef = () => Deferred.await(targetOrgReady);
    const context = WorkspaceContext.getInstance(true);

    const initialization = context.initialize(coreContext as never);
    context.dispose();
    Effect.runSync(Deferred.succeed(targetOrgReady, targetOrgRef));

    await expect(initialization).rejects.toThrow('WorkspaceContext was disposed during initialization');
    expect(context.username).toBeUndefined();
  });

  it('stops org-change processing when the extension scope closes', async () => {
    const context = WorkspaceContext.getInstance(true);
    const listener = jest.fn();
    context.onOrgChange(listener);
    await context.initialize(coreContext as never);
    jest.clearAllMocks();

    await Effect.runPromise(closeExtensionScope());
    await setTargetOrg({ username: 'after-close@example.com', orgId: '00Dclosed' });
    await flushEffects();

    expect(listener).not.toHaveBeenCalled();
    expect(refreshAllExtensionReporters).not.toHaveBeenCalled();
  });
});
