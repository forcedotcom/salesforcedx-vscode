/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgMetadataCatalogInternalEntry as OrgMetadataCatalogEntry } from './orgMetadataCatalogTypes';
import type { RetrieveResult } from '@salesforce/source-deploy-retrieve';
import * as Arr from 'effect/Array';
import * as Cache from 'effect/Cache';
import * as Chunk from 'effect/Chunk';
import * as Data from 'effect/Data';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as HashMap from 'effect/HashMap';
import * as Option from 'effect/Option';
import { isNotUndefined, isString } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { ComponentSetService } from '../core/componentSetService';
import { ConnectionService } from '../core/connectionService';
import { MetadataRetrieveService } from '../core/metadataRetrieveService';
import { QueryService } from '../core/queryService';
import { FsService } from '../vscode/fsService';
import { HashableUri } from '../vscode/hashableUri';
import { pathSuffixWithin } from '../vscode/uriComparison';
import { OrgCatalogInventory } from './orgCatalogInventory';
import { OrgMetadataCatalogError } from './orgMetadataCatalogErrors';
import {
  OrgMetadataReferenceService,
  type OrgMetadataComponentReference,
  type OrgMetadataDocumentLocation
} from './orgMetadataReference';
import { OrgMetadataShadowStore } from './orgMetadataShadowStore';

const escapeSoql = (value: string): string => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");

type RetrieveRequest = {
  readonly reference: OrgMetadataComponentReference;
  readonly expectedRemoteLastModifiedDate?: string;
};

type PrimaryDocumentCacheKey = {
  readonly orgId: string;
  readonly xmlName: string;
  readonly fullName: string;
  readonly remoteLastModifiedDate: string | undefined;
};

const uniqueHashableUris = (uris: readonly URI[]): readonly HashableUri[] => Arr.dedupe(uris.map(HashableUri.fromUri));

const findPrimaryUri = (fileUris: readonly HashableUri[], basenames: ReadonlySet<string>) =>
  fileUris.find(uri => basenames.has(Utils.basename(uri.uri))) ??
  fileUris.find(uri => !uri.uri.path.endsWith('-meta.xml'));

const remoteLastModifiedDateFor = (result: RetrieveResult, request: RetrieveRequest) =>
  request.expectedRemoteLastModifiedDate ??
  (Array.isArray(result.response.fileProperties)
    ? result.response.fileProperties
    : [result.response.fileProperties]
  ).find(property => property?.type === request.reference.xmlName && property.fullName === request.reference.fullName)
    ?.lastModifiedDate;

const sourceComponentFilePaths = (sourceComponent?: {
  readonly content?: string;
  readonly xml?: string;
  readonly walkContent: () => string[];
}): readonly string[] => [
  ...(sourceComponent?.content ? [sourceComponent.content] : []),
  ...(sourceComponent?.xml ? [sourceComponent.xml] : []),
  ...(sourceComponent ? [...sourceComponent.walkContent()] : [])
];

const missingSourceFile = (reference: OrgMetadataComponentReference) =>
  new OrgMetadataCatalogError({
    cause: new Error('Retrieve completed without a readable source file'),
    message: `Retrieved ${reference.xmlName} '${reference.fullName}', but no source file was produced`,
    reference
  });

export class OrgCatalogRemoteSource extends Effect.Service<OrgCatalogRemoteSource>()('OrgCatalogRemoteSource', {
  accessors: true,
  dependencies: [
    ComponentSetService.Default,
    ConnectionService.Default,
    MetadataRetrieveService.Default,
    QueryService.Default,
    FsService.Default,
    OrgCatalogInventory.Default,
    OrgMetadataReferenceService.Default,
    OrgMetadataShadowStore.Default
  ],
  effect: Effect.gen(function* () {
    const [
      componentSetService,
      metadataRetrieveService,
      queryService,
      fsService,
      inventories,
      references,
      shadowStore
    ] = yield* Effect.all([
      ComponentSetService,
      MetadataRetrieveService,
      QueryService,
      FsService,
      OrgCatalogInventory,
      OrgMetadataReferenceService,
      OrgMetadataShadowStore
    ]);
    const materializationSemaphore = yield* Effect.makeSemaphore(1);

    const getEntryInOrg = (orgId: string, reference: OrgMetadataComponentReference) =>
      inventories.getEntry(orgId, reference).pipe(
        Effect.filterOrFail(
          (candidateEntry): candidateEntry is OrgMetadataCatalogEntry =>
            isNotUndefined(candidateEntry) && candidateEntry.inOrg,
          () => vscode.FileSystemError.FileNotFound(`${reference.xmlName}:${reference.fullName}`)
        )
      );

    const listStagedFiles = Effect.fn('OrgCatalogRemoteSource.listStagedFiles')(function* (rootUri: URI) {
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

    const sourceBasenames = Effect.fn('OrgCatalogRemoteSource.sourceBasenames')(function* (
      orgId: string,
      reference: OrgMetadataComponentReference
    ) {
      const logicalBasename = Utils.basename(yield* references.documentUri({ orgId, ...reference }));
      const leafName = reference.fullName.split(/[/.]/).at(-1) ?? reference.fullName;
      return yield* references
        .getTypeSuffix(reference.xmlName)
        .pipe(
          Effect.map(
            suffix =>
              new Set<string>([
                logicalBasename,
                `${logicalBasename}-meta.xml`,
                ...(suffix ? [`${leafName}.${suffix}`, `${leafName}.${suffix}-meta.xml`] : [])
              ])
          )
        );
    });

    const retrieveToDirectory = Effect.fn('OrgCatalogRemoteSource.retrieveToDirectory')(function* (
      orgId: string,
      stagingUri: URI,
      members: Parameters<typeof metadataRetrieveService.buildComponentSet>[0]
    ) {
      return yield* metadataRetrieveService.buildComponentSet(members).pipe(
        Effect.flatMap(componentSetService.ensureNonEmptyComponentSet),
        Effect.flatMap(componentSet =>
          metadataRetrieveService.retrieveComponentSetToDirectory(componentSet, stagingUri, { expectedOrgId: orgId })
        )
      );
    });

    const reportedFileUris = Effect.fn('OrgCatalogRemoteSource.reportedFileUris')((paths: readonly string[]) =>
      Effect.forEach(Arr.dedupe(paths), path => fsService.toUri(path), { concurrency: 'unbounded' })
    );

    const publishRetrievedArtifact = Effect.fn('OrgCatalogRemoteSource.publishRetrievedArtifact')(
      (input: Parameters<typeof shadowStore.publish>[0]) =>
        shadowStore.publish(input).pipe(
          Effect.filterOrFail(
            isNotUndefined,
            () =>
              new OrgMetadataCatalogError({
                cause: new Error('Published shadow artifact could not be resolved'),
                message: `Failed to publish ${input.reference.xmlName} '${input.reference.fullName}'`,
                reference: input.reference
              })
          )
        )
    );

    const materializeOne = Effect.fn('OrgCatalogRemoteSource.materializeOne')(function* (
      orgId: string,
      request: RetrieveRequest
    ) {
      const { reference } = request;
      const { stagingUri } = yield* shadowStore.prepare(orgId, reference, request.expectedRemoteLastModifiedDate);
      return yield* retrieveToDirectory(orgId, stagingUri, [
        { type: reference.xmlName, fullName: reference.fullName }
      ]).pipe(
        Effect.flatMap(result =>
          Effect.gen(function* () {
            const sourceComponent = [...result.components.getSourceComponents()].find(
              component => component.type.name === reference.xmlName && component.fullName === reference.fullName
            );
            const responsePaths = result
              .getFileResponses()
              .flatMap(response => (response.filePath ? [response.filePath] : []));
            const fileUris = yield* Effect.all(
              [
                reportedFileUris([
                  ...result.components.getComponentFilenamesByNameAndType({
                    type: reference.xmlName,
                    fullName: reference.fullName
                  }),
                  ...responsePaths
                ]),
                listStagedFiles(stagingUri)
              ],
              { concurrency: 'unbounded' }
            ).pipe(Effect.map(([reportedUris, stagedFiles]) => uniqueHashableUris([...reportedUris, ...stagedFiles])));
            const primaryUri = yield* Effect.all(
              [
                sourceBasenames(orgId, reference),
                sourceComponent?.content
                  ? fsService.toUri(sourceComponent.content).pipe(Effect.map(Option.some))
                  : Effect.succeed(Option.none<URI>())
              ],
              { concurrency: 'unbounded' }
            ).pipe(
              Effect.map(
                ([basenames, sourceContentUri]) =>
                  findPrimaryUri(fileUris, basenames) ??
                  Option.getOrUndefined(Option.map(sourceContentUri, HashableUri.fromUri)) ??
                  fileUris[0]
              )
            );
            yield* Effect.annotateCurrentSpan({
              discoveredFileCount: fileUris.length,
              responsePathCount: responsePaths.length,
              selectedPrimaryPath: primaryUri?.uri.toString()
            });
            if (!primaryUri) return yield* missingSourceFile(reference);
            return yield* Effect.forEach(sourceComponentFilePaths(sourceComponent), path => fsService.toUri(path), {
              concurrency: 'unbounded'
            }).pipe(
              Effect.flatMap(sourceComponentUris =>
                publishRetrievedArtifact({
                  orgId,
                  reference,
                  stagingUri,
                  primaryUri: primaryUri.uri,
                  fileUris: Arr.dedupe([...fileUris, ...sourceComponentUris.map(HashableUri.fromUri)]).map(
                    uri => uri.uri
                  ),
                  remoteLastModifiedDate: remoteLastModifiedDateFor(result, request)
                })
              )
            );
          })
        ),
        Effect.ensuring(fsService.safeDelete(stagingUri, { recursive: true }))
      );
    });

    const materializeBatch = Effect.fn('OrgCatalogRemoteSource.materializeBatch')(
      (orgId: string, requests: readonly RetrieveRequest[]) =>
        Effect.acquireUseRelease(
          shadowStore.prepareBatch(orgId),
          stagingUri =>
            Effect.gen(function* () {
              const result = yield* retrieveToDirectory(
                orgId,
                stagingUri,
                requests.map(({ reference }) => ({ type: reference.xmlName, fullName: reference.fullName }))
              );
              const sourceComponents = [...result.components.getSourceComponents()];
              const responses = result.getFileResponses();
              const stagedFiles = yield* listStagedFiles(stagingUri);
              return yield* Effect.forEach(
                requests,
                request =>
                  Effect.gen(function* () {
                    const { reference } = request;
                    const { fileUris, primaryUri } = yield* Effect.all(
                      [
                        reportedFileUris([
                          ...result.components.getComponentFilenamesByNameAndType({
                            type: reference.xmlName,
                            fullName: reference.fullName
                          }),
                          ...responses.flatMap(response =>
                            response.type === reference.xmlName &&
                            response.fullName === reference.fullName &&
                            response.filePath
                              ? [response.filePath]
                              : []
                          )
                        ]),
                        sourceBasenames(orgId, reference),
                        Effect.forEach(
                          sourceComponentFilePaths(
                            sourceComponents.find(
                              component =>
                                component.type.name === reference.xmlName && component.fullName === reference.fullName
                            )
                          ),
                          path => fsService.toUri(path),
                          { concurrency: 'unbounded' }
                        )
                      ],
                      { concurrency: 'unbounded' }
                    ).pipe(
                      Effect.map(([reportedUris, basenames, sourceComponentUris]) => {
                        const componentFileUris = uniqueHashableUris([
                          ...reportedUris,
                          ...stagedFiles.filter(uri => basenames.has(Utils.basename(uri))),
                          ...sourceComponentUris
                        ]);
                        return {
                          fileUris: componentFileUris,
                          primaryUri: findPrimaryUri(componentFileUris, basenames) ?? componentFileUris[0]
                        };
                      })
                    );
                    if (!primaryUri) return yield* missingSourceFile(reference);
                    const remoteLastModifiedDate = remoteLastModifiedDateFor(result, request);
                    const { stagingUri: componentStagingUri } = yield* shadowStore.prepare(
                      orgId,
                      reference,
                      remoteLastModifiedDate
                    );
                    const copiedUris = yield* Effect.forEach(
                      fileUris,
                      hashable => {
                        const uri = hashable.uri;
                        const relative = pathSuffixWithin(stagingUri, uri) ?? Utils.basename(uri);
                        const targetUri = Utils.joinPath(componentStagingUri, ...relative.split('/'));
                        return fsService.readFile(uri).pipe(
                          Effect.flatMap(content => fsService.safeWriteFile(targetUri, content)),
                          Effect.as([hashable, targetUri] as const)
                        );
                      },
                      { concurrency: 10 }
                    );
                    return yield* Option.match(HashMap.get(HashMap.fromIterable(copiedUris), primaryUri), {
                      onNone: () =>
                        Effect.fail(
                          new OrgMetadataCatalogError({
                            cause: new Error(`Failed to stage ${reference.xmlName} '${reference.fullName}'`),
                            message: `Failed to stage ${reference.xmlName} '${reference.fullName}'`,
                            reference
                          })
                        ),
                      onSome: copiedPrimaryUri =>
                        publishRetrievedArtifact({
                          orgId,
                          reference,
                          stagingUri: componentStagingUri,
                          primaryUri: copiedPrimaryUri,
                          fileUris: copiedUris.map(([, targetUri]) => targetUri),
                          remoteLastModifiedDate
                        }).pipe(Effect.map(artifact => ({ reference, artifact })))
                    });
                  }),
                { concurrency: 1 }
              );
            }),
          stagingUri => fsService.safeDelete(stagingUri, { recursive: true })
        )
    );

    const materializeRetrievedComponents = Effect.fn('OrgCatalogRemoteSource.materializeComponents')(function* (
      orgId: string,
      requests: readonly RetrieveRequest[]
    ) {
      if (requests.length === 0) return [];
      return yield* (
        requests.length > 1
          ? materializeBatch(orgId, requests)
          : materializeOne(orgId, requests[0]!).pipe(
              Effect.map(artifact => [{ reference: requests[0]!.reference, artifact }])
            )
      ).pipe(materializationSemaphore.withPermits(1));
    });

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

    const materializePrimaryDocumentOnMiss = Effect.fn('OrgCatalogRemoteSource.materializePrimaryDocumentOnMiss')(
      function* (orgId: string, reference: OrgMetadataComponentReference, remoteLastModifiedDate?: string) {
        if (reference.xmlName !== 'ApexClass') {
          return yield* materializeOne(orgId, { reference, expectedRemoteLastModifiedDate: remoteLastModifiedDate });
        }

        const { content, lastModifiedDate } = yield* fetchApexClass(orgId, reference);
        const shadowRevision = isString(remoteLastModifiedDate)
          ? remoteLastModifiedDate
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
      }
    );

    const lookupPrimaryDocument = Effect.fn('OrgCatalogRemoteSource.lookupPrimaryDocument')(function* (
      key: PrimaryDocumentCacheKey
    ) {
      const reference = { xmlName: key.xmlName, fullName: key.fullName };
      const cached = yield* shadowStore.get(key.orgId, reference, key.remoteLastModifiedDate);
      if (cached) return cached;

      return yield* Effect.gen(function* () {
        const currentEntry = yield* getEntryInOrg(key.orgId, reference);
        const currentCached = yield* shadowStore.get(key.orgId, reference, currentEntry.lastModifiedDate);
        if (currentCached) return currentCached;
        return yield* materializePrimaryDocumentOnMiss(key.orgId, reference, currentEntry.lastModifiedDate);
      }).pipe(materializationSemaphore.withPermits(1));
    });

    // Coalesce concurrent reads of one document; the shadow store remains the durable cache.
    const primaryDocumentCache = yield* Cache.makeWith({
      capacity: 1000,
      timeToLive: () => Duration.zero,
      lookup: lookupPrimaryDocument
    });

    const materializePrimaryDocument = Effect.fn('OrgCatalogRemoteSource.materializePrimaryDocument')(function* (
      orgId: string,
      reference: OrgMetadataComponentReference
    ) {
      return yield* getEntryInOrg(orgId, reference).pipe(
        Effect.flatMap(entry =>
          primaryDocumentCache.get(Data.struct({ orgId, ...reference, remoteLastModifiedDate: entry.lastModifiedDate }))
        )
      );
    });

    const readDocumentUri = Effect.fn('OrgCatalogRemoteSource.readDocumentUri')(function* (
      activeOrgId: string,
      uri: URI
    ) {
      const location = yield* references.parseDocumentUri(uri).pipe(
        Effect.filterOrFail(
          (candidateLocation): candidateLocation is OrgMetadataDocumentLocation =>
            isNotUndefined(candidateLocation) && candidateLocation.orgId === activeOrgId,
          () => vscode.FileSystemError.FileNotFound(uri)
        )
      );
      return yield* materializePrimaryDocument(activeOrgId, location).pipe(
        Effect.flatMap(artifact => fsService.readFile(artifact.primaryUri))
      );
    });

    return { materializePrimaryDocument, materializeRetrievedComponents, readDocumentUri } as const;
  })
}) {}
