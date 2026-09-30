/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgMetadataCatalogInternalEntry as OrgMetadataCatalogEntry } from './orgMetadataCatalogTypes';
import * as Arr from 'effect/Array';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { isNotUndefined, isString } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import { ConnectionService } from '../core/connectionService';
import { QueryService } from '../core/queryService';
import { FsService } from '../vscode/fsService';
import { OrgCatalogInventory } from './orgCatalogInventory';
import { OrgCatalogRemoteRetrieve } from './orgCatalogRemoteRetrieve';
import { OrgMetadataCatalogError } from './orgMetadataCatalogErrors';
import { OrgMetadataReferenceService, type OrgMetadataComponentReference } from './orgMetadataReference';
import { OrgMetadataShadowStore } from './orgMetadataShadowStore';

const escapeSoql = (value: string): string => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");

export class OrgCatalogRemoteSource extends Effect.Service<OrgCatalogRemoteSource>()('OrgCatalogRemoteSource', {
  accessors: true,
  dependencies: [
    ConnectionService.Default,
    QueryService.Default,
    FsService.Default,
    OrgCatalogInventory.Default,
    OrgCatalogRemoteRetrieve.Default,
    OrgMetadataReferenceService.Default,
    OrgMetadataShadowStore.Default
  ],
  effect: Effect.gen(function* () {
    const [queryService, fsService, inventories, remoteRetrieve, references, shadowStore] = yield* Effect.all([
      QueryService,
      FsService,
      OrgCatalogInventory,
      OrgCatalogRemoteRetrieve,
      OrgMetadataReferenceService,
      OrgMetadataShadowStore
    ]);

    const getEntryInOrg = (orgId: string, reference: OrgMetadataComponentReference) =>
      inventories.getEntry(orgId, reference).pipe(
        Effect.filterOrFail(
          (candidateEntry): candidateEntry is OrgMetadataCatalogEntry =>
            isNotUndefined(candidateEntry) && candidateEntry.inOrg,
          () => vscode.FileSystemError.FileNotFound(`${reference.xmlName}:${reference.fullName}`)
        )
      );

    const fetchApexClass = Effect.fn('OrgCatalogRemoteSource.fetchApexClass')(function* (
      orgId: string,
      reference: OrgMetadataComponentReference
    ) {
      const nameParts = reference.fullName.split('.');
      const record = yield* queryService
        .query(
          {
            soql: `SELECT Body, LastModifiedDate FROM ApexClass WHERE Name = '${escapeSoql(nameParts.at(-1) ?? reference.fullName)}'${
              nameParts.length > 1 ? ` AND NamespacePrefix = '${escapeSoql(nameParts.slice(0, -1).join('.'))}'` : ''
            } LIMIT 1`,
            tooling: true,
            orgId
          },
          Schema.Struct({
            Body: Schema.optionalWith(Schema.String, { nullable: true }),
            LastModifiedDate: Schema.optionalWith(Schema.String, { nullable: true })
          })
        )
        .pipe(
          Effect.flatMap(({ records }) => Stream.runCollect(records)),
          Effect.map(Chunk.toReadonlyArray),
          Effect.flatMap(rows =>
            Option.match(Arr.head(rows), {
              onNone: () =>
                Effect.fail(
                  new OrgMetadataCatalogError({
                    cause: new Error('Apex class was not returned'),
                    message: `Apex class '${reference.fullName}' has no readable source body`,
                    reference
                  })
                ),
              onSome: Effect.succeed
            })
          )
        );
      const body = yield* Effect.succeed(record.Body).pipe(
        Effect.filterOrFail(
          Schema.is(Schema.NonEmptyString),
          () =>
            new OrgMetadataCatalogError({
              cause: new Error('Apex class body was not returned'),
              message: `Apex class '${reference.fullName}' has no readable source body`,
              reference
            })
        )
      );
      if (body.includes('(hidden)')) {
        return {
          content: `// Source code for managed class '${reference.fullName}' is protected.`,
          lastModifiedDate: record.LastModifiedDate
        };
      }
      return { content: body, lastModifiedDate: record.LastModifiedDate };
    });

    const materializePrimaryDocument = Effect.fn('OrgCatalogRemoteSource.materializePrimaryDocument')(function* (
      orgId: string,
      reference: OrgMetadataComponentReference
    ) {
      const entry = yield* getEntryInOrg(orgId, reference);
      const cached = yield* shadowStore.get(orgId, reference, entry.lastModifiedDate);
      if (cached) return cached;
      if (reference.xmlName !== 'ApexClass') {
        const [result] = yield* remoteRetrieve.materializeRetrievedComponents(orgId, [
          { reference, expectedRemoteLastModifiedDate: entry.lastModifiedDate }
        ]);
        return result!.artifact;
      }

      const { content, lastModifiedDate } = yield* fetchApexClass(orgId, reference);
      const shadowRevision = isString(entry.lastModifiedDate)
        ? entry.lastModifiedDate
        : isString(lastModifiedDate)
          ? lastModifiedDate
          : undefined;
      const { stagingUri } = yield* shadowStore.prepare(orgId, reference, shadowRevision);
      const primaryUri = Utils.joinPath(
        stagingUri,
        Utils.basename(yield* references.documentUri({ orgId, ...reference }))
      );
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
        Effect.filterOrFail(
          isNotUndefined,
          () =>
            new OrgMetadataCatalogError({
              cause: new Error('Published shadow artifact could not be resolved'),
              message: `Failed to publish Apex class '${reference.fullName}'`,
              reference
            })
        ),
        Effect.ensuring(fsService.safeDelete(stagingUri, { recursive: true }))
      );
    });

    return { materializePrimaryDocument } as const;
  })
}) {}
