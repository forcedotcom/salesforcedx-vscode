/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { MetadataDeployError, UserCancellationError } from './errors.js';
import type { SourceTrackingOperationError } from './sourceTrackingService.js';
import type { ComponentSet, DeployResult } from '@salesforce/source-deploy-retrieve';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import type * as vscode from 'vscode';

export type MetadataDeployOperationError = SourceTrackingOperationError | MetadataDeployError | UserCancellationError;
export class MetadataDeployService extends Context.Service<
  MetadataDeployService,
  {
    readonly getComponentSetForDeploy: () => Effect.Effect<ComponentSet, SourceTrackingOperationError>;
    readonly deploy: (
      components: ComponentSet,
      options?: { readonly progressLocation?: vscode.ProgressLocation }
    ) => Effect.Effect<DeployResult, MetadataDeployOperationError>;
  }
>()('@salesforce/vscode-services-v2/MetadataDeployService') {}
