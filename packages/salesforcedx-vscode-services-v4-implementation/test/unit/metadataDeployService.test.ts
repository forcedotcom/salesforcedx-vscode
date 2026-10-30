/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection } from '@salesforce/core';
import { DeployResult, MetadataApiDeploy, RequestStatus } from '@salesforce/source-deploy-retrieve';
import {
  ActiveMetadataOperationRef,
  MetadataChangeNotificationService,
  MetadataDeployService,
  ConnectionService,
  UserCancellationError
} from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as PubSub from 'effect/PubSub';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { OrgChanges } from '../../src/targetOrgRef.js';
import { MetadataDescribeInvalidation } from '../../src/metadataDescribeService.js';
import { createMetadataOperationTest } from '../support/metadataOperation.js';

const id = '0Af000000000001';
const deployResponse = (status: RequestStatus): Awaited<ReturnType<Connection['metadata']['checkDeployStatus']>> => ({
  id,
  status,
  done: true,
  success: status === RequestStatus.Succeeded || status === RequestStatus.SucceededPartial,
  checkOnly: false,
  createdBy: '005000000000001',
  createdByName: 'Fixture',
  createdDate: '2026-10-30T00:00:00.000Z',
  lastModifiedDate: '2026-10-30T00:00:00.000Z',
  ignoreWarnings: false,
  numberComponentErrors: 0,
  numberComponentsDeployed: 1,
  numberComponentsTotal: 1,
  numberTestErrors: 0,
  numberTestsCompleted: 0,
  numberTestsTotal: 0,
  runTestsEnabled: false,
  rollbackOnError: true,
  details: {
    componentFailures: [],
    componentSuccesses: [
      {
        changed: true,
        created: false,
        deleted: false,
        success: true,
        createdDate: '2026-10-30T00:00:00.000Z',
        componentType: 'ApexClass',
        fileName: 'classes/Remote.cls',
        fullName: 'Remote',
        id: '01p000000000001'
      }
    ]
  }
});

it.each([RequestStatus.Succeeded, RequestStatus.SucceededPartial])(
  'uses actual SDK ZIP/start/poll/result and publishes one deduplicated operation for %s',
  async status => {
    const test = await createMetadataOperationTest();
    try {
      const start = vi
        .spyOn(test.connection.metadata, 'deploy')
        .mockResolvedValue({ id, done: false, state: 'Queued' });
      vi.spyOn(test.connection.metadata, 'checkDeployStatus').mockResolvedValue(deployResponse(status));
      await test.runtime.runPromise(
        Effect.gen(function* () {
          const notifications = yield* MetadataChangeNotificationService;
          const subscription = yield* PubSub.subscribe(notifications.pubsub);
          const result = yield* MetadataDeployService.use(service => service.deploy(test.components));
          expect(result).toBeInstanceOf(DeployResult);
          expect(result.response.status).toBe(status);
          expect(result.getFileResponses().map(response => response.fullName)).toContain('Remote');
          const event = yield* PubSub.take(subscription);
          expect(event).toMatchObject({
            orgId: test.orgId,
            operation: 'deploy',
            changes: [{ metadataType: 'ApexClass', fullName: 'Remote', changeType: 'changed' }]
          });
          expect(event.changes).toHaveLength(1);
          expect(yield* ActiveMetadataOperationRef.pipe(Effect.flatMap(SubscriptionRef.get))).toBe(0);
        }).pipe(Effect.scoped)
      );
      expect(Buffer.isBuffer(start.mock.calls[0][0])).toBe(true);
      expect(test.listenerDisposals()).toBe(1);
      expect(vscode.window.withProgress).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Deploying 1 component', cancellable: true }),
        expect.any(Function)
      );
    } finally {
      await test.dispose();
    }
  }
);

it('retains a native failed deploy result without publishing a successful operation', async () => {
  const test = await createMetadataOperationTest();
  try {
    vi.spyOn(test.connection.metadata, 'deploy').mockResolvedValue({ id, done: false, state: 'Queued' });
    vi.spyOn(test.connection.metadata, 'checkDeployStatus').mockResolvedValue(deployResponse(RequestStatus.Failed));
    const notifications = await test.runtime.runPromise(MetadataChangeNotificationService);
    const publish = vi.spyOn(notifications, 'publishOperation');
    const result = await test.runtime.runPromise(MetadataDeployService.use(service => service.deploy(test.components)));
    expect(result).toBeInstanceOf(DeployResult);
    expect(result.response.status).toBe(RequestStatus.Failed);
    expect(publish).not.toHaveBeenCalled();
    expect(test.listenerDisposals()).toBe(1);
  } finally {
    await test.dispose();
  }
});

it('returns UserCancellationError for a server-canceled deploy and disposes the listener', async () => {
  const test = await createMetadataOperationTest();
  try {
    vi.spyOn(test.connection.metadata, 'deploy').mockResolvedValue({ id, done: false, state: 'Queued' });
    vi.spyOn(test.connection.metadata, 'checkDeployStatus').mockResolvedValue(deployResponse(RequestStatus.Canceled));
    const error = await test.runtime.runPromise(
      MetadataDeployService.use(service => service.deploy(test.components)).pipe(Effect.flip)
    );
    expect(error).toBeInstanceOf(UserCancellationError);
    expect(test.listenerDisposals()).toBe(1);
  } finally {
    await test.dispose();
  }
});

it.each([false, true])('replays cancellation after native start assigns an ID, cancel rejects=%s', async rejects => {
  const test = await createMetadataOperationTest();
  try {
    const started = Promise.withResolvers<void>();
    const response = Promise.withResolvers<{ id: string; done: boolean; state: string }>();
    const fault = new Error('cancel failed');
    vi.spyOn(test.connection.metadata, 'deploy').mockImplementation(() => {
      started.resolve();
      // SDR awaits this transport response; native ComponentSet/MetadataApiDeploy still own ZIP/start/poll/result.
      return response.promise as unknown as ReturnType<typeof test.connection.metadata.deploy>;
    });
    vi.spyOn(test.connection.metadata, 'checkDeployStatus').mockResolvedValue(deployResponse(RequestStatus.Succeeded));
    const cancel = vi
      .spyOn(test.connection.metadata, 'cancelDeploy')
      .mockImplementation(() => (rejects ? Promise.reject(fault) : Promise.resolve({ id, done: true })));
    const notifications = await test.runtime.runPromise(MetadataChangeNotificationService);
    const publish = vi.spyOn(notifications, 'publishOperation');
    const result = test.runtime.runPromiseExit(MetadataDeployService.use(service => service.deploy(test.components)));
    await started.promise;
    test.requestCancel();
    response.resolve({ id, done: false, state: 'Queued' });
    const exit = await result;
    expect(cancel).toHaveBeenCalledExactlyOnceWith(id);
    // Native success still completes tracking/publication, even when cancel() rejects.
    expect(publish).toHaveBeenCalledTimes(1);
    expect(Exit.isFailure(exit)).toBe(rejects);
    expect(Exit.isFailure(exit) ? exit.cause.reasons : []).toMatchObject(
      rejects
        ? [
            {
              _tag: 'Fail',
              error: { _tag: 'FailedToDeployMetadataError', cause: fault }
            }
          ]
        : []
    );
    expect(test.listenerDisposals()).toBe(1);
  } finally {
    await test.dispose();
  }
});

it.each(['cancel', 'dispose'] as const)(
  'awaits a native deploy poll and cancellation request before %s releases the operation',
  async mode => {
    const fixture = await createMetadataOperationTest();
    const release = Promise.withResolvers<ReturnType<typeof deployResponse>>();
    let stopped: Promise<unknown> | undefined;
    try {
      vi.spyOn(fixture.connection.metadata, 'deploy').mockResolvedValue({ id, done: false, state: 'Queued' });
      const entered = Promise.withResolvers<void>();
      vi.spyOn(fixture.connection.metadata, 'checkDeployStatus').mockImplementationOnce(() => {
        entered.resolve();
        return release.promise;
      });
      const cancelEntered = Promise.withResolvers<void>();
      vi.spyOn(fixture.connection.metadata, 'cancelDeploy').mockImplementation(() => {
        cancelEntered.resolve();
        return Promise.resolve({ id, done: true });
      });
      const active = await fixture.runtime.runPromise(ActiveMetadataOperationRef);
      const controller = new AbortController();
      const result = fixture.runtime.runPromiseExit(
        MetadataDeployService.use(service => service.deploy(fixture.components)),
        { signal: controller.signal }
      );
      await entered.promise;
      let finished = false;
      const stop = mode === 'dispose' ? fixture.runtime.dispose() : Promise.resolve(controller.abort());
      stopped = Promise.all([stop, result]).then(value => {
        finished = true;
        return value;
      });
      await cancelEntered.promise;
      expect(finished).toBe(false);
      expect(await Effect.runPromise(SubscriptionRef.get(active))).toBe(1);
      release.resolve(deployResponse(RequestStatus.Succeeded));
      await stopped;
      expect(Exit.isFailure(await result)).toBe(true);
      expect(await Effect.runPromise(SubscriptionRef.get(active))).toBe(0);
      expect(fixture.listenerDisposals()).toBe(1);
    } finally {
      release.resolve(deployResponse(RequestStatus.Succeeded));
      await stopped;
      await fixture.dispose();
    }
  }
);

it('preserves the actual SDK public poll rejection without publishing a successful operation', async () => {
  const fixture = await createMetadataOperationTest();
  try {
    const fault = new Error('native deploy poll failed');
    vi.spyOn(fixture.connection.metadata, 'deploy').mockResolvedValue({ id, done: false, state: 'Queued' });
    vi.spyOn(fixture.connection.metadata, 'checkDeployStatus').mockRejectedValue(fault);
    let publicFailure: unknown;
    // eslint-disable-next-line vitest/unbound-method -- Invoke the real SDK method with its original receiver below.
    const poll = MetadataApiDeploy.prototype.pollStatus;
    vi.spyOn(MetadataApiDeploy.prototype, 'pollStatus').mockImplementationOnce(function (
      this: MetadataApiDeploy,
      ...args
    ) {
      return poll.apply(this, args).catch(cause => {
        publicFailure = cause;
        throw cause;
      });
    });
    const notifications = await fixture.runtime.runPromise(MetadataChangeNotificationService);
    const publish = vi.spyOn(notifications, 'publishOperation');
    const error = await fixture.runtime.runPromise(
      MetadataDeployService.use(service => service.deploy(fixture.components)).pipe(Effect.flip)
    );
    expect(error).toMatchObject({ _tag: 'FailedToDeployMetadataError' });
    expect(publicFailure).toMatchObject({ name: 'MetadataTransferError' });
    expect('cause' in error ? error.cause : undefined).toBe(publicFailure);
    expect(publish).not.toHaveBeenCalled();
    expect(fixture.listenerDisposals()).toBe(1);
  } finally {
    await fixture.dispose();
  }
});

it('combines stale-result rejection with cancel failure instead of losing either failure', async () => {
  const fixture = await createMetadataOperationTest();
  const release = Promise.withResolvers<ReturnType<typeof deployResponse>>();
  let result: Promise<Exit.Exit<DeployResult, unknown>> | undefined;
  try {
    const fault = new Error('server cancel rejected');
    vi.spyOn(fixture.connection.metadata, 'deploy').mockResolvedValue({ id, done: false, state: 'Queued' });
    const entered = Promise.withResolvers<void>();
    vi.spyOn(fixture.connection.metadata, 'checkDeployStatus').mockImplementationOnce(() => {
      entered.resolve();
      return release.promise;
    });
    const cancelEntered = Promise.withResolvers<void>();
    vi.spyOn(fixture.connection.metadata, 'cancelDeploy').mockImplementation(() => {
      cancelEntered.resolve();
      return Promise.reject(fault);
    });
    const notifications = await fixture.runtime.runPromise(MetadataChangeNotificationService);
    const publish = vi.spyOn(notifications, 'publishOperation');
    result = fixture.runtime.runPromiseExit(MetadataDeployService.use(service => service.deploy(fixture.components)));
    await entered.promise;
    fixture.requestCancel();
    await cancelEntered.promise;
    await fixture.runtime.runPromise(OrgChanges.use(changes => changes.clear));
    await fixture.runtime.runPromise(ConnectionService.use(connections => connections.getConnection()));
    release.resolve(deployResponse(RequestStatus.Succeeded));
    const exit = await result;
    const errors = Exit.isFailure(exit)
      ? exit.cause.reasons.flatMap(reason => (reason._tag === 'Fail' ? [reason.error] : []))
      : [];
    expect(errors).toMatchObject([{ _tag: 'InactiveOrgOperationError' }, { _tag: 'FailedToDeployMetadataError' }]);
    expect(
      errors
        .flatMap(error => (typeof error === 'object' && error !== null && 'cause' in error ? [error.cause] : []))
        .at(-1)
    ).toBe(fault);
    expect(publish).not.toHaveBeenCalled();
    expect(fixture.listenerDisposals()).toBe(1);
  } finally {
    release.resolve(deployResponse(RequestStatus.Succeeded));
    await result;
    await fixture.dispose();
  }
});

it('keeps active-operation count raised through cache invalidation and notification publication', async () => {
  const fixture = await createMetadataOperationTest();
  const release = Promise.withResolvers<void>();
  let result: Promise<unknown> | undefined;
  try {
    vi.spyOn(fixture.connection.metadata, 'deploy').mockResolvedValue({ id, done: false, state: 'Queued' });
    vi.spyOn(fixture.connection.metadata, 'checkDeployStatus').mockResolvedValue(
      deployResponse(RequestStatus.Succeeded)
    );
    const invalidation = await fixture.runtime.runPromise(MetadataDescribeInvalidation);
    const invalidate = invalidation.invalidateForTracking;
    const entered = Promise.withResolvers<void>();
    vi.spyOn(invalidation, 'invalidateForTracking').mockImplementationOnce((...args) =>
      Effect.promise(() => {
        entered.resolve();
        return release.promise;
      }).pipe(Effect.andThen(invalidate.apply(invalidation, args)))
    );
    const notifications = await fixture.runtime.runPromise(MetadataChangeNotificationService);
    const publish = vi.spyOn(notifications, 'publishOperation');
    const active = await fixture.runtime.runPromise(ActiveMetadataOperationRef);
    result = fixture.runtime.runPromise(MetadataDeployService.use(service => service.deploy(fixture.components)));
    await entered.promise;
    expect(await Effect.runPromise(SubscriptionRef.get(active))).toBe(1);
    expect(publish).not.toHaveBeenCalled();
    release.resolve();
    await result;
    expect(publish).toHaveBeenCalledTimes(1);
    expect(await Effect.runPromise(SubscriptionRef.get(active))).toBe(0);
  } finally {
    release.resolve();
    await result;
    await fixture.dispose();
  }
});
