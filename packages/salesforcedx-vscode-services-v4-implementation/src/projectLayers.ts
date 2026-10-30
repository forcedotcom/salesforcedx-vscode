/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { FileChangePubSub, WorkspaceService } from '@salesforce/vscode-services-v2';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as PubSub from 'effect/PubSub';
import * as Stream from 'effect/Stream';
import { Utils } from 'vscode-uri';
import { ChannelServiceLayer } from './channelService.js';
import { ComponentSetServiceLayer } from './componentSetService.js';
import { foundationalLayers } from './foundationalLayers.js';
import { MetadataRegistryServiceLayer } from './metadataRegistryService.js';
import { ProjectFileChanges, ProjectServiceLayer } from './projectService.js';
import { makeScopedFibers } from './scopedFiber.js';

export const ProjectFileWatcherLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const files = yield* FileChangePubSub.pipe(Effect.flatMap(PubSub.subscribe));
    const changes = yield* ProjectFileChanges;
    const workspace = yield* WorkspaceService;
    const scopedFibers = yield* makeScopedFibers;
    // The subscription exists before layer readiness; no sleep or first-event startup race.
    yield* Stream.fromSubscription(files).pipe(
      Stream.filterEffect(event =>
        workspace
          .getWorkspaceInfo()
          .pipe(
            Effect.map(
              info => !info.isEmpty && event.uri.toString() === Utils.joinPath(info.uri, 'sfdx-project.json').toString()
            )
          )
      ),
      Stream.debounce(Duration.millis(5)),
      Stream.runForEach(changes.handle),
      scopedFibers.fork
    );
  })
);
const foundationsAndChannel = foundationalLayers.pipe(Layer.provideMerge(ChannelServiceLayer));
const projectAndRegistry = Layer.mergeAll(ProjectServiceLayer, MetadataRegistryServiceLayer).pipe(
  Layer.provideMerge(foundationsAndChannel)
);
const projectAndComponents = ComponentSetServiceLayer.pipe(Layer.provideMerge(projectAndRegistry));
/** Connection/network independence is intentional; catalog composition adds the same memoized connection/watch layers. */
export const projectLayers = ProjectFileWatcherLayer.pipe(Layer.provideMerge(projectAndComponents));
