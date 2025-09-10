/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { MetadataMember } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { ExtensionProviderService, ExtensionProviderServiceLive } from '../services/extensionProvider';

// since we can't file search on the web, we'll use ComponentSet to find local file paths for the component
export const getFilePaths = (member: MetadataMember): Effect.Effect<string[], Error, never> =>
  ExtensionProviderService.pipe(
    Effect.flatMap(svcProvider => svcProvider.getServicesApi),
    Effect.flatMap(api => {
      const allLayers = Layer.mergeAll(
        api.services.MetadataRetrieveServiceLive,
        api.services.MetadataRegistryServiceLive,
        api.services.WorkspaceServiceLive,
        api.services.ProjectServiceLive,
        api.services.SdkLayer
      );

      return Effect.gen(function* () {
        yield* Effect.log('beforeGetProject');
        const projectService = yield* api.services.ProjectService;
        const dirs = (yield* projectService.getSfProject).getPackageDirectories().map(directory => directory.fullPath);
        yield* Effect.log('afterGetProject');
        const retrieveService = yield* api.services.MetadataRetrieveService;
        const componentSet = yield* retrieveService.buildComponentSetFromSource([member], dirs);
        yield* Effect.log('afterBuildComponentSet');
        yield* Effect.annotateCurrentSpan({
          size: componentSet.size,
          sourceComponents: Array.from(componentSet.getSourceComponents()).map(c => c.fullName)
        });
        const paths = Array.from(componentSet.getSourceComponents()).flatMap(c =>
          [c.xml, c.content].filter(f => f !== undefined)
        );
        yield* Effect.annotateCurrentSpan({ paths });
        return paths;
      }).pipe(
        Effect.withSpan('getFilePaths', { attributes: { type: member.type, fullName: member.fullName } }),
        Effect.provide(allLayers)
      );
    }),
    Effect.provide(ExtensionProviderServiceLive)
  );
