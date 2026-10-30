/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SObjectArtifactIdentity } from './artifactIdentity.js';
import type { SObjectSemanticModel } from './artifactProjection.js';
import type { TransmogrifierError } from './errors.js';
import type { SObjectSchema, SObject } from './sObject.js';
import type { Connection } from '@salesforce/core';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import type * as Schema from 'effect/Schema';
import type { URI } from 'vscode-uri';

export type DescribeSObjectResult = Awaited<ReturnType<Connection['describe']>>;
export type RestSObjectDescribeTransmogrifierInput = {
  readonly source: 'rest-sobject-describe';
  readonly identity: SObjectArtifactIdentity;
  readonly value: DescribeSObjectResult;
};
export type WorkspaceSObjectMetadataDocument = {
  readonly fullName: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly definitionUri: URI;
};
export type WorkspaceSObjectMetadataTransmogrifierInput = {
  readonly source: 'workspace-sobject-metadata';
  readonly identity: SObjectArtifactIdentity;
  readonly value: {
    readonly object: WorkspaceSObjectMetadataDocument;
    readonly fields: readonly WorkspaceSObjectMetadataDocument[];
  };
};
export type PersistedSObjectSemanticModelTransmogrifierInput = {
  readonly source: 'persisted-semantic-model';
  readonly identity: SObjectArtifactIdentity;
  readonly value: unknown;
};
export type TransmogrifierInput =
  | RestSObjectDescribeTransmogrifierInput
  | WorkspaceSObjectMetadataTransmogrifierInput
  | PersistedSObjectSemanticModelTransmogrifierInput;
export class TransmogrifierService extends Context.Service<
  TransmogrifierService,
  {
    readonly toMinimalSObject: (raw: DescribeSObjectResult) => Effect.Effect<SObject, Schema.SchemaError>;
    readonly decodeSObject: (input: unknown) => Effect.Effect<SObject, Schema.SchemaError>;
    readonly toSemanticModel: (input: TransmogrifierInput) => Effect.Effect<SObjectSemanticModel, TransmogrifierError>;
    readonly SObjectSchema: typeof SObjectSchema;
  }
>()('@salesforce/vscode-services-v2/TransmogrifierService') {}
