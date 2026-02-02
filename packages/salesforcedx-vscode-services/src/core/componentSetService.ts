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
  ComponentStatus,
  SourceComponent,
  type MetadataComponent
} from '@salesforce/source-deploy-retrieve';
import * as Brand from 'effect/Brand';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as Schema from 'effect/Schema';
import { URI } from 'vscode-uri';
import { HashableUri } from '../vscode/hashableUri';
import { uriToPath } from '../vscode/paths';
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

export class EmptyComponentSetError extends Schema.TaggedError<EmptyComponentSetError>()('EmptyComponentSetError', {
  message: Schema.String,
  size: Schema.Number
}) {}

export class FailedToBuildComponentSetError extends Schema.TaggedError<FailedToBuildComponentSetError>()(
  'FailedToBuildComponentSetError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.instanceOf(Error))
  }
) {}

/** Type guard to check if a MetadataComponent is a SourceComponent */
export const isSourceComponent = (component: MetadataComponent): component is SourceComponent =>
  component instanceof SourceComponent;

/** Type guard to check if a FileResponse is successful */
const isSDRSuccess = (fileResponse: FileResponse): fileResponse is FileResponseSuccess =>
  fileResponse.state !== ComponentStatus.Failed;

/** Type guard to check if a FileResponse is a failure */
const isSDRFailure = (fileResponse: FileResponse): fileResponse is FileResponseFailure =>
  fileResponse.state === ComponentStatus.Failed;

export class ComponentSetService extends Effect.Service<ComponentSetService>()('ComponentSetService', {
  accessors: true,
  dependencies: [MetadataRegistryService.Default, ProjectService.Default, ConfigService.Default],
  effect: Effect.gen(function* () {
    const metadataRegistryService = yield* MetadataRegistryService;
    const projectService = yield* ProjectService;
    const configService = yield* ConfigService;

    /** Effect that validates a ComponentSet is non-empty and returns NonEmptyComponentSet */
    const ensureNonEmptyComponentSet = Effect.fn('ComponentSetService.ensureNonEmptyComponentSet')(function* (
      componentSet: ComponentSetType
    ) {
      return yield* Effect.try({
        try: () => EnsureNonEmptyComponentSet(componentSet),
        catch: () =>
          new EmptyComponentSetError({
            message: `Expected ComponentSet to be non-empty, but got size ${componentSet.size}`,
            size: componentSet.size
          })
      });
    });

    /** Get ComponentSet from source URIs (files/directories).  Handles deduplication of URIs */
    const getComponentSetFromUris = Effect.fn('ComponentSetService.getComponentSetFromUris')(function* (
      uris: readonly URI[]
    ) {
      return yield* Effect.gen(function* () {
        const [registryAccess, project, configAggregator] = yield* Effect.all(
          [
            metadataRegistryService.getRegistryAccess(),
            projectService.getSfProject(),
            configService.getConfigAggregator()
          ],
          { concurrency: 'unbounded' }
        );
        const hashableUris = HashSet.fromIterable(uris.map(HashableUri.fromUri));
        const paths = hashableUris.pipe(
          HashSet.map(uri => uriToPath(uri)),
          HashSet.toValues
        );
        yield* Effect.annotateCurrentSpan({ paths });
        const componentSet = yield* Effect.try({
          try: () => ComponentSet.fromSource({ fsPaths: paths, registry: registryAccess }),
          catch: e => {
            const { cause } = unknownToErrorCause(e);
            return new FailedToBuildComponentSetError({
              message: `Failed to build ComponentSet from URIs: ${cause.message}`,
              cause
            });
          }
        });

        yield* setComponentSetProperties({ componentSet, project, configAggregator });

        yield* Effect.annotateCurrentSpan({ size: componentSet.size });
        return componentSet;
      }).pipe(Effect.withSpan('getComponentSetFromPaths'));
    });

    /** Get ComponentSet from manifest file */
    const getComponentSetFromManifest = Effect.fn('ComponentSetService.getComponentSetFromManifest')(function* (
      manifestPath: string
    ) {
      return yield* Effect.gen(function* () {
        yield* Effect.annotateCurrentSpan({ manifestPath });
        const [registryAccess, project, configAggregator] = yield* Effect.all(
          [
            metadataRegistryService.getRegistryAccess(),
            projectService.getSfProject(),
            configService.getConfigAggregator()
          ],
          { concurrency: 'unbounded' }
        );

        const componentSet = yield* Effect.tryPromise({
          try: async () =>
            ComponentSet.fromManifest({
              manifestPath,
              // Get package directories as full paths
              resolveSourcePaths: project.getPackageDirectories().map(pkgDir => pkgDir.fullPath),
              forceAddWildcards: true,
              registry: registryAccess
            }),
          catch: e => {
            const { cause } = unknownToErrorCause(e);
            return new FailedToBuildComponentSetError({
              message: `Failed to build ComponentSet from manifest: ${cause.message}`,
              cause
            });
          }
        });

        yield* setComponentSetProperties({ componentSet, project, configAggregator });

        yield* Effect.annotateCurrentSpan({ size: componentSet.size });
        return componentSet;
      }).pipe(Effect.withSpan('getComponentSetFromManifest'));
    });

    return {
      isSDRSuccess,
      isSDRFailure,
      ensureNonEmptyComponentSet,
      getComponentSetFromUris,
      getComponentSetFromManifest
    };
  })
}) {}

/**
 * Set project directory, API version, and source API version on ComponentSet
 * side effect: mutates the componentSet in place.  There's not a good way to return a new componentSet with the properties set.
 */
export const setComponentSetProperties = ({
  componentSet,
  project,
  configAggregator,
  directory
}: {
  componentSet: ComponentSetType;
  project: SfProject;
  configAggregator: ConfigAggregator;
  /** if not provied, uses the project path.  Useful it retrieving to a custom directory. */
  directory?: URI;
}) =>
  Effect.gen(function* () {
    componentSet.projectDirectory = directory ? uriToPath(directory) : project.getPath();
    const apiVersion = configAggregator.getPropertyValue<string>(OrgConfigProperties.ORG_API_VERSION);
    if (apiVersion) {
      componentSet.apiVersion = apiVersion;
    }
    const projectJson = yield* Effect.tryPromise({
      try: () => project.retrieveSfProjectJson(),
      catch: e => {
        const { cause } = unknownToErrorCause(e);
        return new FailedToResolveSfProjectError({
          message: `Failed to resolve SfProject: ${cause.message}`,
          cause
        });
      }
    });
    const sourceApiVersion = projectJson.get<string>('sourceApiVersion');
    if (sourceApiVersion) {
      componentSet.sourceApiVersion = String(sourceApiVersion);
    }
  });
