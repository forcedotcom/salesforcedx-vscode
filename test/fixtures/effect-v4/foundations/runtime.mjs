/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { foundationalWatcherLayers } from 'salesforcedx-vscode-services/out/src/services/foundationalLayers.js';
import { WebFileSystemProvider } from 'salesforcedx-vscode-services/out/src/services/webFileSystemProvider.js';
import {
  AliasService,
  ChannelService,
  FsService,
  SettingsService,
  TargetOrgRef,
  WorkspaceService
} from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as PubSub from 'effect/PubSub';
import { URI } from 'vscode-uri';
import { stats, workspace } from 'vscode';
import * as caller from '../decoderConsumer/consumer.js';

const graph = foundationalWatcherLayers.pipe(
  Layer.provide(
    Layer.mergeAll(
      Layer.succeed(WebFileSystemProvider, {
        get: () => ({ findFiles: async () => [URI.parse('memfs:/fixture/web-result.cls')] })
      }),
      Layer.mock(ChannelService, { appendToChannel: () => Effect.void })
    )
  )
);
const runtime = ManagedRuntime.make(Layer.mergeAll(graph, graph));
const ref = await runtime.runPromise(TargetOrgRef);
const info = await runtime.runPromise(WorkspaceService.use(service => service.getWorkspaceInfo()));
const token = await runtime.runPromise(SettingsService.use(service => service.getAccessToken()));
const aliases = await runtime.runPromise(
  AliasService.use(service => service.getAliasesFromUsername('user@example.com'))
);
const files = await runtime.runPromise(FsService.use(service => service.findFiles('**/*.cls')));
const foreignSchemaAccepted = Schema.decodeUnknownSync(caller.ForeignIdSchema)('005000000000001') === '005000000000001';
if (!foreignSchemaAccepted) throw new Error('Effect 4.1.4 must decode a schema from an independently installed copy');
const originalRead = workspace.fs.readFile;
workspace.fs.readFile = uri => uri.path === '/fixture/caller.json'
  ? Promise.resolve(new TextEncoder().encode('{"Id":"005000000000001","Username":"Caller"}')) : originalRead(uri);
let callerDecoding;
try {
  const decoded = await runtime.runPromise(FsService.use(service => service.readJSON('memfs:/fixture/caller.json', caller.decodeJSON)).pipe(
    Effect.provideService(caller.DecoderSettings, { prefix: 'independent:' }), Effect.withSpan('packed.readJSON')
  ));
  const failure = await runtime.runPromise(FsService.use(service => service.readJSON('memfs:/fixture/caller.json', caller.rejectPage)).pipe(Effect.flip));
  const defect = await runtime.runPromiseExit(FsService.use(service => service.readJSON('memfs:/fixture/caller.json', caller.dieJSON)));
  callerDecoding = { foreignSchemaAccepted, id: decoded.Id, label: decoded.label, parentSpan: Option.getOrUndefined(decoded.parentSpan),
    typedErrorIdentity: failure.cause === caller.rejection,
    defectIdentity: Exit.isFailure(defect) && defect.cause.reasons.some(reason => reason._tag === 'Die' && reason.defect === caller.defect) };
} finally { workspace.fs.readFile = originalRead; }
await runtime.dispose();
export const observed = {
  ...stats,
  path: info.path,
  token: String(token),
  aliases,
  files: files.map(file => file.toString()),
  orgRefClosed: await Effect.runPromise(PubSub.isShutdown(ref.pubsub)),
  callerDecoding
};
