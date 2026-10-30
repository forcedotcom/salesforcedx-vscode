/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { foundationalLayers, foundationalWatcherLayers } from '@salesforce/vscode-services-v4-implementation';
import { WebFileSystemProvider } from '@salesforce/vscode-services-v4-implementation/webFileSystemProvider';
import { WorkspaceService } from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

export const missingWebProvider = Effect.runPromise(
  WorkspaceService.use(service => service.getWorkspaceInfo()).pipe(Effect.provide(foundationalLayers))
);
export const missingChannel = Effect.runPromise(
  WorkspaceService.use(service => service.getWorkspaceInfo()).pipe(
    Effect.provide(
      foundationalWatcherLayers.pipe(Layer.provide(Layer.succeed(WebFileSystemProvider, { get: () => undefined })))
    )
  )
);
