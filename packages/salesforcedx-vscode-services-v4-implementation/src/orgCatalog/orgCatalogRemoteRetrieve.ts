/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ComponentSetService,
  ConnectionService,
  FsService,
  HashableUri,
  InactiveOrgOperationError,
  MetadataRegistryService,
  MetadataRetrieveService,
  OrgMetadataCatalogError,
  authFieldsFromConnection,
  documentUri,
  getTypeSuffix,
  type FsServiceError,
  type OrgId,
  type OrgMetadataComponentReference
} from '@salesforce/vscode-services-v2';
import { isUriEqualOrWithin, pathSuffixWithin } from '@salesforce/vscode-services-v2/uriComparison';
import * as Arr from 'effect/Array';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as vscode from 'vscode';
import { type URI, Utils } from 'vscode-uri';
import { ConnectionHost } from '../connectionHost.js';
import { ServiceOperations, ServiceOperationsLayer } from '../serviceOperations.js';
import { OrgChanges } from '../targetOrgRef.js';
import { OrgMetadataShadowStore } from './orgMetadataShadowStore.js';

type RetrieveRequest = {
  readonly reference: OrgMetadataComponentReference;
  readonly expectedRemoteLastModifiedDate?: string;
};
const sameMember = (left: { readonly type: string; readonly fullName: string }, right: OrgMetadataComponentReference) =>
  left.type.toLowerCase() === right.xmlName.toLowerCase() &&
  left.fullName.toLowerCase() === right.fullName.toLowerCase();
const makeOrgCatalogRemoteRetrieve = Effect.gen(function* () {
  const componentsService = yield* ComponentSetService;
  const fs = yield* FsService;
  const retrieve = yield* MetadataRetrieveService;
  const registry = yield* MetadataRegistryService;
  const shadow = yield* OrgMetadataShadowStore;
  const changes = yield* OrgChanges;
  const connections = yield* ConnectionService;
  const host = yield* ConnectionHost;
  const operations = yield* ServiceOperations;
  const listStagedFiles = Effect.fn('OrgCatalogRemoteRetrieve.listStagedFiles')(function* (
    root: URI
  ): Effect.fn.Return<URI[], FsServiceError> {
    const entries = yield* fs.readDirectoryWithTypes(root);
    const nested = yield* Effect.forEach(
      entries.filter(entry => (entry.type & vscode.FileType.Directory) !== 0),
      entry => listStagedFiles(entry.uri),
      { concurrency: 10 }
    );
    return [
      ...entries.filter(entry => (entry.type & vscode.FileType.File) !== 0).map(entry => entry.uri),
      ...nested.flat()
    ];
  });
  const sourceBasenames = Effect.fn('OrgCatalogRemoteRetrieve.sourceBasenames')(function* (
    orgId: OrgId,
    reference: OrgMetadataComponentReference
  ) {
    const logicalName = Utils.basename(
      yield* documentUri({ orgId, ...reference }).pipe(Effect.provideService(MetadataRegistryService, registry))
    );
    const leaf = reference.fullName.split(/[/.]/).at(-1) ?? reference.fullName;
    const suffix = yield* getTypeSuffix(reference.xmlName).pipe(
      Effect.provideService(MetadataRegistryService, registry)
    );
    return new Set([
      logicalName,
      `${logicalName}-meta.xml`,
      ...(suffix ? [`${leaf}.${suffix}`, `${leaf}.${suffix}-meta.xml`] : [])
    ]);
  });
  const materializeRetrievedComponents = Effect.fn('OrgCatalogRemoteRetrieve.materializeComponents')(function* (
    orgId: OrgId,
    requests: readonly RetrieveRequest[],
    expectedOrgGeneration?: number
  ) {
    if (requests.length === 0) return [];
    const connection = yield* connections.getConnectionForOrg(orgId);
    const snapshot = yield* changes.snapshot;
    const username =
      connection.getUsername() ??
      Option.getOrUndefined(Option.flatMap(authFieldsFromConnection(connection), fields => fields.username));
    const changed = new InactiveOrgOperationError({ expectedOrgId: orgId, message: host.messages.orgChanged(orgId) });
    if (
      snapshot.org.orgId !== orgId ||
      snapshot.org.username?.toLowerCase() !== username?.toLowerCase() ||
      (expectedOrgGeneration !== undefined && expectedOrgGeneration !== snapshot.orgGeneration)
    )
      return yield* changed;
    const staging = yield* shadow.prepareBatch(orgId);
    return yield* Effect.gen(function* () {
      const members = requests.map(({ reference }) => ({ type: reference.xmlName, fullName: reference.fullName }));
      const components = yield* retrieve
        .buildComponentSet(members)
        .pipe(Effect.flatMap(componentsService.ensureNonEmptyComponentSet));
      const result = yield* retrieve.retrieveComponentSetToDirectory(components, staging, { expectedOrgId: orgId });
      const sources = [...result.components.getSourceComponents()];
      const responses = result.getFileResponses();
      const files = yield* listStagedFiles(staging);
      const properties = Array.isArray(result.response.fileProperties)
        ? result.response.fileProperties
        : [result.response.fileProperties];
      const artifacts = yield* Effect.forEach(
        requests,
        request =>
          Effect.gen(function* () {
            const { reference } = request;
            const member = { type: reference.xmlName, fullName: reference.fullName };
            const source = sources.find(value =>
              sameMember({ type: value.type.name, fullName: value.fullName }, reference)
            );
            const responsePaths = responses.flatMap(value =>
              sameMember(value, reference) && value.filePath ? [value.filePath] : []
            );
            const sourcePaths = source
              ? [
                  ...(source.content ? [source.content] : []),
                  ...(source.xml ? [source.xml] : []),
                  ...source.walkContent()
                ]
              : [];
            const reported = yield* Effect.forEach(
              Arr.dedupe([
                ...result.components.getComponentFilenamesByNameAndType(member),
                ...responsePaths,
                ...sourcePaths
              ]),
              fs.toUri
            );
            const basenames = yield* sourceBasenames(orgId, reference);
            const candidates = Arr.dedupe(
              [
                ...reported.filter(uri => isUriEqualOrWithin(staging, uri)),
                ...files.filter(uri => basenames.has(Utils.basename(uri)))
              ].map(HashableUri.fromUri)
            );
            const fileUris = (yield* Effect.forEach(candidates, value =>
              fs
                .stat(value.uri)
                .pipe(
                  Effect.map(stat =>
                    (stat.type & vscode.FileType.File) !== 0 ? Option.some(value.uri) : Option.none()
                  )
                )
            )).flatMap(Option.toArray);
            const sourceContent = source?.content ? yield* fs.toUri(source.content) : undefined;
            const primary =
              fileUris.find(uri => uri.toString() === sourceContent?.toString()) ??
              fileUris.find(uri => basenames.has(Utils.basename(uri)) && !uri.path.endsWith('-meta.xml')) ??
              fileUris.find(uri => !uri.path.endsWith('-meta.xml')) ??
              fileUris.find(uri => basenames.has(Utils.basename(uri))) ??
              fileUris[0];
            if (!primary)
              return yield* new OrgMetadataCatalogError({
                reference,
                cause: 'Retrieve produced no readable source file',
                message: `Retrieved ${reference.xmlName} '${reference.fullName}', but no source file was produced`
              });
            const revision =
              request.expectedRemoteLastModifiedDate ??
              properties.find(property => property && sameMember(property, reference))?.lastModifiedDate;
            const prepared = yield* shadow.prepare(orgId, reference, revision);
            return yield* Effect.gen(function* () {
              const copied = yield* Effect.forEach(
                fileUris,
                uri => {
                  const suffix = pathSuffixWithin(staging, uri);
                  const target = Utils.joinPath(prepared.stagingUri, ...(suffix ?? Utils.basename(uri)).split('/'));
                  // Copy native bytes, including binary metadata; text decoding would corrupt source artifacts.
                  return fs
                    .createDirectory(Utils.dirname(target))
                    .pipe(Effect.andThen(fs.copy(uri, target)), Effect.uninterruptible, Effect.as({ uri, target }));
                },
                { concurrency: 10 }
              );
              const primaryCopy = copied.find(value => value.uri.toString() === primary.toString());
              if (!primaryCopy)
                return yield* new OrgMetadataCatalogError({
                  reference,
                  cause: 'Primary source file was not staged',
                  message: 'Failed to stage metadata primary file'
                });
              const artifact = yield* changes.commitIfCurrent(
                snapshot.orgGeneration,
                changed,
                shadow.publish({
                  orgId,
                  reference,
                  stagingUri: prepared.stagingUri,
                  primaryUri: primaryCopy.target,
                  fileUris: copied.map(value => value.target),
                  remoteLastModifiedDate: revision
                })
              );
              return { reference, artifact };
            }).pipe(Effect.ensuring(fs.safeDelete(prepared.stagingUri, { recursive: true })));
          }),
        { concurrency: 1 }
      );
      return yield* changes.commitIfCurrent(snapshot.orgGeneration, changed, Effect.succeed(artifacts));
    }).pipe(Effect.ensuring(fs.safeDelete(staging, { recursive: true })));
  }, operations.run);
  yield* Effect.addFinalizer(() => operations.close);
  return { materializeRetrievedComponents };
});
export class OrgCatalogRemoteRetrieve extends Context.Service<
  OrgCatalogRemoteRetrieve,
  Effect.Success<typeof makeOrgCatalogRemoteRetrieve>
>()('@salesforce/vscode-services-v4-implementation/OrgCatalogRemoteRetrieve') {}
export const OrgCatalogRemoteRetrieveLayer = Layer.effect(OrgCatalogRemoteRetrieve, makeOrgCatalogRemoteRetrieve).pipe(
  Layer.provideMerge(ServiceOperationsLayer)
);
