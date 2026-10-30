/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ComponentSet,
  DestructiveChangesType,
  SourceComponent,
  type MetadataComponent
} from '@salesforce/source-deploy-retrieve';
import { deleteCustomLabels } from '@salesforce/source-tracking';
import {
  FsService,
  MetadataDeleteError,
  MetadataDeleteService,
  MetadataRegistryService
} from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { unknownToErrorCause } from './errorCause.js';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';

const isNonDecomposedCustomLabel = (component: MetadataComponent): boolean =>
  component.type.name === 'CustomLabel' && !component.type.strategies?.adapter;

export const MetadataDeleteServiceLayer = Layer.effect(
  MetadataDeleteService,
  Effect.gen(function* () {
    const registry = yield* MetadataRegistryService;
    const fs = yield* FsService;
    const operations = yield* ServiceOperations;
    const markComponentsForDeletion = Effect.fn('MetadataDeleteService.markComponentsForDeletion')(function* (
      components: ComponentSet
    ) {
      const deleted = new ComponentSet([], yield* registry.getRegistryAccess());
      Array.from(components).forEach(component =>
        deleted.add(
          component instanceof SourceComponent
            ? component
            : new SourceComponent({ name: component.fullName, type: component.type }),
          DestructiveChangesType.POST
        )
      );
      deleted.projectDirectory = components.projectDirectory;
      deleted.apiVersion = components.apiVersion;
      deleted.sourceApiVersion = components.sourceApiVersion;
      yield* Effect.annotateCurrentSpan({ componentCount: deleted.size });
      return deleted;
    }, operations.run);
    const deleteLocalFiles = Effect.fn('MetadataDeleteService.deleteLocalFiles')(function* (components: ComponentSet) {
      const source = components.getSourceComponents().toArray();
      const labels = source.filter(isNonDecomposedCustomLabel);
      const labelXml = labels[0]?.xml;
      if (labelXml)
        yield* Effect.tryPromise({
          try: () => deleteCustomLabels(labelXml, labels),
          catch: cause =>
            new MetadataDeleteError({
              message: `Failed to delete custom labels: ${unknownToErrorCause(cause).message}`,
              cause
            })
        }).pipe(Effect.uninterruptible);
      yield* Effect.forEach(
        source.flatMap(component => [
          ...(component.content ? [fs.safeDelete(component.content, { recursive: true })] : []),
          ...(component.xml && !isNonDecomposedCustomLabel(component) ? [fs.safeDelete(component.xml)] : [])
        ]),
        mutation => mutation.pipe(Effect.uninterruptible),
        { concurrency: 'unbounded', discard: true }
      );
    }, operations.run);
    yield* Effect.addFinalizer(() => operations.close);
    return MetadataDeleteService.of({ markComponentsForDeletion, deleteLocalFiles });
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));
