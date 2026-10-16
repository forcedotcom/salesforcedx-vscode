/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { WorkspaceTypeInventory } from './orgCatalogInternalTypes';
import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';
import * as HashMap from 'effect/HashMap';
import * as Option from 'effect/Option';
import { isError } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { type URI } from 'vscode-uri';
import { FailedToBuildComponentSetError } from '../core/componentSetService';
import { MetadataRegistryService } from '../core/metadataRegistryService';
import { MetadataRetrieveService } from '../core/metadataRetrieveService';
import { ProjectService } from '../core/projectService';
import { nls } from '../messages';
import { toUri } from '../vscode/uriUtils';
import { OrgCatalogState } from './orgCatalogState';
import { documentUris, type OrgMetadataComponentReference } from './orgMetadataReference';

type WorkspaceInventory = {
  readonly namespace: string | null;
  readonly components: HashMap.HashMap<string, URI>;
  readonly workspacePresenceAvailable: boolean;
};

const unavailableWorkspaceInventory: WorkspaceInventory = {
  namespace: null,
  components: HashMap.empty(),
  workspacePresenceAvailable: false
};

const missingContentFileForError = (
  error: unknown
): { readonly metadataType: string; readonly metadataXmlPath: string; readonly contentPath: string } | undefined => {
  const cause = Schema.is(FailedToBuildComponentSetError)(error) ? error.cause : error;
  if (!isError(cause) || cause.name !== 'ExpectedSourceFilesError') return undefined;

  const marker = ': Expected source files for type ';
  const markerIndex = cause.message.indexOf(marker);
  if (markerIndex < 0) return undefined;

  const metadataXmlPath = cause.message.slice(0, markerIndex);
  if (!metadataXmlPath.endsWith('-meta.xml')) return undefined;
  const quotedType = cause.message.slice(markerIndex + marker.length);
  const metadataType = quotedType.startsWith("'") && quotedType.endsWith("'") ? quotedType.slice(1, -1) : quotedType;
  return {
    metadataType,
    metadataXmlPath,
    contentPath: metadataXmlPath.slice(0, -'-meta.xml'.length)
  };
};

export const makeOrgCatalogWorkspace = Effect.gen(function* () {
  const [state, metadataRetrieveService, projectService, registry] = yield* Effect.all([
    OrgCatalogState,
    MetadataRetrieveService,
    ProjectService,
    MetadataRegistryService
  ]);
  const reportedWorkspaceScanWarnings = new Set<string>();
  const reportWorkspaceScanFailure = Effect.fn('OrgCatalogWorkspace.reportWorkspaceScanFailure')(function* (
    xmlName: string | undefined,
    error: unknown
  ) {
    const missingContentFile = missingContentFileForError(error);
    const failure = Schema.is(FailedToBuildComponentSetError)(error) && error.cause ? error.cause : error;
    const description = isError(failure) ? failure.message : String(failure);
    const message = missingContentFile
      ? nls.localize(
          'org_metadata_catalog_workspace_presence_missing_content',
          missingContentFile.metadataType,
          missingContentFile.metadataXmlPath,
          missingContentFile.contentPath
        )
      : nls.localize(
          'org_metadata_catalog_workspace_presence_scan_failed',
          xmlName ?? 'workspace metadata',
          description
        );
    if (reportedWorkspaceScanWarnings.has(message)) return;
    reportedWorkspaceScanWarnings.add(message);
    yield* Effect.logWarning('Could not determine workspace metadata presence', { xmlName, error });
    yield* Effect.sync(() => {
      void vscode.window.showWarningMessage(message);
    });
  });

  const scanWorkspaceInventory = Effect.fn('OrgCatalogWorkspace.scanWorkspaceInventory')((xmlName: string) =>
    Effect.gen(function* () {
      const [project, namespace] = yield* Effect.all([
        projectService.getSfProject(),
        projectService.getProjectNamespace()
      ]);
      const packageDirectories = project.getPackageDirectories().map(directory => directory.fullPath);
      const componentSet = yield* metadataRetrieveService.buildComponentSetFromSource(packageDirectories, [
        { type: xmlName, fullName: '*' }
      ]);
      const components = [...componentSet.getSourceComponents()].reduce((workspaceUris, component) => {
        if (component.type.name !== xmlName) return workspaceUris;
        // Decomposed children (e.g. CustomField): xml is the workspace artifact when content is absent.
        const sourcePath = component.content ?? component.xml;
        if (!sourcePath) return workspaceUris;
        const candidate = toUri(sourcePath);
        const existing = Option.getOrUndefined(HashMap.get(workspaceUris, component.fullName));
        if (!existing || candidate.path.length < existing.path.length) {
          return HashMap.set(workspaceUris, component.fullName, candidate);
        }
        return workspaceUris;
      }, HashMap.empty<string, URI>());
      return { namespace, components, workspacePresenceAvailable: true } as const;
    }).pipe(
      Effect.catchAll(error =>
        reportWorkspaceScanFailure(xmlName, error).pipe(Effect.as(unavailableWorkspaceInventory))
      )
    )
  );

  const scanWorkspace = Effect.fn('OrgCatalogWorkspace.scanWorkspace')((xmlName: string) =>
    scanWorkspaceInventory(xmlName)
  );

  const getWorkspaceMetadataTypes = Effect.fn('OrgCatalogWorkspace.getWorkspaceMetadataTypes')(function* (
    orgId: string
  ) {
    const cached = yield* state.getWorkspaceTypes(orgId);
    if (cached) return cached;
    const workspaceTypes = yield* Effect.gen(function* () {
      const project = yield* projectService.getSfProject();
      const packageDirectories = project.getPackageDirectories().map(directory => directory.fullPath);
      const componentSet = yield* metadataRetrieveService.buildComponentSetFromSource(packageDirectories, []);
      return {
        types: new Set([...componentSet.getSourceComponents()].map(component => component.type.name)),
        workspacePresenceAvailable: true
      } satisfies WorkspaceTypeInventory;
    }).pipe(
      Effect.catchAll(error =>
        reportWorkspaceScanFailure(undefined, error).pipe(
          Effect.as({ types: new Set<string>(), workspacePresenceAvailable: false })
        )
      )
    );
    yield* state.setWorkspaceTypes(orgId, workspaceTypes);
    return workspaceTypes;
  });

  /** Workspace presence for consumer-discovered refs; caller discovery is org-presence authority (no Metadata API inventory). */
  const resolveComponents = Effect.fn('OrgCatalogWorkspace.resolveComponents')(function* (
    orgId: string,
    componentReferences: readonly OrgMetadataComponentReference[],
    options: { readonly prefer: 'workspace' | 'org' }
  ) {
    const xmlNames = Arr.dedupe(componentReferences.map(reference => reference.xmlName));
    const workspaceByType = yield* Effect.forEach(
      xmlNames,
      xmlName => scanWorkspace(xmlName).pipe(Effect.map(inventory => [xmlName, inventory] as const)),
      { concurrency: 10 }
    ).pipe(Effect.map(HashMap.fromIterable));
    const orgUris = yield* documentUris(componentReferences.map(reference => ({ orgId, ...reference }))).pipe(
      Effect.provideService(MetadataRegistryService, registry)
    );
    const resolutions = componentReferences.map((reference, index) => {
      const workspaceInventory = Option.getOrUndefined(HashMap.get(workspaceByType, reference.xmlName));
      const workspaceUri = workspaceInventory
        ? Option.getOrUndefined(HashMap.get(workspaceInventory.components, reference.fullName))
        : undefined;
      const orgUri = orgUris[index];
      return {
        reference,
        presence: workspaceUri ? ('both' as const) : ('org' as const),
        workspacePresenceAvailable: workspaceInventory?.workspacePresenceAvailable ?? false,
        preferredUri: options.prefer === 'workspace' && workspaceUri ? workspaceUri : orgUri,
        orgUri,
        ...(workspaceUri ? { workspaceUri } : {})
      };
    });
    yield* Effect.annotateCurrentSpan({
      componentCount: componentReferences.length,
      metadataTypeCount: xmlNames.length,
      workspaceComponentCount: resolutions.filter(resolution => resolution.presence === 'both').length
    });
    return resolutions;
  });
  return {
    getWorkspaceMetadataTypes,
    resolveComponents,
    scanWorkspaceInventory
  } as const;
});
