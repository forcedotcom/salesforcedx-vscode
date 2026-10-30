/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as WorkerRunner from '@effect/platform/WorkerRunner';
import * as NodeWorkerRunner from '@effect/platform-node/NodeWorkerRunner';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { isError } from 'effect/Predicate';
import { parentPort } from 'node:worker_threads';
import { AllSdrWorkerRequests, SdrWorkerFailure } from './effectProtocol';
import { PROTOCOL_VERSION } from './protocol';
import { SdrWorkerService } from './workerService';

// eslint-disable-next-line functional/no-throw-statements -- WorkerRunner requires a Node worker message port.
if (!parentPort) throw new Error('SDR worker entry must run in a Node worker thread.');

const service = new SdrWorkerService();
// POC policy: preserve STL's process-local state by running every request in
// order. Session-specific scheduling and worker pools are later work.
const requestSemaphore = Effect.runSync(Effect.makeSemaphore(1));
const fromService = <A>(request: Parameters<SdrWorkerService['execute']>[0]) =>
  Effect.tryPromise({
    try: () => service.execute(request),
    catch: error => {
      const cause = isError(error) ? error : new Error(String(error));
      return new SdrWorkerFailure({
        name: cause.name,
        message: cause.message,
        ...(cause.stack ? { stack: cause.stack } : {})
      });
    }
  }).pipe(
    Effect.flatMap(response =>
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- WorkerRunner maps request tags to responses at runtime.
      response._tag === 'Failure' ? Effect.fail(new SdrWorkerFailure(response.error)) : Effect.succeed(response as A)
    )
  );
const serialize = <A>(effect: Effect.Effect<A, SdrWorkerFailure>) => requestSemaphore.withPermits(1)(effect);

const handlers: WorkerRunner.SerializedRunner.Handlers<typeof AllSdrWorkerRequests.Type> = {
  CreateComponentSetFromSource: request =>
    serialize(
      fromService({
        protocolVersion: PROTOCOL_VERSION,
        requestId: request.requestId,
        _tag: 'ComponentSetFromSource',
        projectDirectory: request.projectDirectory,
        paths: request.paths
      })
    ),
  CreateComponentSetFromManifest: request =>
    serialize(
      fromService({
        protocolVersion: PROTOCOL_VERSION,
        requestId: request.requestId,
        _tag: 'ComponentSetFromManifest',
        manifestPath: request.manifestPath
      })
    ),
  GetPackageXml: request =>
    serialize(
      fromService({
        protocolVersion: PROTOCOL_VERSION,
        requestId: request.requestId,
        _tag: 'GetPackageXml',
        handle: request.handle
      })
    ),
  GetComponentSummary: request =>
    serialize(
      fromService({
        protocolVersion: PROTOCOL_VERSION,
        requestId: request.requestId,
        _tag: 'GetComponentSummary',
        handle: request.handle
      })
    ),
  CreateMetadataZip: request =>
    serialize(
      fromService({
        protocolVersion: PROTOCOL_VERSION,
        requestId: request.requestId,
        _tag: 'ConvertToMetadataZip',
        handle: request.handle,
        ...(request.packageName ? { packageName: request.packageName } : {})
      })
    ),
  DisposeHandle: request =>
    serialize(
      fromService({
        protocolVersion: PROTOCOL_VERSION,
        requestId: request.requestId,
        _tag: 'Dispose',
        handle: request.handle
      })
    ),
  GetSourceTrackingKey: request =>
    serialize(
      fromService({
        protocolVersion: PROTOCOL_VERSION,
        requestId: request.requestId,
        _tag: 'GetSourceTrackingKey',
        type: request.type,
        name: request.name
      })
    ),
  CreateSourceTrackingSession: request =>
    serialize(
      fromService({
        protocolVersion: PROTOCOL_VERSION,
        requestId: request.requestId,
        _tag: 'CreateSourceTrackingSession',
        projectDirectory: request.projectDirectory,
        instanceUrl: request.instanceUrl,
        accessToken: request.accessToken,
        ...(request.apiVersion ? { apiVersion: request.apiVersion } : {}),
        ...(request.ignoreConflicts !== undefined ? { ignoreConflicts: request.ignoreConflicts } : {})
      })
    ),
  GetLocalChanges: request =>
    serialize(
      fromService({
        protocolVersion: PROTOCOL_VERSION,
        requestId: request.requestId,
        _tag: 'GetLocalChanges',
        handle: request.handle,
        ...(request.byPackageDirectory !== undefined ? { byPackageDirectory: request.byPackageDirectory } : {})
      })
    ),
  GetSourceTrackingStatus: request =>
    serialize(
      fromService({
        protocolVersion: PROTOCOL_VERSION,
        requestId: request.requestId,
        _tag: 'GetSourceTrackingStatus',
        handle: request.handle,
        local: request.local,
        remote: request.remote
      })
    ),
  DeployLocalChanges: request =>
    serialize(
      fromService({
        protocolVersion: PROTOCOL_VERSION,
        requestId: request.requestId,
        _tag: 'DeployLocalChanges',
        handle: request.handle
      })
    )
};

const program = WorkerRunner.launch(
  Layer.provide(WorkerRunner.layerSerialized(AllSdrWorkerRequests, handlers), NodeWorkerRunner.layer)
);

void Effect.runPromiseExit(program).then(exit => {
  if (exit._tag === 'Failure' && !exit.cause.pipe(Cause.isInterruptedOnly)) {
    console.error(exit.cause.pipe(Cause.pretty));
    process.exitCode = 1;
  }
});
