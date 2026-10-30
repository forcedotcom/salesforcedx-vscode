/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  FsService,
  MetadataRegistryService,
  parseDocumentUri,
  type OrgId,
  type OrgMetadataDocumentLocation
} from '@salesforce/vscode-services-v2';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { isNotUndefined } from 'effect/Predicate';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { ServiceOperations, ServiceOperationsLayer } from '../serviceOperations.js';
import { makeOrgCatalogOrg } from './orgCatalogOrg.js';
import { OrgCatalogRemoteSource } from './orgCatalogRemoteSource.js';

const makeOrgCatalogDocuments = Effect.gen(function* () {
  const fs = yield* FsService;
  const remote = yield* OrgCatalogRemoteSource;
  const registry = yield* MetadataRegistryService;
  const orgs = yield* makeOrgCatalogOrg;
  const operations = yield* ServiceOperations;
  const readDocumentUri = Effect.fn('OrgCatalogDocuments.readDocumentUri')(function* (activeOrgId: OrgId, uri: URI) {
    const org = yield* orgs.capture(activeOrgId);
    const location = yield* parseDocumentUri(uri).pipe(
      Effect.provideService(MetadataRegistryService, registry),
      Effect.filterOrFail(
        (candidate): candidate is OrgMetadataDocumentLocation =>
          isNotUndefined(candidate) && candidate.orgId === activeOrgId,
        () => vscode.FileSystemError.FileNotFound(uri)
      )
    );
    const artifact = yield* remote.materializePrimaryDocument(org, location);
    const content = yield* fs.readFile(artifact.primaryUri);
    return yield* orgs.commit(org, Effect.succeed(content));
  }, operations.run);
  yield* Effect.addFinalizer(() => operations.close);
  return { readDocumentUri };
});
export class OrgCatalogDocuments extends Context.Service<
  OrgCatalogDocuments,
  Effect.Success<typeof makeOrgCatalogDocuments>
>()('@salesforce/vscode-services-v4-implementation/OrgCatalogDocuments') {}
export const OrgCatalogDocumentsLayer = Layer.effect(OrgCatalogDocuments, makeOrgCatalogDocuments).pipe(
  Layer.provideMerge(ServiceOperationsLayer)
);
