/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  FsService,
  MetadataRegistryService,
  OrgMetadataCatalogError,
  QueryService,
  documentUri,
  type OrgMetadataCatalogInternalEntry,
  type OrgMetadataComponentReference
} from '@salesforce/vscode-services-v2';
import * as Arr from 'effect/Array';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import { isNotUndefined, isString } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import { ServiceOperations, ServiceOperationsLayer } from '../serviceOperations.js';
import { OrgCatalogInventory } from './orgCatalogInventory.js';
import { makeOrgCatalogOrg, type CatalogOrg } from './orgCatalogOrg.js';
import { OrgCatalogRemoteRetrieve } from './orgCatalogRemoteRetrieve.js';
import { OrgMetadataShadowStore } from './orgMetadataShadowStore.js';

const escapeSoql = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
const makeOrgCatalogRemoteSource = Effect.gen(function* () {
  const query = yield* QueryService;
  const fs = yield* FsService;
  const inventory = yield* OrgCatalogInventory;
  const retrieve = yield* OrgCatalogRemoteRetrieve;
  const registry = yield* MetadataRegistryService;
  const shadow = yield* OrgMetadataShadowStore;
  const orgs = yield* makeOrgCatalogOrg;
  const operations = yield* ServiceOperations;
  const fetchApexClass = Effect.fn('OrgCatalogRemoteSource.fetchApexClass')(function* (
    org: CatalogOrg,
    reference: OrgMetadataComponentReference
  ) {
    yield* orgs.validate(org);
    const parts = reference.fullName.split('.');
    const record = yield* query
      .query(
        {
          orgId: org.orgId,
          tooling: true,
          soql: `SELECT Body, LastModifiedDate FROM ApexClass WHERE Name = '${escapeSoql(parts.at(-1) ?? reference.fullName)}'${parts.length > 1 ? ` AND NamespacePrefix = '${escapeSoql(parts.slice(0, -1).join('.'))}'` : ''} LIMIT 1`
        },
        Schema.Struct({
          Body: Schema.String.pipe(Schema.NullOr, Schema.optional),
          LastModifiedDate: Schema.String.pipe(Schema.NullOr, Schema.optional)
        })
      )
      .pipe(
        Effect.flatMap(result => Stream.runCollect(result.records)),
        Effect.flatMap(rows =>
          Option.match(Arr.head(rows), {
            onNone: () =>
              Effect.fail(
                new OrgMetadataCatalogError({
                  reference,
                  message: `Apex class '${reference.fullName}' has no readable source body`,
                  cause: 'Apex class was not returned'
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
            reference,
            message: `Apex class '${reference.fullName}' has no readable source body`,
            cause: 'Apex class body was not returned'
          })
      )
    );
    yield* orgs.validate(org);
    return {
      content: body.includes('(hidden)')
        ? `// Source code for managed class '${reference.fullName}' is protected.`
        : body,
      lastModifiedDate: isString(record.LastModifiedDate) ? record.LastModifiedDate : undefined
    };
  });
  const materializePrimaryDocument = Effect.fn('OrgCatalogRemoteSource.materializePrimaryDocument')(function* (
    org: CatalogOrg,
    reference: OrgMetadataComponentReference
  ) {
    yield* orgs.validate(org);
    const entry = yield* inventory.getEntry(org, reference).pipe(
      Effect.filterOrFail(
        (candidate): candidate is OrgMetadataCatalogInternalEntry => isNotUndefined(candidate) && candidate.inOrg,
        () => vscode.FileSystemError.FileNotFound(`${reference.xmlName}:${reference.fullName}`)
      )
    );
    const cached = yield* shadow.get(org.orgId, reference, entry.lastModifiedDate);
    if (cached) return yield* orgs.commit(org, Effect.succeed(cached));
    if (reference.xmlName !== 'ApexClass') {
      const result = yield* retrieve.materializeRetrievedComponents(
        org.orgId,
        [{ reference, expectedRemoteLastModifiedDate: entry.lastModifiedDate }],
        org.orgGeneration
      );
      return yield* orgs.commit(org, Effect.succeed(result[0]!.artifact));
    }
    const body = yield* fetchApexClass(org, reference);
    const revision = entry.lastModifiedDate ?? body.lastModifiedDate;
    return yield* Effect.acquireUseRelease(
      shadow.prepare(org.orgId, reference, revision),
      prepared =>
        Effect.gen(function* () {
          const primaryUri = Utils.joinPath(
            prepared.stagingUri,
            Utils.basename(
              yield* documentUri({ orgId: org.orgId, ...reference }).pipe(
                Effect.provideService(MetadataRegistryService, registry)
              )
            )
          );
          yield* fs.safeWriteFile(primaryUri, body.content).pipe(Effect.uninterruptible);
          return yield* orgs.commit(
            org,
            shadow
              .publish({
                orgId: org.orgId,
                reference,
                stagingUri: prepared.stagingUri,
                primaryUri,
                fileUris: [primaryUri],
                remoteLastModifiedDate: revision
              })
              .pipe(
                Effect.filterOrFail(
                  isNotUndefined,
                  () =>
                    new OrgMetadataCatalogError({
                      reference,
                      message: `Failed to publish Apex class '${reference.fullName}'`,
                      cause: 'Published shadow artifact could not be resolved'
                    })
                )
              )
          );
        }),
      prepared => fs.safeDelete(prepared.stagingUri, { recursive: true })
    );
  }, operations.run);
  yield* Effect.addFinalizer(() => operations.close);
  return { materializePrimaryDocument };
});
export class OrgCatalogRemoteSource extends Context.Service<
  OrgCatalogRemoteSource,
  Effect.Success<typeof makeOrgCatalogRemoteSource>
>()('@salesforce/vscode-services-v4-implementation/OrgCatalogRemoteSource') {}
export const OrgCatalogRemoteSourceLayer = Layer.effect(OrgCatalogRemoteSource, makeOrgCatalogRemoteSource).pipe(
  Layer.provideMerge(ServiceOperationsLayer)
);
