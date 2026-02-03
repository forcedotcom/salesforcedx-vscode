/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ComponentSet,
  DestructiveChangesType,
  RequestStatus,
  SourceComponent,
  type DeployResult,
  type MetadataComponent
} from '@salesforce/source-deploy-retrieve';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import { FsService } from '../vscode/fsService';
import { isSourceComponent } from './componentSetService';
import { MetadataRegistryService } from './metadataRegistryService';

export class MetadataDeleteError extends Data.TaggedError('MetadataDeleteError')<{
  readonly cause?: Error;
}> {}

const isNonDecomposedCustomLabel = (component: MetadataComponent): boolean =>
  component.type.name === 'CustomLabel' && !component.type.strategies?.adapter;

/** Mark components for deletion */
const markComponentsForDeletion = Effect.fn('MetadataDeleteService:markComponentsForDeletion')(function* (
  componentSet: ComponentSet
) {
  const registry = yield* (yield* MetadataRegistryService).getRegistryAccess();
  const deleteSet = new ComponentSet([], registry);

  componentSet
    .toArray()
    .map(c => (isSourceComponent(c) ? c : new SourceComponent({ name: c.fullName, type: c.type })))
    .map(c => {
      deleteSet.add(c, DestructiveChangesType.POST);
    });

  // transfer the props from the original
  deleteSet.projectDirectory = componentSet.projectDirectory;
  deleteSet.apiVersion = componentSet.apiVersion;
  deleteSet.sourceApiVersion = componentSet.sourceApiVersion;
  yield* Effect.annotateCurrentSpan({ deleteSet: deleteSet.toArray().map(c => `${c.type.name}:${c.fullName}`) });
  return deleteSet;
});

/** Delete local files after successful deploy */
const deleteLocalFiles = Effect.fn('MetadataDeleteService:deleteLocalFiles')(function* (
  componentSet: ComponentSet,
  deployResult: DeployResult
) {
  // Only proceed if deploy was successful
  if (deployResult.response?.status !== RequestStatus.Succeeded) {
    return;
  }

  const fsService = yield* FsService;
  const components = componentSet.getSourceComponents().toArray();

  // Handle custom labels specially
  const customLabels = components.filter(isNonDecomposedCustomLabel);
  if (customLabels.length > 0 && isSourceComponent(customLabels[0]) && customLabels[0].xml) {
    const { deleteCustomLabels } = yield* Effect.promise(() => import('@salesforce/source-tracking'));
    yield* Effect.tryPromise({
      try: () => deleteCustomLabels(customLabels[0].xml!, customLabels.filter(isSourceComponent)),
      catch: error => new MetadataDeleteError({ cause: error instanceof Error ? error : new Error(String(error)) })
    });
  }

  // Delete other files
  // Use safeDelete to handle cases where files might not exist (already deleted, wrong paths, etc.)

  yield* Effect.all(
    components
      .filter(isSourceComponent)
      .flatMap(c => [
        ...(c.content ? [fsService.safeDelete(c.content, { recursive: true })] : []),
        ...(c.xml && !isNonDecomposedCustomLabel(c) ? [fsService.safeDelete(c.xml)] : [])
      ]),
    { concurrency: 'unbounded' }
  );
});

export class MetadataDeleteService extends Effect.Service<MetadataDeleteService>()('MetadataDeleteService', {
  succeed: {
    markComponentsForDeletion,
    deleteLocalFiles
  } as const
}) {}
