/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type {
  EmptyComponentSetError,
  FailedToBuildComponentSetError,
  FailedToCreateConfigAggregatorError,
  GetRegistryAccessError
} from './errors.js';
import type { ProjectError } from './projectService.js';
import type {
  isSDRFailure,
  isSDRSuccess,
  makeFileResponseFailure,
  toComponentStatusChangeType,
  toRequestStatus
} from './sdrGuards.js';
import type { ComponentSet, FileResponseSuccess, MetadataMember } from '@salesforce/source-deploy-retrieve';
import type * as Brand from 'effect/Brand';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import type { URI } from 'vscode-uri';

export type NonEmptyComponentSet = ComponentSet & Brand.Brand<'NonEmptyComponentSet'>;
export type ComponentSetBuildError =
  | ProjectError
  | GetRegistryAccessError
  | FailedToCreateConfigAggregatorError
  | FailedToBuildComponentSetError;
export class ComponentSetService extends Context.Service<
  ComponentSetService,
  {
    readonly getComponentState: (component: FileResponseSuccess) => ReturnType<typeof toComponentStatusChangeType>;
    readonly isSDRSuccess: typeof isSDRSuccess;
    readonly isSDRFailure: typeof isSDRFailure;
    readonly makeFileResponseFailure: typeof makeFileResponseFailure;
    readonly toRequestStatus: typeof toRequestStatus;
    readonly ensureNonEmptyComponentSet: (
      components: ComponentSet
    ) => Effect.Effect<NonEmptyComponentSet, EmptyComponentSetError>;
    readonly getComponentSetFromUris: (uris: readonly URI[]) => Effect.Effect<ComponentSet, ComponentSetBuildError>;
    readonly getComponentSetFromManifest: (manifestUri: URI) => Effect.Effect<ComponentSet, ComponentSetBuildError>;
    readonly getComponentSetFromProjectDirectories: (options?: {
      readonly metadataMembers?: readonly MetadataMember[];
    }) => Effect.Effect<ComponentSet, ComponentSetBuildError>;
    readonly setComponentSetProperties: (
      components: ComponentSet,
      directory?: URI
    ) => Effect.Effect<void, ProjectError | FailedToCreateConfigAggregatorError>;
  }
>()('@salesforce/vscode-services-v2/ComponentSetService') {}
