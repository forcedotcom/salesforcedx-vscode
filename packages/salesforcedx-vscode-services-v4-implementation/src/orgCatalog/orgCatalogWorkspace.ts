/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { WorkspaceTypeInventory } from './orgCatalogInternalTypes.js';
import {
  ComponentSetService,
  FailedToBuildComponentSetError,
  MetadataRegistryService,
  OrgMetadataCatalogError,
  ProjectService,
  documentUris,
  type ArtifactNamespace,
  type OrgMetadataComponentReference
} from '@salesforce/vscode-services-v2';
import * as Arr from 'effect/Array';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as HashMap from 'effect/HashMap';
import * as HashSet from 'effect/HashSet';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import { isError } from 'effect/Predicate';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { ServiceOperations, ServiceOperationsLayer } from '../serviceOperations.js';
import { toUri } from '../uriUtils.js';
import { typeCacheKey } from './orgCatalogKeys.js';
import { OrgCatalogMessages } from './orgCatalogMessages.js';
import { makeOrgCatalogOrg, type CatalogOrg } from './orgCatalogOrg.js';
import { OrgCatalogState } from './orgCatalogState.js';

type WorkspaceInventory = {
  readonly namespace: ArtifactNamespace;
  readonly components: HashMap.HashMap<string, URI>;
  readonly workspacePresenceAvailable: boolean;
};
const unavailable: WorkspaceInventory = {
  namespace: null,
  components: HashMap.empty(),
  workspacePresenceAvailable: false
};
const scanErrorTags = [
  'FailedToBuildComponentSetError',
  'FailedToResolveSfProjectError',
  'NoWorkspaceOpenError',
  'GetRegistryAccessError',
  'FailedToCreateConfigAggregatorError'
] as const;
const missingContentFileForError = (error: unknown) => {
  const cause = Schema.is(FailedToBuildComponentSetError)(error) ? error.cause : error;
  if (!isError(cause) || cause.name !== 'ExpectedSourceFilesError') return undefined;
  const marker = ': Expected source files for type ';
  const markerIndex = cause.message.indexOf(marker);
  if (markerIndex < 0) return undefined;
  const metadataXmlPath = cause.message.slice(0, markerIndex);
  if (!metadataXmlPath.endsWith('-meta.xml')) return undefined;
  const quotedType = cause.message.slice(markerIndex + marker.length);
  return {
    metadataType: quotedType.startsWith("'") && quotedType.endsWith("'") ? quotedType.slice(1, -1) : quotedType,
    metadataXmlPath,
    contentPath: metadataXmlPath.slice(0, -'-meta.xml'.length)
  };
};

const makeOrgCatalogWorkspace = Effect.gen(function* () {
  const state = yield* OrgCatalogState;
  const components = yield* ComponentSetService;
  const projects = yield* ProjectService;
  const registry = yield* MetadataRegistryService;
  const messages = yield* OrgCatalogMessages;
  const orgs = yield* makeOrgCatalogOrg;
  const operations = yield* ServiceOperations;
  const reported = yield* Ref.make(HashSet.empty<string>());
  const reportWorkspaceScanFailure = Effect.fn('OrgCatalogWorkspace.reportWorkspaceScanFailure')(function* (
    xmlName: string | undefined,
    error: unknown
  ) {
    const missing = missingContentFileForError(error);
    const failure = Schema.is(FailedToBuildComponentSetError)(error) && error.cause ? error.cause : error;
    const message = missing
      ? messages.workspaceMissingContent(missing.metadataType, missing.metadataXmlPath, missing.contentPath)
      : messages.workspaceScanFailed(
          xmlName ?? 'workspace metadata',
          isError(failure) ? failure.message : String(failure)
        );
    const first = yield* Ref.modify(
      reported,
      previous => [!HashSet.has(previous, message), HashSet.add(previous, message)] as const
    );
    if (!first) return;
    yield* Effect.logError('Could not determine workspace metadata presence', { xmlName, error });
    yield* Effect.sync(() => {
      void vscode.window.showErrorMessage(message);
    });
  });
  const scanWorkspaceInventory = Effect.fn('OrgCatalogWorkspace.scanWorkspaceInventory')(
    (xmlName: string) =>
      projects.getProjectNamespace().pipe(
        Effect.flatMap(namespace =>
          components
            .getComponentSetFromProjectDirectories({ metadataMembers: [{ type: xmlName, fullName: '*' }] })
            .pipe(
              Effect.map(set => ({
                namespace,
                components: [...set.getSourceComponents()].reduce((uris, component) => {
                  if (component.type.name !== xmlName) return uris;
                  // Decomposed children (e.g. CustomField): xml is the workspace artifact when content is absent.
                  const sourcePath = component.content ?? component.xml;
                  if (!sourcePath) return uris;
                  const candidate = toUri(sourcePath);
                  const existing = Option.getOrUndefined(HashMap.get(uris, component.fullName));
                  return !existing || candidate.path.length < existing.path.length
                    ? HashMap.set(uris, component.fullName, candidate)
                    : uris;
                }, HashMap.empty<string, URI>()),
                workspacePresenceAvailable: true
              }))
            )
        ),
        Effect.catchTag(scanErrorTags, error => reportWorkspaceScanFailure(xmlName, error).pipe(Effect.as(unavailable)))
      ),
    operations.run
  );
  const getWorkspaceMetadataTypes = Effect.fn('OrgCatalogWorkspace.getWorkspaceMetadataTypes')(function* (
    org: CatalogOrg
  ) {
    const semaphore = yield* state.getInventorySemaphore(typeCacheKey(org.orgId, '__workspaceTypes__'));
    return yield* semaphore.withPermit(
      Effect.gen(function* () {
        yield* orgs.validate(org);
        const { cached, generation } = yield* state.getWorkspaceTypesSnapshot(org.orgId);
        if (cached) return cached;
        const types = yield* components.getComponentSetFromProjectDirectories().pipe(
          Effect.map(
            set =>
              ({
                types: new Set([...set.getSourceComponents()].map(component => component.type.name)),
                workspacePresenceAvailable: true
              }) satisfies WorkspaceTypeInventory
          ),
          Effect.catchTag(scanErrorTags, error =>
            reportWorkspaceScanFailure(undefined, error).pipe(
              Effect.as({
                types: new Set<string>(),
                workspacePresenceAvailable: false
              } satisfies WorkspaceTypeInventory)
            )
          )
        );
        yield* state.withHierarchyCommit(
          orgs.commit(
            org,
            state.getHierarchyGeneration(org.orgId).pipe(
              Effect.flatMap(current =>
                current === generation
                  ? state.setWorkspaceTypes(org.orgId, types)
                  : Effect.fail(
                      new OrgMetadataCatalogError({
                        message: 'Workspace metadata changed while its types were being read',
                        cause: 'Catalog hierarchy invalidated'
                      })
                    )
              )
            )
          )
        );
        return types;
      })
    );
  }, operations.run);
  /** Consumer discovery is org-presence authority; never load Metadata API inventory just to find a workspace URI. */
  const resolveComponents = Effect.fn('OrgCatalogWorkspace.resolveComponents')(function* (
    org: CatalogOrg,
    references: readonly OrgMetadataComponentReference[],
    options: { readonly prefer: 'workspace' | 'org' }
  ) {
    yield* orgs.validate(org);
    const byType = yield* Effect.forEach(
      Arr.dedupe(references.map(reference => reference.xmlName)),
      xmlName => scanWorkspaceInventory(xmlName).pipe(Effect.map(inventory => [xmlName, inventory] as const)),
      { concurrency: 10 }
    ).pipe(Effect.map(HashMap.fromIterable));
    const uris = yield* documentUris(references.map(reference => ({ orgId: org.orgId, ...reference }))).pipe(
      Effect.provideService(MetadataRegistryService, registry)
    );
    yield* orgs.validate(org);
    return references.map((reference, index) => {
      const inventory = Option.getOrUndefined(HashMap.get(byType, reference.xmlName));
      const workspaceUri = inventory
        ? Option.getOrUndefined(HashMap.get(inventory.components, reference.fullName))
        : undefined;
      return {
        reference,
        presence: workspaceUri ? ('both' as const) : ('org' as const),
        workspacePresenceAvailable: inventory?.workspacePresenceAvailable ?? false,
        preferredUri: options.prefer === 'workspace' && workspaceUri ? workspaceUri : uris[index],
        orgUri: uris[index],
        ...(workspaceUri ? { workspaceUri } : {})
      };
    });
  }, operations.run);
  yield* Effect.addFinalizer(() => operations.close);
  return { getWorkspaceMetadataTypes, resolveComponents, scanWorkspaceInventory };
});
export class OrgCatalogWorkspace extends Context.Service<
  OrgCatalogWorkspace,
  Effect.Success<typeof makeOrgCatalogWorkspace>
>()('@salesforce/vscode-services-v4-implementation/OrgCatalogWorkspace') {}
export const OrgCatalogWorkspaceLayer = Layer.effect(OrgCatalogWorkspace, makeOrgCatalogWorkspace).pipe(
  Layer.provideMerge(ServiceOperationsLayer)
);
