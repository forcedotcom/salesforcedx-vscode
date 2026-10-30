/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ConnectionError } from './connectionService.js';
import type { OrgId } from './defaultOrgInfo.js';
import type {
  GetRegistryAccessError,
  InactiveOrgOperationError,
  SourceTrackingConflictError,
  SourceTrackingError,
  SourceTrackingNotEnabledError
} from './errors.js';
import type { ProjectError } from './projectService.js';
import type { ComponentSet, DeployResult, RetrieveResult } from '@salesforce/source-deploy-retrieve';
import type { SourceTracking } from '@salesforce/source-tracking';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';

export type SourceTrackingReadError =
  | ConnectionError
  | ProjectError
  | GetRegistryAccessError
  | InactiveOrgOperationError
  | SourceTrackingError;
export type SourceTrackingOperationError = SourceTrackingReadError | SourceTrackingNotEnabledError;
export type SourceTrackingStatusOptions =
  | { local: true; remote?: never }
  | { remote: true; local?: never }
  | { local: true; remote: true };
export class SourceTrackingService extends Context.Service<
  SourceTrackingService,
  {
    readonly hasTracking: (expectedOrgId?: OrgId) => Effect.Effect<boolean, SourceTrackingReadError>;
    readonly getLocalChangesAsComponentSet: () => Effect.Effect<
      Awaited<ReturnType<SourceTracking['localChangesAsComponentSet']>>,
      SourceTrackingOperationError
    >;
    readonly getRemoteNonDeletesAsComponentSet: (options: {
      applyIgnore: boolean;
    }) => Effect.Effect<ComponentSet, SourceTrackingOperationError>;
    readonly getRemoteDeletesAsComponentSet: () => Effect.Effect<ComponentSet, SourceTrackingOperationError>;
    readonly resetRemoteTracking: () => Effect.Effect<number, SourceTrackingOperationError>;
    readonly getStatus: (
      options: SourceTrackingStatusOptions,
      expectedOrgId?: OrgId
    ) => Effect.Effect<Awaited<ReturnType<SourceTracking['getStatus']>>, SourceTrackingOperationError>;
    readonly maybeApplyRemoteDeletesToLocal: () => Effect.Effect<
      {
        componentSetFromNonDeletes: ComponentSet;
        fileResponsesFromDelete: Awaited<ReturnType<RetrieveResult['getFileResponses']>>;
      },
      SourceTrackingOperationError
    >;
    readonly getConflicts: (
      expectedOrgId?: OrgId
    ) => Effect.Effect<Awaited<ReturnType<SourceTracking['getConflicts']>>, SourceTrackingOperationError>;
    readonly checkConflicts: (
      expectedOrgId?: OrgId
    ) => Effect.Effect<void, SourceTrackingOperationError | SourceTrackingConflictError>;
    readonly maybeUpdateTrackingFromRetrieve: (
      result: RetrieveResult,
      expectedOrgId?: OrgId
    ) => Effect.Effect<void, SourceTrackingOperationError>;
    readonly maybeUpdateTrackingFromDeploy: (result: DeployResult) => Effect.Effect<void, SourceTrackingOperationError>;
  }
>()('@salesforce/vscode-services-v2/SourceTrackingService') {}
