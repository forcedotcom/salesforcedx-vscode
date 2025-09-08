/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import type { MetadataDescribeService } from 'salesforcedx-vscode-services/src/core/metadataDescribeService';

export type MetadataDescribeResultItem = Effect.Effect.Success<ReturnType<MetadataDescribeService['describe']>>[number];
export type CustomObjectField = Effect.Effect.Success<
  ReturnType<MetadataDescribeService['describeCustomObject']>
>['fields'][number];
export type MetadataListResultItem = Effect.Effect.Success<ReturnType<MetadataDescribeService['listMetadata']>>[number];
