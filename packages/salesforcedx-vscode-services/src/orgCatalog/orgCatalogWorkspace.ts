/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { URI } from 'vscode-uri';
import { MetadataRetrieveService } from '../core/metadataRetrieveService';
import { ProjectService } from '../core/projectService';
import { toUri } from '../vscode/uriUtils';
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
    const scanWorkspaceInventory = Effect.fn('OrgCatalogWorkspace.scanWorkspaceInventory')(function* (xmlName: string) {
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
        // Decomposed child metadata (for example CustomField) has an XML source file but no
        // `content` path. Treat the XML path as its workspace artifact so local presence is not
        // lost merely because the registry represents the component as a child of its container.
        const sourcePath = component.content ?? component.xml;
        if (!sourcePath) return workspaceUris;
        const candidate = toUri(sourcePath);
        const existing = workspaceUris.get(component.fullName);
        if (!existing || candidate.path.length < existing.path.length) {
          workspaceUris.set(component.fullName, candidate);
        }
        return workspaceUris;
      }, new Map<string, URI>());
      return { namespace, components } as const;
    });

    const scanWorkspace = Effect.fn('OrgCatalogWorkspace.scanWorkspace')((xmlName: string) =>
      scanWorkspaceInventory(xmlName).pipe(Effect.map(inventory => inventory.components))
    );

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
      }).pipe(
        Effect.catchAll(error =>
          Effect.logWarning('Failed to resolve workspace metadata types', { error }).pipe(Effect.as(new Set<string>()))
        )
      );
      yield* state.setWorkspaceTypes(orgId, types);
      return types;
    });

    /**
     * Resolves workspace presence for components already discovered by a consumer. This deliberately avoids
     * Metadata API inventory acquisition: the caller's discovery result is authoritative for org presence.
     */
    const resolveComponents = Effect.fn('OrgCatalogWorkspace.resolveComponents')(function* (
      orgId: string,
      componentReferences: readonly OrgMetadataComponentReference[],
      options: { readonly prefer: 'workspace' | 'org' }
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
      const resolutions = yield* Effect.forEach(componentReferences, reference =>
        Effect.gen(function* () {
          const workspaceUri = workspaceByType.get(reference.xmlName)?.get(reference.fullName);
          const orgUri = yield* referenceService.documentUri({ orgId, ...reference });
          return {
            reference,
            presence: workspaceUri ? ('both' as const) : ('org' as const),
            preferredUri: options.prefer === 'workspace' && workspaceUri ? workspaceUri : orgUri,
            orgUri,
            ...(workspaceUri ? { workspaceUri } : {})
          };
        })
      );
      yield* Effect.annotateCurrentSpan({
        componentCount: componentReferences.length,
        metadataTypeCount: xmlNames.length,
        workspaceComponentCount: resolutions.filter(resolution => resolution.presence === 'both').length
      });
      return resolutions;
    });

    return { getWorkspaceMetadataTypes, resolveComponents, scanWorkspace, scanWorkspaceInventory } as const;
  })
}) {}
