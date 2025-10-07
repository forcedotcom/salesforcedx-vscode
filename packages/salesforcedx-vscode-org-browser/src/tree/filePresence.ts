/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { MetadataTypeTreeProvider } from './metadataTypeTreeProvider';
import type { MetadataMember } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Queue from 'effect/Queue';

import type { AnySpan } from 'effect/Tracer';
import { AllServicesLayer, ExtensionProviderService } from '../services/extensionProvider';
import { getIconPath, OrgBrowserTreeItem } from './orgBrowserNode';
import { MetadataListResultItem } from './types';

/** the request that the queue will process */
type BackgroundFilePresenceCheckRequest = {
  treeItem: OrgBrowserTreeItem;
  c: MetadataListResultItem;
  treeProvider: MetadataTypeTreeProvider;
  parent: OrgBrowserTreeItem;
  originalSpan: AnySpan;
};

/** a queue, not an effect that returns a queue, so that there's only one instance of it */
export const backgroundFilePresenceCheckQueue = Effect.runSync(Queue.unbounded<BackgroundFilePresenceCheckRequest>());

/** the function that processes the queued requests **/
const backgroundFilePresenceCheck = (req: BackgroundFilePresenceCheckRequest): Effect.Effect<void> =>
  Effect.gen(function* () {
    const filePaths = yield* getFilePaths(req.c);
    const iconPath = getIconPath(filePaths.length > 0);
    if (iconPath !== req.treeItem.iconPath) {
      req.treeItem.iconPath = iconPath;
      // Update the tree UI
      req.treeProvider.fireChangeEvent(req.treeItem);
    }
  }).pipe(
    Effect.catchAll(error => {
      console.error(`File presence check failed for ${req.c.type}${req.c.fullName}`, error);
      return Effect.succeed(undefined); // Ignore errors in background job
    }),
    Effect.withSpan('backgroundFilePresenceCheck', {
      attributes: { xmlName: req.parent.xmlName, componentName: req.c.fullName },
      parent: req.originalSpan
    })
  );

const backgroundDaemon = Effect.gen(function* () {
  console.log('backgroundDaemon started');
  console.log('queue size', yield* backgroundFilePresenceCheckQueue.size);

  // eslint-disable-next-line functional/no-loop-statements
  while (true) {
    const item = yield* Queue.take(backgroundFilePresenceCheckQueue);
    yield* Effect.annotateCurrentSpan({ item });
    // fork runs them in the background pretty quickly.  Slower alternative is to run the effect for each queue item
    yield* Effect.fork(backgroundFilePresenceCheck(item));
  }
});

Effect.runSync(Effect.forkDaemon(backgroundDaemon));

// since we can't file search on the web, we'll use ComponentSet to find local file paths for the component
const getFilePaths = (member: MetadataMember): Effect.Effect<string[], Error, never> =>
  ExtensionProviderService.pipe(
    Effect.flatMap(svcProvider => svcProvider.getServicesApi),
    Effect.flatMap(api =>
      Effect.gen(function* () {
        const [projectService, retrieveService] = yield* Effect.all([
          api.services.ProjectService,
          api.services.MetadataRetrieveService
        ]);
        const dirs = (yield* projectService.getSfProject).getPackageDirectories().map(directory => directory.fullPath);
        yield* Effect.annotateCurrentSpan({ packageDirectories: dirs });
        const componentSet = yield* retrieveService.buildComponentSetFromSource([member], dirs);
        yield* Effect.annotateCurrentSpan({ size: componentSet.size });
        const paths = Array.from(componentSet.getSourceComponents()).flatMap(c =>
          [c.xml, c.content].filter(f => f !== undefined)
        );
        yield* Effect.annotateCurrentSpan({ paths });
        return paths;
      }).pipe(Effect.withSpan('getFilePaths', { attributes: { type: member.type, fullName: member.fullName } }))
    ),
    Effect.provide(AllServicesLayer)
  );
