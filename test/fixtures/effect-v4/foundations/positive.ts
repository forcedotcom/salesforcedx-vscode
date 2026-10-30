/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { foundationalWatcherLayers } from '@salesforce/vscode-services-v4-implementation';
import { WebFileSystemProvider } from '@salesforce/vscode-services-v4-implementation/webFileSystemProvider';
import { ChannelService, WorkspaceService } from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';

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
