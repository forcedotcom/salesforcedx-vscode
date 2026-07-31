/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService, closeExtensionScope } from '@salesforce/effect-ext-utils';
import { refreshAllExtensionReporters } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { WorkspaceContext } from '../../../src/context';

jest.mock('@salesforce/salesforcedx-utils-vscode', () => ({
  ...jest.requireActual('@salesforce/salesforcedx-utils-vscode'),
  refreshAllExtensionReporters: jest.fn().mockResolvedValue(undefined)
}));

const targetOrgRef = Effect.runSync(SubscriptionRef.make({}));
const connection = { getAuthInfoFields: () => ({ orgId: '00D' }) };
const servicesApi = {
  services: {
    ConnectionService: { getConnection: () => Effect.succeed(connection) },
    TargetOrgRef: () => Effect.succeed(targetOrgRef)
  }
};
const providerLayer = Layer.succeed(ExtensionProviderService, {
  getServicesApi: Effect.succeed(servicesApi)
} as never);
const runPromise = <A, E, R>(effect: Effect.Effect<A, E, R>): Promise<A> =>
  Effect.runPromise(effect.pipe(Effect.provide(providerLayer as Layer.Layer<R>)));

jest.mock('../../../src/services/runtime', () => ({
  getRuntime: () => ({ runPromise })
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

const setTargetOrg = (identity: { username?: string; alias?: string; orgId?: string }) =>
  Effect.runPromise(SubscriptionRef.set(targetOrgRef, identity));

describe('WorkspaceContext', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    coreContext.subscriptions.length = 0;
    replayContext.subscriptions.length = 0;
    await runPromise(closeExtensionScope());
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
    await flushEffects();

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
});
