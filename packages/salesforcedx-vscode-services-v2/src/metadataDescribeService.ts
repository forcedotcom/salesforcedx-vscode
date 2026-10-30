/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ConnectionError } from './connectionService.js';
import type { OrgId } from './defaultOrgInfo.js';
import type { InactiveOrgOperationError, ListMetadataError, MetadataDescribeError } from './errors.js';
import type { FilePropertiesSchema } from './fileProperties.js';
import type { DescribeSObjectResult } from './transmogrifierService.js';
import type { Connection } from '@salesforce/core';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import type * as Option from 'effect/Option';
import type * as Schema from 'effect/Schema';
import type * as Stream from 'effect/Stream';

export type MetadataTypeDescription = Awaited<
  ReturnType<Connection['metadata']['describe']>
>['metadataObjects'][number];
export type SObjectGlobalDescribeItem = Pick<
  Awaited<ReturnType<Connection['describeGlobal']>>['sobjects'][number],
  'name' | 'custom' | 'queryable' | 'triggerable'
>;
export type MetadataDescribeReadError =
  | ConnectionError
  | InactiveOrgOperationError
  | MetadataDescribeError
  | Schema.SchemaError;
export type MetadataListReadError = ConnectionError | InactiveOrgOperationError | ListMetadataError;
export const FOLDERED_METADATA_TYPES: ReadonlySet<string> = new Set([
  'Dashboard',
  'Document',
  'EmailTemplate',
  'Report'
]);
export class MetadataDescribeService extends Context.Service<
  MetadataDescribeService,
  {
    readonly describe: (expectedOrgId?: OrgId) => Effect.Effect<MetadataTypeDescription[], MetadataDescribeReadError>;
    readonly listSObjects: (
      expectedOrgId?: OrgId
    ) => Effect.Effect<SObjectGlobalDescribeItem[], MetadataDescribeReadError>;
    readonly describeCustomObject: (
      objectName: string,
      expectedOrgId?: OrgId
    ) => Effect.Effect<DescribeSObjectResult, MetadataDescribeReadError>;
    readonly describeCustomObjects: (
      objectNames: string[],
      expectedOrgId?: OrgId
    ) => Effect.Effect<Stream.Stream<DescribeSObjectResult, MetadataDescribeReadError>, MetadataDescribeReadError>;
    readonly listMetadata: (
      type: string,
      folder?: string,
      expectedOrgId?: OrgId
    ) => Effect.Effect<(typeof FilePropertiesSchema.Type)[], MetadataListReadError>;
    readonly listMetadataCached: (
      type: string,
      folder?: string,
      expectedOrgId?: OrgId
    ) => Effect.Effect<
      Option.Option<(typeof FilePropertiesSchema.Type)[]>,
      ConnectionError | InactiveOrgOperationError
    >;
    readonly invalidateDescribe: (expectedOrgId?: OrgId) => Effect.Effect<void>;
    readonly invalidateListMetadata: (type: string, folder?: string, expectedOrgId?: OrgId) => Effect.Effect<void>;
    readonly invalidateAllListMetadata: (expectedOrgId?: OrgId) => Effect.Effect<void>;
    readonly invalidateSObjectDescribe: (objectName: string, expectedOrgId?: OrgId) => Effect.Effect<void>;
    readonly invalidateSObjectDescribes: (
      objectNames?: readonly string[],
      expectedOrgId?: OrgId
    ) => Effect.Effect<void>;
    readonly invalidateListSObjects: (expectedOrgId?: OrgId) => Effect.Effect<void>;
    readonly invalidateForMetadataChanges: (
      orgId: OrgId,
      references: readonly { readonly xmlName: string; readonly fullName: string }[]
    ) => Effect.Effect<void>;
  }
>()('@salesforce/vscode-services-v2/MetadataDescribeService') {}
