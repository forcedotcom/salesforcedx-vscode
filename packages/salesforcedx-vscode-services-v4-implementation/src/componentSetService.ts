/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { OrgConfigProperties } from '@salesforce/core';
import { ComponentSet, type MetadataMember } from '@salesforce/source-deploy-retrieve';
import {
  ComponentSetService,
  ConfigService,
  EmptyComponentSetError,
  FailedToBuildComponentSetError,
  FailedToResolveSfProjectError,
  HashableUri,
  MetadataRegistryService,
  ProjectService,
  isSDRFailure,
  isSDRSuccess,
  makeFileResponseFailure,
  toComponentStatusChangeType,
  toRequestStatus,
  type NonEmptyComponentSet
} from '@salesforce/vscode-services-v2';
import * as Brand from 'effect/Brand';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import type { URI } from 'vscode-uri';
import { unknownToErrorCause } from './errorCause.js';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';
import { uriToPath } from './uriUtils.js';

const nonEmpty = Brand.make<NonEmptyComponentSet>(
  components =>
    components.size > 0 ||
    [...components.getSourceComponents()].length > 0 ||
    `Expected ComponentSet to be non-empty, but got size ${components.size}`
);
const buildFailure = (cause: unknown) => new FailedToBuildComponentSetError(unknownToErrorCause(cause));
export const ComponentSetServiceLayer = Layer.effect(
  ComponentSetService,
  Effect.gen(function* () {
    const registry = yield* MetadataRegistryService;
    const projects = yield* ProjectService;
    const config = yield* ConfigService;
    const operations = yield* ServiceOperations;
    const ensureNonEmptyComponentSet = Effect.fn('ComponentSetService.ensureNonEmptyComponentSet')(
      (components: ComponentSet): Effect.Effect<NonEmptyComponentSet, EmptyComponentSetError> =>
        Option.match(nonEmpty.option(components), {
          onNone: () =>
            Effect.fail(
              new EmptyComponentSetError({
                message: `Expected ComponentSet to be non-empty, but got size ${components.size}`,
                size: components.size
              })
            ),
          onSome: Effect.succeed
        }),
      operations.run
    );
    const setComponentSetProperties = Effect.fn('ComponentSetService.setComponentSetProperties')(function* (
      components: ComponentSet,
      directory?: URI
    ) {
      const [project, aggregator] = yield* Effect.all([projects.getSfProject(), config.getConfigAggregator()], {
        concurrency: 'unbounded'
      });
      const json = yield* Effect.tryPromise({
        try: () => project.retrieveSfProjectJson(),
        catch: cause => new FailedToResolveSfProjectError(unknownToErrorCause(cause))
      });
      const apiVersion = aggregator.getPropertyValue<string>(OrgConfigProperties.ORG_API_VERSION);
      const sourceApiVersion = json.get<string>('sourceApiVersion');
      components.projectDirectory = directory ? uriToPath(directory) : project.getPath();
      if (apiVersion) components.apiVersion = apiVersion;
      if (sourceApiVersion) components.sourceApiVersion = String(sourceApiVersion);
      yield* Effect.annotateCurrentSpan({
        apiVersion: apiVersion ?? 'unset',
        sourceApiVersion: sourceApiVersion ? String(sourceApiVersion) : 'unset'
      });
    }, operations.run);
    const getComponentSetFromUris = Effect.fn('ComponentSetService.getComponentSetFromUris')(function* (
      uris: readonly URI[]
    ) {
      const access = yield* registry.getRegistryAccess();
      const paths = [
        ...HashSet.map(HashSet.fromIterable(uris.map(HashableUri.fromUri)), value => uriToPath(value.uri))
      ];
      const components = yield* Effect.try({
        try: () => ComponentSet.fromSource({ fsPaths: paths, registry: access }),
        catch: buildFailure
      });
      yield* setComponentSetProperties(components);
      yield* Effect.annotateCurrentSpan({ paths, size: components.size });
      return components;
    }, operations.run);
    const getComponentSetFromManifest = Effect.fn('ComponentSetService.getComponentSetFromManifest')(function* (
      manifestUri: URI
    ) {
      const [access, project] = yield* Effect.all([registry.getRegistryAccess(), projects.getSfProject()], {
        concurrency: 'unbounded'
      });
      const components = yield* Effect.tryPromise({
        try: () =>
          ComponentSet.fromManifest({
            manifestPath: uriToPath(manifestUri),
            resolveSourcePaths: project.getPackageDirectories().map(directory => directory.fullPath),
            forceAddWildcards: true,
            registry: access
          }),
        catch: buildFailure
      });
      yield* setComponentSetProperties(components);
      yield* Effect.annotateCurrentSpan({ manifestUri: manifestUri.toString(), size: components.size });
      return components;
    }, operations.run);
    const getComponentSetFromProjectDirectories = Effect.fn(
      'ComponentSetService.getComponentSetFromProjectDirectories'
    )(function* (options?: { readonly metadataMembers?: readonly MetadataMember[] }) {
      const [access, project] = yield* Effect.all([registry.getRegistryAccess(), projects.getSfProject()], {
        concurrency: 'unbounded'
      });
      const components = yield* Effect.try({
        try: () =>
          ComponentSet.fromSource({
            fsPaths: project.getPackageDirectories().map(directory => directory.fullPath),
            ...(options?.metadataMembers ? { include: new ComponentSet(options.metadataMembers, access) } : {}),
            registry: access
          }),
        catch: buildFailure
      });
      yield* setComponentSetProperties(components);
      yield* Effect.annotateCurrentSpan('size', components.size);
      return components;
    }, operations.run);
    yield* Effect.addFinalizer(() => operations.close);
    return ComponentSetService.of({
      getComponentState: response => toComponentStatusChangeType(response.state),
      isSDRSuccess,
      isSDRFailure,
      makeFileResponseFailure,
      toRequestStatus,
      ensureNonEmptyComponentSet,
      setComponentSetProperties,
      getComponentSetFromUris,
      getComponentSetFromManifest,
      getComponentSetFromProjectDirectories
    });
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));
