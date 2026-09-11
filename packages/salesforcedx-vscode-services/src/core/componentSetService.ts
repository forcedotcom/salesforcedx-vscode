/*
 * Copyright (c) 2026, salesforce.com, inc.
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
  type FileResponseSuccess,
  ManifestResolver,
  type MetadataComponent,
  type MetadataMember,
  type RegistryAccess
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
import {
  isSDRFailure,
  isSDRSuccess,
  makeFileResponseFailure,
  toComponentStatusChangeType,
  toRequestStatus
} from './sdrGuards';
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

const getComponentState = (component: FileResponseSuccess) => toComponentStatusChangeType(component.state);

const MANIFEST_COMPONENT_BATCH_SIZE = 1000;

type BotVersionFilter = NonNullable<ComponentSetType['botVersionFilters']>[number];

const parseBotVersionFullName = (fullName: string): BotVersionFilter => {
  const numberedVersion = /^(.+)\.v(\d+)$/.exec(fullName);
  if (numberedVersion) {
    return { botName: numberedVersion[1], versionFilter: Number(numberedVersion[2]) };
  }
  if (fullName.endsWith('.*')) {
    return { botName: fullName.slice(0, -2), versionFilter: 'all' };
  }
  const lastDot = fullName.lastIndexOf('.');
  return {
    botName: lastDot > 0 ? fullName.slice(0, lastDot) : fullName,
    versionFilter: 'highest'
  };
};

const addManifestComponentBatch = ({
  componentSet,
  include,
  components,
  registry
}: {
  componentSet: ComponentSetType;
  include: ComponentSetType;
  components: readonly MetadataComponent[];
  registry: RegistryAccess;
}): BotVersionFilter[] => {
  const componentsAndFilters = components.map(manifestComponent => {
    if (manifestComponent.type.name === 'BotVersion') {
      const botVersionFilter = parseBotVersionFullName(manifestComponent.fullName);
      return {
        component: {
          fullName: botVersionFilter.botName,
          type: registry.getTypeByName('Bot')
        },
        botVersionFilter
      };
    }
    return { component: manifestComponent, botVersionFilter: undefined };
  });

  componentsAndFilters.forEach(({ component }) => {
    include.add(component);
    componentSet.add(component);
  });

  return componentsAndFilters.flatMap(({ botVersionFilter }) => (botVersionFilter ? [botVersionFilter] : []));
};

const addManifestComponentsInBatches = ({
  componentSet,
  include,
  components,
  registry
}: {
  componentSet: ComponentSetType;
  include: ComponentSetType;
  components: readonly MetadataComponent[];
  registry: RegistryAccess;
}): void => {
  const botVersionFilters = Array.from(
    { length: Math.ceil(components.length / MANIFEST_COMPONENT_BATCH_SIZE) },
    (_, batchIndex) => batchIndex
  ).flatMap(batchIndex => {
    const batchStart = batchIndex * MANIFEST_COMPONENT_BATCH_SIZE;
    const batch = components.slice(batchStart, batchStart + MANIFEST_COMPONENT_BATCH_SIZE);
    return addManifestComponentBatch({ componentSet, include, components: batch, registry });
  });

  if (botVersionFilters.length > 0) {
    componentSet.botVersionFilters = botVersionFilters;
  }
};

const failedToBuildComponentSetFromManifest = (error: unknown): FailedToBuildComponentSetError => {
  const { cause } = unknownToErrorCause(error);
  return new FailedToBuildComponentSetError({
    message: `Failed to build ComponentSet from manifest: ${cause.message}`,
    cause
  });
};

const buildComponentSetFromManifest = Effect.fn('ComponentSetService.buildComponentSetFromManifest')(function* ({
  manifestPath,
  resolveSourcePaths,
  registry
}: {
  manifestPath: string;
  resolveSourcePaths: string[];
  registry: RegistryAccess;
}) {
  const manifest = yield* Effect.tryPromise({
    try: () => new ManifestResolver(undefined, registry).resolve(manifestPath),
    catch: failedToBuildComponentSetFromManifest
  });

  return yield* Effect.try({
    try: () => {
      const componentSet = new ComponentSet([], registry);
      const include = new ComponentSet([], registry);
      componentSet.sourceApiVersion = manifest.apiVersion;
      componentSet.fullName = manifest.fullName;

      addManifestComponentsInBatches({ componentSet, include, components: manifest.components, registry });

      const sourceComponents = ComponentSet.fromSource({ fsPaths: resolveSourcePaths, include, registry });
      componentSet.forceIgnoredPaths = sourceComponents.forceIgnoredPaths;
      // ComponentSet exposes only a mutating add operation.
      // eslint-disable-next-line functional/no-loop-statements
      for (const sourceComponent of sourceComponents) {
        componentSet.add(sourceComponent);
      }

      return componentSet;
    },
    catch: failedToBuildComponentSetFromManifest
  });
});

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
          HashSet.map(hu => uriToPath(hu.uri)),
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
      manifestUri: URI
    ) {
      return yield* Effect.gen(function* () {
        const manifestPath = uriToPath(manifestUri);
        yield* Effect.annotateCurrentSpan({ manifestUri: manifestUri.toString() });
        const [registryAccess, project, configAggregator] = yield* Effect.all(
          [
            metadataRegistryService.getRegistryAccess(),
            projectService.getSfProject(),
            configService.getConfigAggregator()
          ],
          { concurrency: 'unbounded' }
        );

        const componentSet = yield* buildComponentSetFromManifest({
          manifestPath,
          // Get package directories as full paths
          resolveSourcePaths: project.getPackageDirectories().map(pkgDir => pkgDir.fullPath),
          registry: registryAccess
        });

        yield* setComponentSetProperties({ componentSet, project, configAggregator });

        yield* Effect.annotateCurrentSpan({ size: componentSet.size });
        return componentSet;
      }).pipe(Effect.withSpan('getComponentSetFromManifest'));
    });

    // TODO: have all orgs, regardless of tracking, use the local source tracking; when there are no changes, this should not be recalculated
    // this'll require local tracking updates from all retrieves/deletes/deploys
    /** Get ComponentSet from all project package directories.
     * @param options.metadataMembers optional list of `{ type, fullName }` members (typically wildcards like
     * `{ type: 'LightningComponentBundle', fullName: '*' }`) used by SDR to narrow the resolved components by type.
     * No filtering when omitted - includes everything in the package directories. */
    const getComponentSetFromProjectDirectories = Effect.fn(
      'ComponentSetService.getComponentSetFromProjectDirectories'
    )(function* (options?: { metadataMembers?: readonly MetadataMember[] }) {
      return yield* Effect.gen(function* () {
        const [registryAccess, project, configAggregator] = yield* Effect.all(
          [
            metadataRegistryService.getRegistryAccess(),
            projectService.getSfProject(),
            configService.getConfigAggregator()
          ],
          { concurrency: 'unbounded' }
        );
        const sourcePaths = project.getPackageDirectories().map(pkgDir => pkgDir.fullPath);
        yield* Effect.annotateCurrentSpan({ sourcePaths });

        const include = options?.metadataMembers
          ? new ComponentSet(options.metadataMembers, registryAccess)
          : undefined;

        const componentSet = yield* Effect.try({
          try: () => ComponentSet.fromSource({ fsPaths: sourcePaths, include, registry: registryAccess }),
          catch: e => {
            const { cause } = unknownToErrorCause(e);
            return new FailedToBuildComponentSetError({
              message: `Failed to build ComponentSet from project directories: ${cause.message}`,
              cause
            });
          }
        });

        yield* setComponentSetProperties({ componentSet, project, configAggregator });

        yield* Effect.annotateCurrentSpan({ size: componentSet.size });
        return componentSet;
      }).pipe(Effect.withSpan('getComponentSetFromProjectDirectories'));
    });

    return {
      getComponentState,
      isSDRSuccess,
      isSDRFailure,
      makeFileResponseFailure,
      toRequestStatus,
      ensureNonEmptyComponentSet,
      getComponentSetFromUris,
      getComponentSetFromManifest,
      getComponentSetFromProjectDirectories
    };
  })
}) {}

/**
 * Set project directory, API version, and source API version on ComponentSet
 * side effect: mutates the componentSet in place.  There's not a good way to return a new componentSet with the properties set.
 */
export const setComponentSetProperties = Effect.fn('setComponentSetProperties')(function* ({
  componentSet,
  project,
  configAggregator,
  directory
}: {
  componentSet: ComponentSetType;
  project: SfProject;
  configAggregator: ConfigAggregator;
  /** if not provided, uses the project path.  Useful it retrieving to a custom directory. */
  directory?: URI;
}) {
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
  yield* Effect.annotateCurrentSpan({
    apiVersion: apiVersion ?? 'unset',
    sourceApiVersion: sourceApiVersion ? String(sourceApiVersion) : 'unset'
  });
});
