/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as EffectWorker from '@effect/platform/Worker';
import * as NodeWorker from '@effect/platform-node/NodeWorker';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Schema from 'effect/Schema';
import * as Scope from 'effect/Scope';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { Worker } from 'node:worker_threads';
import {
  CreateComponentSetFromManifestRequest,
  CreateComponentSetFromSourceRequest,
  CreateSourceTrackingSessionRequest,
  DeployLocalChangesRequest,
  CreateMetadataZipRequest,
  DisposeHandleRequest,
  GetComponentSummaryRequest,
  GetPackageXmlRequest,
  GetLocalChangesRequest,
  GetSourceTrackingStatusRequest,
  GetSourceTrackingKeyRequest,
  type SdrWorkerFailure,
  type SdrWorkerRequest
} from './effectProtocol';
import { PROTOCOL_VERSION, type RemoteHandle } from './protocol';

type WorkerResponseFor<Request extends SdrWorkerRequest> = Schema.WithResult.Success<Request>;

class SdrWorkerError extends Schema.TaggedError<SdrWorkerError>()('SdrWorkerError', {
  remoteName: Schema.String,
  message: Schema.String,
  stack: Schema.optional(Schema.String)
}) {}

export class RemoteComponentSet {
  constructor(
    private readonly client: SdrNodeWorkerClient,
    public readonly handle: RemoteHandle
  ) {}

  public async convertToMetadataZip(packageName?: string): Promise<{ stream: Readable; zipFileCount: number }> {
    const response = await this.client.execute(
      new CreateMetadataZipRequest({
        protocolVersion: PROTOCOL_VERSION,
        requestId: randomUUID(),
        handle: this.handle,
        ...(packageName ? { packageName } : {})
      })
    );
    return { stream: Readable.from([Buffer.from(response.zip)]), zipFileCount: response.zipFileCount };
  }

  public async getPackageXml(): Promise<string> {
    const response = await this.client.execute(
      new GetPackageXmlRequest({ protocolVersion: PROTOCOL_VERSION, requestId: randomUUID(), handle: this.handle })
    );
    return response.xml;
  }

  public async getComponentSummary(): Promise<readonly { fullName: string; type: string; isSourceBacked: boolean }[]> {
    const response = await this.client.execute(
      new GetComponentSummaryRequest({
        protocolVersion: PROTOCOL_VERSION,
        requestId: randomUUID(),
        handle: this.handle
      })
    );
    return response.components;
  }

  public async dispose(): Promise<void> {
    await this.client.execute(
      new DisposeHandleRequest({ protocolVersion: PROTOCOL_VERSION, requestId: randomUUID(), handle: this.handle })
    );
  }
}

export class RemoteSourceTrackingSession {
  constructor(
    private readonly client: SdrNodeWorkerClient,
    public readonly handle: RemoteHandle
  ) {}

  public async getLocalChanges(byPackageDirectory?: boolean): Promise<readonly RemoteComponentSet[]> {
    const response = await this.client.execute(
      new GetLocalChangesRequest({
        protocolVersion: PROTOCOL_VERSION,
        requestId: randomUUID(),
        handle: this.handle,
        ...(byPackageDirectory !== undefined ? { byPackageDirectory } : {})
      })
    );
    return response.handles.map((handle: RemoteHandle) => new RemoteComponentSet(this.client, handle));
  }

  public async getStatus(input: { local: boolean; remote: boolean }): Promise<{
    status: readonly {
      fullName: string;
      type: string;
      origin: 'local' | 'remote';
      state: 'add' | 'delete' | 'modify' | 'nondelete';
      filePath?: string;
      conflict?: boolean;
      ignored?: boolean;
    }[];
    remoteChanges: readonly {
      name: string;
      type: string;
      revisionCounter?: number;
      lastModifiedDate?: string;
      memberIdOrName?: string;
      deleted?: boolean;
      modified?: boolean;
    }[];
  }> {
    return await this.client.execute(
      new GetSourceTrackingStatusRequest({
        protocolVersion: PROTOCOL_VERSION,
        requestId: randomUUID(),
        handle: this.handle,
        ...input
      })
    );
  }

  public async dispose(): Promise<void> {
    await this.client.execute(
      new DisposeHandleRequest({ protocolVersion: PROTOCOL_VERSION, requestId: randomUUID(), handle: this.handle })
    );
  }

  public async deployLocalChanges(): Promise<{
    status: string;
    components: readonly { fullName: string; type: string; isSourceBacked: boolean }[];
    fileResponseCount: number;
  }> {
    const response = await this.client.execute(
      new DeployLocalChangesRequest({ protocolVersion: PROTOCOL_VERSION, requestId: randomUUID(), handle: this.handle })
    );
    return response;
  }
}

export class SdrNodeWorkerClient {
  private constructor(
    private readonly scope: Scope.CloseableScope,
    private readonly worker: EffectWorker.SerializedWorker<SdrWorkerRequest>
  ) {}

  public static async make(workerPath: string): Promise<SdrNodeWorkerClient> {
    const scope = Effect.runSync(Scope.make());
    // eslint-disable-next-line functional/no-try-statements -- The Node worker API is promise-based; close a partially initialized scope on startup failure.
    try {
      const worker = await Effect.runPromise(
        EffectWorker.makeSerialized<SdrWorkerRequest>({}).pipe(
          // @effect-diagnostics-next-line strictEffectProvide:off
          // The client owns the worker scope and closes it in make() on startup failure or close() after use.
          Effect.provide(NodeWorker.layer(() => new Worker(workerPath))),
          Effect.provideService(Scope.Scope, scope)
        )
      );
      return new SdrNodeWorkerClient(scope, worker);
    } catch (error) {
      await Effect.runPromise(Scope.close(scope, Exit.succeed(undefined)));
      // eslint-disable-next-line functional/no-throw-statements -- Preserve the Node worker startup failure after cleanup.
      throw error;
    }
  }

  public async fromSource(input: { projectDirectory: string; paths: string[] }): Promise<RemoteComponentSet> {
    const response = await this.execute(
      new CreateComponentSetFromSourceRequest({ protocolVersion: PROTOCOL_VERSION, requestId: randomUUID(), ...input })
    );
    return new RemoteComponentSet(this, response.handle);
  }

  public async fromManifest(manifestPath: string): Promise<RemoteComponentSet> {
    const response = await this.execute(
      new CreateComponentSetFromManifestRequest({
        protocolVersion: PROTOCOL_VERSION,
        requestId: randomUUID(),
        manifestPath
      })
    );
    return new RemoteComponentSet(this, response.handle);
  }

  public async getSourceTrackingKey(type: string, name: string): Promise<string> {
    const response = await this.execute(
      new GetSourceTrackingKeyRequest({ protocolVersion: PROTOCOL_VERSION, requestId: randomUUID(), type, name })
    );
    return response.key;
  }

  public async createSourceTrackingSession(input: {
    projectDirectory: string;
    instanceUrl: string;
    accessToken: string;
    apiVersion?: string;
    ignoreConflicts?: boolean;
  }): Promise<RemoteSourceTrackingSession> {
    const response = await this.execute(
      new CreateSourceTrackingSessionRequest({ protocolVersion: PROTOCOL_VERSION, requestId: randomUUID(), ...input })
    );
    return new RemoteSourceTrackingSession(this, response.handle);
  }

  public async close(): Promise<void> {
    await Effect.runPromise(Scope.close(this.scope, Exit.succeed(undefined)));
  }

  // SerializedWorker's union API loses the request-to-response relation at this class boundary.
  public async execute<Request extends SdrWorkerRequest>(request: Request): Promise<WorkerResponseFor<Request>> {
    // eslint-disable-next-line functional/no-try-statements
    try {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- SerializedWorker distributes request schemas internally.
      const effect = this.worker.executeEffect(request as never) as Effect.Effect<
        WorkerResponseFor<Request>,
        SdrWorkerFailure,
        never
      >;
      return await Effect.runPromise(effect);
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error && 'message' in error) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const remote = error as { name: string; message: string; stack?: string };
        // eslint-disable-next-line functional/no-throw-statements
        throw new SdrWorkerError({
          remoteName: remote.name,
          message: remote.message,
          ...(remote.stack ? { stack: remote.stack } : {})
        });
      }
      // eslint-disable-next-line functional/no-throw-statements
      throw error;
    }
  }
}
