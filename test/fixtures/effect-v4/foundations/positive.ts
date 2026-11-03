/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { foundationalWatcherLayers } from 'salesforcedx-vscode-services/out/src/services/foundationalLayers.js';
import { WebFileSystemProvider } from 'salesforcedx-vscode-services/out/src/services/webFileSystemProvider.js';
import { ChannelService, FsService, QueryService, WorkspaceService, type FsServiceError, type QueryPageError } from '@salesforce/vscode-services/v2';
import { decodeJSON, decodePage, DecoderSettings } from '../decoderConsumer/consumer.js';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import type * as Stream from 'effect/Stream';
import type * as Scope from 'effect/Scope';
import type { PromptService, UserCancellationError } from '@salesforce/vscode-services/v2';
import { progressValue } from '../decoderConsumer/consumer.js';

export const ready = foundationalWatcherLayers.pipe(
  Layer.provide(
    Layer.mergeAll(
      Layer.succeed(WebFileSystemProvider, { get: () => undefined }),
      Layer.mock(ChannelService, { appendToChannel: () => Effect.void })
    )
  )
);
export const runtime = ManagedRuntime.make(ready);
export const workspace = () => runtime.runPromise(WorkspaceService.use(service => service.getWorkspaceInfo()));
export const dispose = () => runtime.dispose();

export const callerDecodingTypes = (fs: FsService['Service'], query: QueryService['Service']) => {
  const json: Effect.Effect<Effect.Success<ReturnType<typeof decodeJSON>>, FsServiceError, DecoderSettings> = fs.readJSON('/caller.json', decodeJSON);
  const acquisition = query.query({ soql: 'SELECT Id FROM User' }, decodePage);
  const records = acquisition.pipe(Effect.map(result => {
    type Record = NonNullable<Effect.Success<ReturnType<typeof decodePage>>['records']>[number];
    const stream: Stream.Stream<Record, QueryPageError | Effect.Error<ReturnType<typeof decodePage>>, DecoderSettings> = result.records;
    return stream;
  }));
  return { json, records };
};

export const callerPromptTypes = (prompt: PromptService['Service']) => {
  const normal: Effect.Effect<Effect.Success<typeof progressValue>, never, DecoderSettings | Scope.Scope> = prompt.withProgress('Caller progress')(progressValue);
  const cancellable: Effect.Effect<Effect.Success<typeof progressValue>, UserCancellationError, DecoderSettings | Scope.Scope> = prompt.withCancellableProgress('Caller progress')(progressValue);
  return { normal, cancellable };
};
