/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SdrNodeWorkerClient } from './nodeClient';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { ChannelService } from '../vscode/channelService';
import { ExtensionContextService } from '../vscode/extensionContextService';

type SdrNodeWorkerClientConstructor = {
  make: (workerPath: string) => Promise<SdrNodeWorkerClient>;
};

export class SdrStlWorkerUnavailableError extends Schema.TaggedError<SdrStlWorkerUnavailableError>()(
  'SdrStlWorkerUnavailableError',
  {
    message: Schema.String
  }
) {}

export class SdrStlWorkerService extends Effect.Service<SdrStlWorkerService>()('SdrStlWorkerService', {
  accessors: true,
  dependencies: [ChannelService.Default, ExtensionContextService.Default],
  scoped: Effect.gen(function* () {
    const client = yield* process.env.ESBUILD_PLATFORM === 'web'
      ? Effect.void
      : Effect.gen(function* () {
          const [extensionContextService, channelService] = yield* Effect.all([
            ExtensionContextService,
            ChannelService
          ]);
          const context = yield* extensionContextService.getContext;
          const workerPath = vscode.Uri.joinPath(context.extensionUri, 'dist', 'sdr-stl-worker.cjs').fsPath;
          const workerClientPath = vscode.Uri.joinPath(
            context.extensionUri,
            'dist',
            'sdr-stl-worker-client.cjs'
          ).fsPath;
          const startedClient = yield* Effect.tryPromise({
            try: async () => {
              // The Node-only transport is a separate artifact so web bundles never resolve node:worker_threads.
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-var-requires -- runtime-only load keeps Node builtins out of web bundles.
              const { SdrNodeWorkerClient } = require(workerClientPath) as {
                SdrNodeWorkerClient: SdrNodeWorkerClientConstructor;
              };
              return await SdrNodeWorkerClient.make(workerPath);
            },
            catch: cause => new SdrStlWorkerUnavailableError({ message: String(cause) })
          });
          yield* channelService.appendToChannel('SDR/STL worker started successfully.');
          yield* Effect.addFinalizer(() => Effect.promise(() => startedClient.close()).pipe(Effect.ignore));
          return startedClient;
        });
    return {
      getClient: Effect.suspend(() =>
        client
          ? Effect.succeed(client)
          : Effect.fail(
              new SdrStlWorkerUnavailableError({
                message: 'The Node SDR/STL worker is not available in web extensions.'
              })
            )
      )
    };
  })
}) {}
