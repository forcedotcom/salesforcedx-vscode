/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgMetadataCatalogEntry, OrgMetadataConsistency } from './orgMetadataCatalogTypes';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import { ConnectionService } from '../core/connectionService';
import { unknownToErrorCause } from '../core/shared';
import { FsService } from '../vscode/fsService';
import { OrgCatalogInventory } from './orgCatalogInventory';
import { componentIdentity, typeCacheKey } from './orgCatalogKeys';
import { OrgCatalogRemoteRetrieve } from './orgCatalogRemoteRetrieve';
import { OrgCatalogState } from './orgCatalogState';
import { OrgMetadataCatalogError } from './orgMetadataCatalogErrors';
import { OrgMetadataReferenceService, type OrgMetadataComponentReference } from './orgMetadataReference';
import { OrgMetadataShadowStore, type OrgMetadataShadowArtifact } from './orgMetadataShadowStore';

const escapeSoql = (value: string): string => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");

export class OrgCatalogRemoteSource extends Effect.Service<OrgCatalogRemoteSource>()('OrgCatalogRemoteSource', {
  accessors: true,
  dependencies: [
    ConnectionService.Default,
    FsService.Default,
    OrgCatalogInventory.Default,
    OrgCatalogRemoteRetrieve.Default,
    OrgCatalogState.Default,
    OrgMetadataReferenceService.Default,
    OrgMetadataShadowStore.Default
  ],
  effect: Effect.gen(function* () {
    const [connectionService, fsService, inventories, remoteRetrieve, state, references, shadowStore] =
      yield* Effect.all([
        ConnectionService,
        FsService,
        OrgCatalogInventory,
        OrgCatalogRemoteRetrieve,
        OrgCatalogState,
        OrgMetadataReferenceService,
        OrgMetadataShadowStore
      ]);
    const documentUri = (orgId: string, reference: OrgMetadataComponentReference) =>
      references.documentUri({ orgId, ...reference });
    const materializeSemaphore = yield* Effect.makeSemaphore(1);

    const fetchApexClass = Effect.fn('OrgCatalogRemoteSource.fetchApexClass')(function* (
      orgId: string,
      reference: OrgMetadataComponentReference
    ) {
      const connection = yield* connectionService.getConnectionForOrg(orgId);
      const nameParts = reference.fullName.split('.');
      const className = nameParts.at(-1) ?? reference.fullName;
      const namespace = nameParts.length > 1 ? nameParts.slice(0, -1).join('.') : undefined;
      const namespaceFilter = namespace ? ` AND NamespacePrefix = '${escapeSoql(namespace)}'` : '';
      const query = `SELECT Body, LastModifiedDate FROM ApexClass WHERE Name = '${escapeSoql(className)}'${namespaceFilter} LIMIT 1`;
      const result = yield* Effect.tryPromise({
        try: () => connection.tooling.query<{ Body?: string; LastModifiedDate?: string }>(query),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new OrgMetadataCatalogError({
            cause,
            message: `Failed to retrieve Apex class '${reference.fullName}': ${cause.message}`,
            reference
          });
        }
      });
      const record = result.records[0];
      const body = record?.Body;
      if (body?.includes('(hidden)')) {
        return {
          content: `// Source code for managed class '${reference.fullName}' is protected.`,
          lastModifiedDate: record?.LastModifiedDate
        };
      }
      if (body) return { content: body, lastModifiedDate: record?.LastModifiedDate };
      return yield* new OrgMetadataCatalogError({
        cause: new Error('Apex class body was not returned'),
        message: `Apex class '${reference.fullName}' has no readable source body`,
        reference
      });
    });

    const materializePrimaryDocument = Effect.fn('OrgCatalogRemoteSource.materializePrimaryDocument')(function* (
      orgId: string,
      reference: OrgMetadataComponentReference
    ) {
      const entry = yield* inventories.getEntry(orgId, reference);
      if (!entry?.inOrg) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotFound(`${reference.xmlName}:${reference.fullName}`));
      }
      const cached = yield* shadowStore.get(orgId, reference, entry.lastModifiedDate);
      if (cached) return cached;
      if (reference.xmlName !== 'ApexClass') {
        const [result] = yield* remoteRetrieve.materializeRetrievedComponents(orgId, [
          { reference, expectedRemoteLastModifiedDate: entry.lastModifiedDate }
        ]);
        return result!.artifact;
      }

      const { content, lastModifiedDate } = yield* fetchApexClass(orgId, reference);
      const shadowRevision = entry.lastModifiedDate ?? lastModifiedDate;
      const { stagingUri } = yield* shadowStore.prepare(orgId, reference, shadowRevision);
      const primaryUri = Utils.joinPath(stagingUri, Utils.basename(documentUri(orgId, reference)));
      return yield* fsService.safeWriteFile(primaryUri, content).pipe(
        Effect.flatMap(() =>
          shadowStore.publish({
            orgId,
            reference,
            stagingUri,
            primaryUri,
            fileUris: [primaryUri],
            remoteLastModifiedDate: shadowRevision
          })
        ),
        Effect.flatMap(artifact =>
          artifact
            ? Effect.succeed(artifact)
            : Effect.fail(
                new OrgMetadataCatalogError({
                  cause: new Error('Published shadow artifact could not be resolved'),
                  message: `Failed to publish Apex class '${reference.fullName}'`,
                  reference
                })
              )
        ),
        Effect.ensuring(fsService.safeDelete(stagingUri, { recursive: true }))
      );
    });

    const materializeRemoteSources = Effect.fn('OrgCatalogRemoteSource.materializeRemoteSources')(function* (
      orgId: string,
      componentReferences: readonly OrgMetadataComponentReference[],
      options: { readonly consistency?: OrgMetadataConsistency } = {}
    ) {
      return yield* materializeSemaphore.withPermits(1)(
        Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan('consistency', options.consistency ?? 'cache-first');
          const forceRefresh = options.consistency === 'refresh';
          const uniqueReferences = [
            ...componentReferences
              .reduce(
                (map, reference) => map.set(componentIdentity(reference), reference),
                new Map<string, OrgMetadataComponentReference>()
              )
              .values()
          ];
          const resolved = yield* Effect.forEach(
            uniqueReferences,
            reference =>
              Effect.gen(function* () {
                const loadedEntry = (yield* state.getInventory(orgId, reference.xmlName))?.components.get(
                  reference.fullName
                );
                const entry = forceRefresh ? loadedEntry : yield* inventories.getEntry(orgId, reference);
                if (!forceRefresh && !entry?.inOrg) {
                  return yield* Effect.fail(
                    vscode.FileSystemError.FileNotFound(`${reference.xmlName}:${reference.fullName}`)
                  );
                }
                const artifact = forceRefresh
                  ? undefined
                  : yield* shadowStore.get(orgId, reference, entry?.lastModifiedDate);
                return { reference, entry, artifact };
              }),
            { concurrency: 10 }
          );
          const retrievalRequests = resolved.flatMap(({ reference, entry, artifact }) =>
            artifact
              ? []
              : [{ reference, expectedRemoteLastModifiedDate: forceRefresh ? undefined : entry?.lastModifiedDate }]
          );
          const retrieved = yield* remoteRetrieve.materializeRetrievedComponents(orgId, retrievalRequests);
          const artifactByIdentity = new Map<string, OrgMetadataShadowArtifact>([
            ...resolved.flatMap(({ reference, artifact }) =>
              artifact ? [[componentIdentity(reference), artifact] as const] : []
            ),
            ...retrieved.map(({ reference, artifact }) => [componentIdentity(reference), artifact] as const)
          ]);
          yield* Effect.annotateCurrentSpan({
            requestedComponentCount: componentReferences.length,
            uniqueComponentCount: uniqueReferences.length,
            cacheHitCount: resolved.length - retrievalRequests.length,
            retrievedComponentCount: retrievalRequests.length
          });

          if (forceRefresh && retrieved.length > 0) {
            const observedAt = new Date().toISOString();
            yield* state.updateInventories(current => {
              const next = new Map(current);
              retrieved.forEach(({ reference, artifact }) => {
                const key = typeCacheKey(orgId, reference.xmlName);
                const inventory = next.get(key);
                if (!inventory) return;
                const currentEntry = inventory.components.get(reference.fullName);
                const remoteLastModifiedDate = artifact.remoteLastModifiedDate;
                const updatedEntry: OrgMetadataCatalogEntry = {
                  ...currentEntry,
                  orgId,
                  observedAt,
                  provenance: currentEntry?.inWorkspace ? 'metadata-api+workspace' : 'metadata-api',
                  reference,
                  documentUri: documentUri(orgId, reference),
                  name: currentEntry?.name ?? reference.fullName.split('/').at(-1) ?? reference.fullName,
                  kind: 'component',
                  inOrg: true,
                  inWorkspace: currentEntry?.inWorkspace ?? false,
                  lastModifiedDate: remoteLastModifiedDate ?? currentEntry?.lastModifiedDate,
                  remoteLastModifiedDate: remoteLastModifiedDate ?? currentEntry?.remoteLastModifiedDate
                };
                next.set(key, {
                  ...inventory,
                  observedAt,
                  components: new Map(inventory.components).set(reference.fullName, updatedEntry)
                });
              });
              return next;
            });
            yield* state.queuePersist(orgId);
          }
          return yield* Effect.forEach(uniqueReferences, reference => {
            const artifact = artifactByIdentity.get(componentIdentity(reference));
            return artifact
              ? Effect.succeed({ reference, artifact })
              : Effect.die(
                  new Error(`No shadow artifact was produced for ${reference.xmlName} '${reference.fullName}'`)
                );
          });
        })
      );
    });

    const materializeRemoteSource = Effect.fn('OrgCatalogRemoteSource.materializeRemoteSource')(function* (
      orgId: string,
      reference: OrgMetadataComponentReference,
      options: { readonly consistency?: OrgMetadataConsistency } = {}
    ) {
      const [materialized] = yield* materializeRemoteSources(orgId, [reference], options);
      return materialized
        ? materialized.artifact
        : yield* Effect.die(
            new Error(`No shadow artifact was produced for ${reference.xmlName} '${reference.fullName}'`)
          );
    });

    return { materializePrimaryDocument, materializeRemoteSource, materializeRemoteSources } as const;
  })
}) {}
