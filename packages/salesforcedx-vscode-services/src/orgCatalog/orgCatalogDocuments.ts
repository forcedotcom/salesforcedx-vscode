/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { FsService } from '../vscode/fsService';
import { OrgCatalogInventory } from './orgCatalogInventory';
import { OrgCatalogRemoteSource } from './orgCatalogRemoteSource';
import { OrgMetadataReferenceService, type OrgMetadataComponentReference } from './orgMetadataReference';

const notFound = (reference: OrgMetadataComponentReference) =>
  vscode.FileSystemError.FileNotFound(`${reference.xmlName}:${reference.fullName}`);

export class OrgCatalogDocuments extends Effect.Service<OrgCatalogDocuments>()('OrgCatalogDocuments', {
  accessors: true,
  dependencies: [
    FsService.Default,
    OrgCatalogInventory.Default,
    OrgCatalogRemoteSource.Default,
    OrgMetadataReferenceService.Default
  ],
  effect: Effect.gen(function* () {
    const [fsService, inventories, remoteSource, references] = yield* Effect.all([
      FsService,
      OrgCatalogInventory,
      OrgCatalogRemoteSource,
      OrgMetadataReferenceService
    ]);
    const documentUri = (orgId: string, reference: OrgMetadataComponentReference) =>
      references.documentUri({ orgId, ...reference });
    const parseDocumentUri = references.parseDocumentUri;
    const getDocumentUri = Effect.fn('OrgCatalogDocuments.getDocumentUri')(function* (
      orgId: string,
      reference: OrgMetadataComponentReference
    ) {
      const presence = yield* inventories.getPresence(orgId, reference);
      if (!presence.inOrg && !presence.inWorkspace) return yield* Effect.fail(notFound(reference));
      return presence.workspaceUri ?? documentUri(orgId, reference);
    });

    const getRemoteDocument = Effect.fn('OrgCatalogDocuments.getRemoteDocument')(function* (
      orgId: string,
      reference: OrgMetadataComponentReference
    ) {
      const entry = yield* inventories.getEntry(orgId, reference);
      if (!entry?.inOrg) return yield* Effect.fail(notFound(reference));
      return {
        reference,
        uri: documentUri(orgId, reference),
        remoteLastModifiedDate: entry.lastModifiedDate
      };
    });

    const read = Effect.fn('OrgCatalogDocuments.read')(function* (
      orgId: string,
      reference: OrgMetadataComponentReference
    ) {
      const presence = yield* inventories.getPresence(orgId, reference);
      if (!presence.inOrg && !presence.inWorkspace) return yield* Effect.fail(notFound(reference));
      if (presence.workspaceUri) {
        return yield* fsService.readFile(presence.workspaceUri);
      }
      const artifact = yield* remoteSource.materializePrimaryDocument(orgId, reference);
      return yield* fsService.readFile(artifact.primaryUri);
    });

    const readDocumentUri = Effect.fn('OrgCatalogDocuments.readDocumentUri')(function* (activeOrgId: string, uri: URI) {
      const location = parseDocumentUri(uri);
      if (location?.orgId !== activeOrgId) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotFound(uri));
      }
      return yield* read(activeOrgId, location);
    });

    const getDocumentReference = Effect.fn('OrgCatalogDocuments.getDocumentReference')(function* (
      activeOrgId: string,
      uri: URI
    ) {
      const location = parseDocumentUri(uri);
      return location?.orgId === activeOrgId ? { xmlName: location.xmlName, fullName: location.fullName } : undefined;
    });

    return { getDocumentReference, getDocumentUri, getRemoteDocument, read, readDocumentUri } as const;
  })
}) {}
