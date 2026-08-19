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
import { OrgCatalogRemoteSource } from './orgCatalogRemoteSource';
import { OrgMetadataReferenceService } from './orgMetadataReference';

export class OrgCatalogDocuments extends Effect.Service<OrgCatalogDocuments>()('OrgCatalogDocuments', {
  accessors: true,
  dependencies: [FsService.Default, OrgCatalogRemoteSource.Default, OrgMetadataReferenceService.Default],
  effect: Effect.gen(function* () {
    const [fsService, remoteSource, references] = yield* Effect.all([
      FsService,
      OrgCatalogRemoteSource,
      OrgMetadataReferenceService
    ]);
    const parseDocumentUri = references.parseDocumentUri;

    const readDocumentUri = Effect.fn('OrgCatalogDocuments.readDocumentUri')(function* (activeOrgId: string, uri: URI) {
      const location = parseDocumentUri(uri);
      if (location?.orgId !== activeOrgId) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotFound(uri));
      }
      const artifact = yield* remoteSource.materializePrimaryDocument(activeOrgId, location);
      return yield* fsService.readFile(artifact.primaryUri);
    });

    return { readDocumentUri } as const;
  })
}) {}
