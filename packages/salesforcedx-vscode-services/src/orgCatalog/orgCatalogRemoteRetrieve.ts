/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { ComponentSetService } from '../core/componentSetService';
import { MetadataRetrieveService } from '../core/metadataRetrieveService';
import { FsService } from '../vscode/fsService';
import { OrgMetadataCatalogError } from './orgMetadataCatalogErrors';
import { OrgMetadataReferenceService, type OrgMetadataComponentReference } from './orgMetadataReference';
import { OrgMetadataShadowStore } from './orgMetadataShadowStore';

type RetrieveRequest = {
  readonly reference: OrgMetadataComponentReference;
  readonly expectedRemoteLastModifiedDate?: string;
};

const sourceComponentFilePaths = (sourceComponent?: {
  readonly content?: string;
  readonly xml?: string;
  readonly walkContent: () => string[];
}): readonly string[] => [
  ...(sourceComponent?.content ? [sourceComponent.content] : []),
  ...(sourceComponent?.xml ? [sourceComponent.xml] : []),
  ...(sourceComponent ? [...sourceComponent.walkContent()] : [])
];

export class OrgCatalogRemoteRetrieve extends Effect.Service<OrgCatalogRemoteRetrieve>()('OrgCatalogRemoteRetrieve', {
  accessors: true,
  dependencies: [
    ComponentSetService.Default,
    FsService.Default,
    MetadataRetrieveService.Default,
    OrgMetadataReferenceService.Default,
    OrgMetadataShadowStore.Default
  ],
  effect: Effect.gen(function* () {
    const [componentSetService, fsService, metadataRetrieveService, references, shadowStore] = yield* Effect.all([
      ComponentSetService,
      FsService,
      MetadataRetrieveService,
      OrgMetadataReferenceService,
      OrgMetadataShadowStore
    ]);
    const listStagedFiles = Effect.fn('OrgCatalogRemoteRetrieve.listStagedFiles')(function* (rootUri: URI) {
      const initial: { readonly pending: readonly URI[]; readonly files: readonly URI[] } = {
        pending: [rootUri],
        files: []
      };
      const result = yield* Effect.iterate(initial, {
        while: traversal => traversal.pending.length > 0,
        body: traversal =>
          fsService.readDirectoryWithTypes(traversal.pending[0]!).pipe(
            Effect.map(entries => ({
              pending: [
                ...traversal.pending.slice(1),
                ...entries.filter(entry => (entry.type & vscode.FileType.Directory) !== 0).map(entry => entry.uri)
              ],
              files: [
                ...traversal.files,
                ...entries.filter(entry => (entry.type & vscode.FileType.File) !== 0).map(entry => entry.uri)
              ]
            }))
          )
      });
      yield* Effect.annotateCurrentSpan('stagedFileCount', result.files.length);
      return result.files;
    });

    const sourceBasenames = Effect.fn('OrgCatalogRemoteRetrieve.sourceBasenames')(function* (
      orgId: string,
      reference: OrgMetadataComponentReference
    ) {
      const logicalBasename = Utils.basename(yield* references.documentUri({ orgId, ...reference }));
      const leafName = reference.fullName.split(/[/.]/).at(-1) ?? reference.fullName;
      const suffix = yield* references.getTypeSuffix(reference.xmlName);
      return new Set<string>([
        logicalBasename,
        `${logicalBasename}-meta.xml`,
        ...(suffix ? [`${leafName}.${suffix}`, `${leafName}.${suffix}-meta.xml`] : [])
      ]);
    });

    const materializeOne = Effect.fn('OrgCatalogRemoteRetrieve.materializeOne')(function* (
      orgId: string,
      request: RetrieveRequest
    ) {
      const { reference } = request;
      const { stagingUri } = yield* shadowStore.prepare(orgId, reference, request.expectedRemoteLastModifiedDate);
      const member = { type: reference.xmlName, fullName: reference.fullName };
      const componentSet = yield* metadataRetrieveService.buildComponentSet([member]);
      const nonEmptyComponentSet = yield* componentSetService.ensureNonEmptyComponentSet(componentSet);
      return yield* metadataRetrieveService
        .retrieveComponentSetToDirectory(nonEmptyComponentSet, stagingUri, { expectedOrgId: orgId })
        .pipe(
          Effect.flatMap(result =>
            Effect.gen(function* () {
              const sourceComponent = [...result.components.getSourceComponents()].find(
                component => component.type.name === reference.xmlName && component.fullName === reference.fullName
              );
              const responsePaths = result
                .getFileResponses()
                .flatMap(response => (response.filePath ? [response.filePath] : []));
              const stagedFiles = yield* listStagedFiles(stagingUri);
              const reportedUris = yield* Effect.forEach(
                [...new Set([...result.components.getComponentFilenamesByNameAndType(member), ...responsePaths])],
                path => fsService.toUri(path),
                { concurrency: 'unbounded' }
              );
              const basenames = yield* sourceBasenames(orgId, reference);
              const sourceContentUri = sourceComponent?.content
                ? yield* fsService.toUri(sourceComponent.content)
                : undefined;
              const fileUris = [
                ...new Map([...reportedUris, ...stagedFiles].map(uri => [uri.toString(), uri])).values()
              ];
              const primaryUri =
                fileUris.find(uri => basenames.has(Utils.basename(uri))) ??
                fileUris.find(uri => !uri.path.endsWith('-meta.xml')) ??
                sourceContentUri ??
                fileUris[0];
              yield* Effect.annotateCurrentSpan({
                discoveredFileCount: fileUris.length,
                responsePathCount: responsePaths.length,
                selectedPrimaryPath: primaryUri?.toString()
              });
              if (!primaryUri) {
                return yield* new OrgMetadataCatalogError({
                  cause: new Error('Retrieve completed without a readable source file'),
                  message: `Retrieved ${reference.xmlName} '${reference.fullName}', but no source file was produced`,
                  reference
                });
              }
              const sourceComponentUris = yield* Effect.forEach(
                sourceComponentFilePaths(sourceComponent),
                path => fsService.toUri(path),
                { concurrency: 'unbounded' }
              );
              const artifactFileUris = [
                ...new Map([...fileUris, ...sourceComponentUris].map(uri => [uri.toString(), uri])).values()
              ];
              const fileProperties = Array.isArray(result.response.fileProperties)
                ? result.response.fileProperties
                : [result.response.fileProperties];
              const remoteLastModifiedDate = fileProperties.find(
                property => property?.type === reference.xmlName && property.fullName === reference.fullName
              )?.lastModifiedDate;
              const artifact = yield* shadowStore.publish({
                orgId,
                reference,
                stagingUri,
                primaryUri,
                fileUris: artifactFileUris,
                remoteLastModifiedDate: request.expectedRemoteLastModifiedDate ?? remoteLastModifiedDate
              });
              if (artifact) return artifact;
              return yield* new OrgMetadataCatalogError({
                cause: new Error('Published shadow artifact could not be resolved'),
                message: `Failed to publish ${reference.xmlName} '${reference.fullName}'`,
                reference
              });
            })
          ),
          Effect.ensuring(fsService.safeDelete(stagingUri, { recursive: true }))
        );
    });

    const materializeBatch = Effect.fn('OrgCatalogRemoteRetrieve.materializeBatch')(function* (
      orgId: string,
      requests: readonly RetrieveRequest[]
    ) {
      const stagingUri = yield* shadowStore.prepareBatch(orgId);
      const members = requests.map(({ reference }) => ({ type: reference.xmlName, fullName: reference.fullName }));
      const componentSet = yield* metadataRetrieveService.buildComponentSet(members);
      const nonEmptyComponentSet = yield* componentSetService.ensureNonEmptyComponentSet(componentSet);
      return yield* metadataRetrieveService
        .retrieveComponentSetToDirectory(nonEmptyComponentSet, stagingUri, { expectedOrgId: orgId })
        .pipe(
          Effect.flatMap(result =>
            Effect.gen(function* () {
              const sourceComponents = [...result.components.getSourceComponents()];
              const responses = result.getFileResponses();
              const stagedFiles = yield* listStagedFiles(stagingUri);
              const fileProperties = Array.isArray(result.response.fileProperties)
                ? result.response.fileProperties
                : [result.response.fileProperties];
              return yield* Effect.forEach(
                requests,
                request =>
                  Effect.gen(function* () {
                    const { reference } = request;
                    const member = { type: reference.xmlName, fullName: reference.fullName };
                    const sourceComponent = sourceComponents.find(
                      component =>
                        component.type.name === reference.xmlName && component.fullName === reference.fullName
                    );
                    const responsePaths = responses.flatMap(response =>
                      response.type === reference.xmlName &&
                      response.fullName === reference.fullName &&
                      response.filePath
                        ? [response.filePath]
                        : []
                    );
                    const reportedUris = yield* Effect.forEach(
                      [...new Set([...result.components.getComponentFilenamesByNameAndType(member), ...responsePaths])],
                      path => fsService.toUri(path),
                      { concurrency: 'unbounded' }
                    );
                    const basenames = yield* sourceBasenames(orgId, reference);
                    const discoveredUris = stagedFiles.filter(uri => basenames.has(Utils.basename(uri)));
                    const sourceComponentUris = yield* Effect.forEach(
                      sourceComponentFilePaths(sourceComponent),
                      path => fsService.toUri(path),
                      { concurrency: 'unbounded' }
                    );
                    const fileUris = [
                      ...new Map(
                        [...reportedUris, ...discoveredUris, ...sourceComponentUris].map(uri => [uri.toString(), uri])
                      ).values()
                    ];
                    const primaryUri =
                      fileUris.find(uri => basenames.has(Utils.basename(uri))) ??
                      fileUris.find(uri => !uri.path.endsWith('-meta.xml')) ??
                      fileUris[0];
                    if (!primaryUri) {
                      return yield* new OrgMetadataCatalogError({
                        cause: new Error('Retrieve completed without a readable source file'),
                        message: `Retrieved ${reference.xmlName} '${reference.fullName}', but no source file was produced`,
                        reference
                      });
                    }
                    const remoteLastModifiedDate =
                      request.expectedRemoteLastModifiedDate ??
                      fileProperties.find(
                        property => property?.type === reference.xmlName && property.fullName === reference.fullName
                      )?.lastModifiedDate;
                    const { stagingUri: componentStagingUri } = yield* shadowStore.prepare(
                      orgId,
                      reference,
                      remoteLastModifiedDate
                    );
                    const copiedUris = yield* Effect.forEach(
                      fileUris,
                      uri => {
                        const stagingPrefix = stagingUri.path.endsWith('/') ? stagingUri.path : `${stagingUri.path}/`;
                        const relative = uri.path.startsWith(stagingPrefix)
                          ? uri.path.slice(stagingPrefix.length)
                          : Utils.basename(uri);
                        const targetUri = Utils.joinPath(componentStagingUri, ...relative.split('/'));
                        return fsService.readFile(uri).pipe(
                          Effect.flatMap(content => fsService.safeWriteFile(targetUri, content)),
                          Effect.as([uri.toString(), targetUri] as const)
                        );
                      },
                      { concurrency: 10 }
                    );
                    const copiedBySource = new Map(copiedUris);
                    const copiedPrimaryUri = copiedBySource.get(primaryUri.toString());
                    if (!copiedPrimaryUri) {
                      return yield* Effect.die(
                        new Error(`Failed to stage ${reference.xmlName} '${reference.fullName}'`)
                      );
                    }
                    const artifact = yield* shadowStore.publish({
                      orgId,
                      reference,
                      stagingUri: componentStagingUri,
                      primaryUri: copiedPrimaryUri,
                      fileUris: [...copiedBySource.values()],
                      remoteLastModifiedDate
                    });
                    return artifact
                      ? { reference, artifact }
                      : yield* new OrgMetadataCatalogError({
                          cause: new Error('Published shadow artifact could not be resolved'),
                          message: `Failed to publish ${reference.xmlName} '${reference.fullName}'`,
                          reference
                        });
                  }),
                { concurrency: 1 }
              );
            })
          ),
          Effect.ensuring(fsService.safeDelete(stagingUri, { recursive: true }))
        );
    });

    const materializeRetrievedComponents = Effect.fn('OrgCatalogRemoteRetrieve.materializeComponents')(function* (
      orgId: string,
      requests: readonly RetrieveRequest[]
    ) {
      if (requests.length === 0) return [];
      if (requests.length > 1) return yield* materializeBatch(orgId, requests);
      const request = requests[0]!;
      return [{ reference: request.reference, artifact: yield* materializeOne(orgId, request) }];
    });

    return { materializeRetrievedComponents } as const;
  })
}) {}
