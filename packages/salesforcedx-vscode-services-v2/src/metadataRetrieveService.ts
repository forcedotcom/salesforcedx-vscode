/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ComponentSetBuildError, NonEmptyComponentSet } from './componentSetService.js';
import type { ConnectionError } from './connectionService.js';
import type { OrgId } from './defaultOrgInfo.js';
import type {
  FailedToBuildComponentSetError,
  GetRegistryAccessError,
  InactiveOrgOperationError,
  MetadataRetrieveError,
  NoWorkspaceOpenError,
  SourceTrackingConflictError,
  UserCancellationError
} from './errors.js';
import type { SourceTrackingOperationError } from './sourceTrackingService.js';
import type { ComponentSet, MetadataMember, RetrieveResult } from '@salesforce/source-deploy-retrieve';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import type * as vscode from 'vscode';
import type { URI } from 'vscode-uri';

export type MetadataRetrieveDirectoryError =
  | ComponentSetBuildError
  | ConnectionError
  | InactiveOrgOperationError
  | MetadataRetrieveError
  | UserCancellationError;
export type MetadataRetrieveOptions = {
  readonly ignoreConflicts?: boolean;
  readonly expectedOrgId?: OrgId;
  readonly progressLocation?: vscode.ProgressLocation;
};
export type MetadataRetrieveOperationError =
  | MetadataRetrieveDirectoryError
  | SourceTrackingOperationError
  | SourceTrackingConflictError;
export class MetadataRetrieveService extends Context.Service<
  MetadataRetrieveService,
  {
    readonly retrieve: (
      members: MetadataMember[],
      options?: MetadataRetrieveOptions
    ) => Effect.Effect<RetrieveResult, MetadataRetrieveOperationError>;
    readonly retrieveComponentSet: (
      components: ComponentSet,
      options?: MetadataRetrieveOptions
    ) => Effect.Effect<RetrieveResult, MetadataRetrieveOperationError>;
    readonly buildComponentSet: (
      members: MetadataMember[]
    ) => Effect.Effect<ComponentSet, GetRegistryAccessError | NoWorkspaceOpenError | FailedToBuildComponentSetError>;
    readonly buildComponentSetFromSource: (
      sourcePaths: string[],
      filterMembers: MetadataMember[]
    ) => Effect.Effect<ComponentSet, GetRegistryAccessError | NoWorkspaceOpenError | FailedToBuildComponentSetError>;
    readonly retrieveComponentSetToDirectory: (
      components: NonEmptyComponentSet,
      outputPath: URI,
      options?: { readonly progressLocation?: vscode.ProgressLocation; readonly expectedOrgId?: OrgId }
    ) => Effect.Effect<RetrieveResult, MetadataRetrieveDirectoryError>;
  }
>()('@salesforce/vscode-services-v2/MetadataRetrieveService') {}
