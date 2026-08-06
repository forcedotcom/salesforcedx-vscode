/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { KnownOrgMetadataComponentResolution } from './orgMetadataCatalogTypes';
import * as Effect from 'effect/Effect';
import { URI } from 'vscode-uri';
import { MetadataRetrieveService } from '../core/metadataRetrieveService';
import { ProjectService } from '../core/projectService';
import { OrgCatalogState } from './orgCatalogState';
import { OrgMetadataReferenceService, type OrgMetadataComponentReference } from './orgMetadataReference';

export class OrgCatalogWorkspace extends Effect.Service<OrgCatalogWorkspace>()('OrgCatalogWorkspace', {
  accessors: true,
  dependencies: [
    OrgCatalogState.Default,
    OrgMetadataReferenceService.Default,
    MetadataRetrieveService.Default,
    ProjectService.Default
  ],
  effect: Effect.gen(function* () {
    const [state, referenceService, metadataRetrieveService, projectService] = yield* Effect.all([
      OrgCatalogState,
      OrgMetadataReferenceService,
      MetadataRetrieveService,
      ProjectService
    ]);
    const scanWorkspace = Effect.fn('OrgCatalogWorkspace.scanWorkspace')(function* (xmlName: string) {
      const project = yield* projectService.getSfProject();
      const packageDirectories = project.getPackageDirectories().map(directory => directory.fullPath);
      const componentSet = yield* metadataRetrieveService.buildComponentSetFromSource(packageDirectories, [
        { type: xmlName, fullName: '*' }
      ]);
      return [...componentSet.getSourceComponents()].reduce((workspaceUris, component) => {
        if (component.type.name !== xmlName) return workspaceUris;
        // Decomposed child metadata (for example CustomField) has an XML source file but no
        // `content` path. Treat the XML path as its workspace artifact so local presence is not
        // lost merely because the registry represents the component as a child of its container.
        const sourcePath = component.content ?? component.xml;
        if (!sourcePath) return workspaceUris;
        const candidate = URI.file(sourcePath);
        const existing = workspaceUris.get(component.fullName);
        if (!existing || candidate.path.length < existing.path.length) {
          workspaceUris.set(component.fullName, candidate);
        }
        return workspaceUris;
      }, new Map<string, URI>());
    });

    const getWorkspaceMetadataTypes = Effect.fn('OrgCatalogWorkspace.getWorkspaceMetadataTypes')(function* (
      orgId: string
    ) {
      const cached = yield* state.getWorkspaceTypes(orgId);
      if (cached) return cached;
      const types = yield* Effect.gen(function* () {
        const project = yield* projectService.getSfProject();
        const packageDirectories = project.getPackageDirectories().map(directory => directory.fullPath);
        const componentSet = yield* metadataRetrieveService.buildComponentSetFromSource(packageDirectories, []);
        return new Set([...componentSet.getSourceComponents()].map(component => component.type.name));
      }).pipe(Effect.catchAll(() => Effect.succeed(new Set<string>())));
      yield* state.setWorkspaceTypes(orgId, types);
      return types;
    });

    /**
     * Resolves workspace presence for components already discovered by a consumer. This deliberately avoids
     * Metadata API inventory acquisition: the caller's discovery result is authoritative for org presence.
     */
    const resolveKnownOrgComponents = Effect.fn('OrgCatalogWorkspace.resolveKnownOrgComponents')(function* (
      orgId: string,
      componentReferences: readonly OrgMetadataComponentReference[]
    ) {
      const xmlNames = [...new Set(componentReferences.map(reference => reference.xmlName))];
      const workspaceByType = new Map(
        yield* Effect.forEach(
          xmlNames,
          xmlName =>
            scanWorkspace(xmlName).pipe(
              Effect.catchAll(error =>
                Effect.logWarning('Failed to resolve workspace metadata presence', { error, xmlName }).pipe(
                  Effect.as(new Map<string, URI>())
                )
              ),
              Effect.map(workspaceUris => [xmlName, workspaceUris] as const)
            ),
          { concurrency: 10 }
        )
      );
      const resolutions = componentReferences.map(reference => {
        const workspaceUri = workspaceByType.get(reference.xmlName)?.get(reference.fullName);
        return {
          reference,
          documentUri: workspaceUri ?? referenceService.documentUri({ orgId, ...reference }),
          inWorkspace: workspaceUri !== undefined,
          ...(workspaceUri ? { workspaceUri } : {})
        } satisfies KnownOrgMetadataComponentResolution;
      });
      yield* Effect.annotateCurrentSpan({
        componentCount: componentReferences.length,
        metadataTypeCount: xmlNames.length,
        workspaceComponentCount: resolutions.filter(resolution => resolution.inWorkspace).length
      });
      return resolutions;
    });

    return { getWorkspaceMetadataTypes, resolveKnownOrgComponents, scanWorkspace } as const;
  })
}) {}
