/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OrgConfigProperties } from '@salesforce/core';
import type { ConfigAggregator } from '@salesforce/core/configAggregator';
import type { SfProject } from '@salesforce/core/project';
import {
  ComponentSet,
  type ComponentSet as ComponentSetType,
  type FileResponse,
  type FileResponseFailure,
  type FileResponseSuccess,
  ComponentStatus
} from '@salesforce/source-deploy-retrieve';
import * as Brand from 'effect/Brand';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import { ConfigService } from './configService';
import { MetadataRegistryService } from './metadataRegistryService';
import { FailedToResolveSfProjectError, ProjectService } from './projectService';
import { unknownToErrorCause } from './shared';

/** A ComponentSet that is guaranteed to be non-empty */
export type NonEmptyComponentSet = ComponentSet & Brand.Brand<'NonEmptyComponentSet'>;

/** Constructor for NonEmptyComponentSet that validates the ComponentSet is non-empty */
const EnsureNonEmptyComponentSet = Brand.refined<NonEmptyComponentSet>(
  componentSet => componentSet.size > 0 || Array.from(componentSet.getSourceComponents()).length > 0,
  componentSet => Brand.error(`Expected ComponentSet to be non-empty, but got size ${componentSet.size}`)
);

export class EmptyComponentSetError extends Data.TaggedError('EmptyComponentSetError')<{
  readonly size: number;
}> {}

export class FailedToBuildComponentSetError extends Data.TaggedError('FailedToBuildComponentSetError')<{
  readonly cause?: Error;
}> {}

/** Type guard to check if a FileResponse is successful */
const isSDRSuccess = (fileResponse: FileResponse): fileResponse is FileResponseSuccess =>
  fileResponse.state !== ComponentStatus.Failed;

/** Type guard to check if a FileResponse is a failure */
const isSDRFailure = (fileResponse: FileResponse): fileResponse is FileResponseFailure =>
  fileResponse.state === ComponentStatus.Failed;

/** Effect that validates a ComponentSet is non-empty and returns NonEmptyComponentSet */
const ensureNonEmptyComponentSet = (componentSet: ComponentSetType) =>
  Effect.try({
    try: () => EnsureNonEmptyComponentSet(componentSet),
    catch: () => new EmptyComponentSetError({ size: componentSet.size })
  });

/** Get required services for building ComponentSets */
const getComponentSetDependencies = () =>
  Effect.all(
    [
      Effect.flatMap(MetadataRegistryService, svc => svc.getRegistryAccess()),
      Effect.flatMap(ProjectService, svc => svc.getSfProject),
      Effect.flatMap(ConfigService, svc => svc.getConfigAggregator)
    ],
    { concurrency: 'unbounded' }
  );

/** Get ComponentSet from source paths (files/directories) */
const getComponentSetFromPaths = (paths: Set<string>) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan({ paths });
    const [registryAccess, project, configAggregator] = yield* getComponentSetDependencies();

    const componentSet = yield* Effect.try({
      try: () => ComponentSet.fromSource({ fsPaths: Array.from(paths), registry: registryAccess }),
      catch: e => new FailedToBuildComponentSetError(unknownToErrorCause(e))
    });

    yield* setComponentSetProperties(componentSet, project, configAggregator);

    yield* Effect.annotateCurrentSpan({ size: componentSet.size });
    return componentSet;
  }).pipe(Effect.withSpan('getComponentSetFromPaths'));

/** Get ComponentSet from manifest file */
const getComponentSetFromManifest = (manifestPath: string) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan({ manifestPath });
    const [registryAccess, project, configAggregator] = yield* getComponentSetDependencies();

    const componentSet = yield* Effect.tryPromise({
      try: async () =>
        ComponentSet.fromManifest({
          manifestPath,
          // Get package directories as full paths
          resolveSourcePaths: project.getPackageDirectories().map(pkgDir => pkgDir.fullPath),
          forceAddWildcards: true,
          registry: registryAccess
        }),
      catch: e => new FailedToBuildComponentSetError(unknownToErrorCause(e))
    });

    yield* setComponentSetProperties(componentSet, project, configAggregator);

    yield* Effect.annotateCurrentSpan({ size: componentSet.size });
    return componentSet;
  }).pipe(Effect.withSpan('getComponentSetFromManifest'));

export class ComponentSetService extends Effect.Service<ComponentSetService>()('ComponentSetService', {
  effect: Effect.gen(function* () {
    return {
      /** Type guard to check if a FileResponse is successful */
      isSDRSuccess,
      /** Type guard to check if a FileResponse is a failure */
      isSDRFailure,
      /** Effect that validates a ComponentSet is non-empty and returns NonEmptyComponentSet */
      ensureNonEmptyComponentSet,
      /** Get ComponentSet from source paths (files/directories) */
      getComponentSetFromPaths,
      /** Get ComponentSet from manifest file */
      getComponentSetFromManifest
    } as const;
  }),
  dependencies: [MetadataRegistryService.Default, ProjectService.Default, ConfigService.Default]
}) {}

/** Set project directory, API version, and source API version on ComponentSet */
export const setComponentSetProperties = (
  componentSet: ComponentSetType,
  project: SfProject,
  configAggregator: ConfigAggregator
) =>
  Effect.gen(function* () {
    componentSet.projectDirectory = project.getPath();
    const apiVersion = configAggregator.getPropertyValue<string>(OrgConfigProperties.ORG_API_VERSION);
    if (apiVersion) {
      componentSet.apiVersion = apiVersion;
    }
    const projectJson = yield* Effect.tryPromise({
      try: () => project.retrieveSfProjectJson(),
      catch: e => new FailedToResolveSfProjectError(unknownToErrorCause(e))
    });
    const sourceApiVersion = projectJson.get<string>('sourceApiVersion');
    if (sourceApiVersion) {
      componentSet.sourceApiVersion = String(sourceApiVersion);
    }
  });
