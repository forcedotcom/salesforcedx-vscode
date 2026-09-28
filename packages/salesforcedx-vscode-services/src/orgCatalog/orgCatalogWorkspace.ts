/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';
import * as HashMap from 'effect/HashMap';
import * as Option from 'effect/Option';
import { URI } from 'vscode-uri';
import { MetadataRetrieveService } from '../core/metadataRetrieveService';
import { ProjectService } from '../core/projectService';
import { toUri } from '../vscode/uriUtils';
import { OrgCatalogState } from './orgCatalogState';
import { OrgMetadataReferenceService, type OrgMetadataComponentReference } from './orgMetadataReference';

const emptyWorkspaceInventory: {
  readonly namespace: string | null;
  readonly components: HashMap.HashMap<string, URI>;
} = { namespace: null, components: HashMap.empty() };

const ignoreWorkspaceScanErrors =
  <Fallback>(fallback: Fallback, message: string, attributes: Record<string, unknown> = {}) =>
  <A, E, R>(self: Effect.Effect<A, E, R>) =>
    self.pipe(Effect.catchAll(error => Effect.logWarning(message, { error, ...attributes }).pipe(Effect.as(fallback))));

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
        return { namespace, components } as const;
      }).pipe(ignoreWorkspaceScanErrors(emptyWorkspaceInventory, 'Failed to scan workspace metadata', { xmlName }))
    );

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
      }).pipe(ignoreWorkspaceScanErrors(new Set<string>(), 'Failed to resolve workspace metadata types'));
      yield* state.setWorkspaceTypes(orgId, types);
      return types;
    });

    /** Workspace presence for consumer-discovered refs; caller discovery is org-presence authority (no Metadata API inventory). */
    const resolveComponents = Effect.fn('OrgCatalogWorkspace.resolveComponents')(function* (
      orgId: string,
      componentReferences: readonly OrgMetadataComponentReference[],
      options: { readonly prefer: 'workspace' | 'org' }
    ) {
      const xmlNames = Arr.dedupe(componentReferences.map(reference => reference.xmlName));
      return yield* Effect.forEach(
        xmlNames,
        xmlName => scanWorkspace(xmlName).pipe(Effect.map(workspaceUris => [xmlName, workspaceUris] as const)),
        { concurrency: 10 }
      ).pipe(
        Effect.map(HashMap.fromIterable),
        Effect.flatMap(workspaceByType =>
          Effect.forEach(componentReferences, reference =>
            Effect.gen(function* () {
              const workspaceUri = HashMap.get(workspaceByType, reference.xmlName).pipe(
                Option.flatMap(HashMap.get(reference.fullName)),
                Option.getOrUndefined
              );
              const orgUri = yield* referenceService.documentUri({ orgId, ...reference });
              return {
                reference,
                presence: workspaceUri ? ('both' as const) : ('org' as const),
                preferredUri: options.prefer === 'workspace' && workspaceUri ? workspaceUri : orgUri,
                orgUri,
                ...(workspaceUri ? { workspaceUri } : {})
              };
            })
          )
        ),
        Effect.tap(resolutions =>
          Effect.annotateCurrentSpan({
            componentCount: componentReferences.length,
            metadataTypeCount: xmlNames.length,
            workspaceComponentCount: resolutions.filter(resolution => resolution.presence === 'both').length
          })
        )
      );
    });

    return {
      getWorkspaceMetadataTypes,
      resolveComponents,
      scanWorkspaceInventory
    } as const;
  })
}) {}
