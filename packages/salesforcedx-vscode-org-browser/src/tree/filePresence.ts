/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { MetadataTypeTreeProvider } from './metadataTypeTreeProviderTypes';
import type { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Queue from 'effect/Queue';
import * as Stream from 'effect/Stream';
import type { AnySpan } from 'effect/Tracer';
import { getIconPath, OrgBrowserTreeItem } from './orgBrowserNode';
import { MetadataListResultItem } from './types';

/** the request that the queue will process */
type BackgroundFilePresenceCheckRequest = {
  treeItem: OrgBrowserTreeItem;
  c: MetadataListResultItem;
  treeProvider: MetadataTypeTreeProvider;
  parent: OrgBrowserTreeItem;
  originalSpan: AnySpan;
  projectComponentSet: ComponentSet;
};

/** a queue, not an effect that returns a queue, so that there's only one instance of it */
export const backgroundFilePresenceCheckQueue = Effect.runSync(Queue.unbounded<BackgroundFilePresenceCheckRequest>());

/** the function that processes the queued requests **/
const backgroundFilePresenceCheck = (req: BackgroundFilePresenceCheckRequest) =>
  Effect.gen(function* () {
    const filePaths = req.projectComponentSet.getComponentFilenamesByNameAndType({
      fullName: req.c.fullName,
      type: req.c.type
    });
    const iconPath = getIconPath(filePaths.length > 0);
    if (iconPath !== req.treeItem.iconPath) {
      req.treeItem.iconPath = iconPath;
      // Update the tree UI
      req.treeProvider.fireChangeEvent(req.treeItem);
    }
  }).pipe(
    Effect.catchAll(error => {
      console.error(`File presence check failed for ${req.c.type}:${req.c.fullName}`, error);
      return Effect.succeed(undefined); // Ignore errors in background job
    }),
    Effect.withSpan('backgroundFilePresenceCheck', {
      attributes: { xmlName: req.parent.xmlName, componentName: req.c.fullName },
      parent: req.originalSpan
    })
  );

Effect.runSync(
  Effect.forkDaemon(
    Stream.fromQueue(backgroundFilePresenceCheckQueue, { maxChunkSize: 1 }).pipe(
      Stream.runForEach(backgroundFilePresenceCheck)
    )
  )
);
