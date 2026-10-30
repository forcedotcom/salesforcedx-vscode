/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { foundationalWatcherLayers } from '@salesforce/vscode-services-v4-implementation';
import { WebFileSystemProvider } from '@salesforce/vscode-services-v4-implementation/webFileSystemProvider';
import {
  AliasService,
  ChannelService,
  FsService,
  SettingsService,
  TargetOrgRef,
  WorkspaceService
} from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as PubSub from 'effect/PubSub';
import { URI } from 'vscode-uri';
import { stats } from 'vscode';

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
await runtime.dispose();
export const observed = {
  ...stats,
  path: info.path,
  token: String(token),
  aliases,
  files: files.map(file => file.toString()),
  orgRefClosed: await Effect.runPromise(PubSub.isShutdown(ref.pubsub))
};
