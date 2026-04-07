/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ComponentStatus,
  type FileResponse,
  type FileResponseFailure,
  type FileResponseSuccess,
  SourceComponent,
  type MetadataComponent
} from '@salesforce/source-deploy-retrieve';
import * as Match from 'effect/Match';
import * as Schema from 'effect/Schema';

export const MetadataChangeType = Schema.Literal('created', 'changed', 'unchanged', 'deleted');
export type MetadataChangeType = Schema.Schema.Type<typeof MetadataChangeType>;

export const isSourceComponent = (component: MetadataComponent): component is SourceComponent =>
  component instanceof SourceComponent;

export const isSDRSuccess = (fileResponse: FileResponse): fileResponse is FileResponseSuccess =>
  fileResponse.state !== ComponentStatus.Failed;

export const isSDRFailure = (fileResponse: FileResponse): fileResponse is FileResponseFailure =>
  fileResponse.state === ComponentStatus.Failed;

export const fileResponseHasPath = (
  fileResponse: FileResponseSuccess
): fileResponse is FileResponseSuccess & { filePath: string } => fileResponse.filePath !== undefined;

export const toComponentStatusChangeType = (
  state: Exclude<ComponentStatus, ComponentStatus.Failed>
): MetadataChangeType =>
  Match.value(state).pipe(
    Match.withReturnType<MetadataChangeType>(),
    Match.when(ComponentStatus.Created, () => 'created'),
    Match.when(ComponentStatus.Changed, () => 'changed'),
    Match.when(ComponentStatus.Unchanged, () => 'unchanged'),
    Match.when(ComponentStatus.Deleted, () => 'deleted'),
    Match.exhaustive
  );
