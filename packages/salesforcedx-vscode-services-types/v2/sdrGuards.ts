/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { MetadataChangeType } from './metadataChangeNotificationService.js';
import type { FileResponse, FileResponseFailure, FileResponseSuccess } from '@salesforce/source-deploy-retrieve';
// Import the SDK's data-only enums, not its Node deployment implementation, from this contract package.
import { ComponentStatus, RequestStatus } from '@salesforce/source-deploy-retrieve/lib/src/client/types.js';
import { isNotUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';

export const RequestStatusValue = Schema.Enum(RequestStatus);
export type RequestStatusValue = `${RequestStatus}`;
export const isSDRSuccess = (response: FileResponse): response is FileResponseSuccess =>
  response.state !== ComponentStatus.Failed;
export const isSDRFailure = (response: FileResponse): response is FileResponseFailure =>
  response.state === ComponentStatus.Failed;
export const fileResponseHasPath = (
  response: FileResponseSuccess
): response is FileResponseSuccess & { filePath: string } => isNotUndefined(response.filePath);
const changeTypes = {
  [ComponentStatus.Created]: 'created',
  [ComponentStatus.Changed]: 'changed',
  [ComponentStatus.Unchanged]: 'unchanged',
  [ComponentStatus.Deleted]: 'deleted'
} as const;
export const toComponentStatusChangeType = (
  state: Exclude<ComponentStatus, ComponentStatus.Failed>
): MetadataChangeType => changeTypes[state];
export const toRequestStatus = (status: RequestStatus): RequestStatusValue => status;
export const makeFileResponseFailure = (fields: {
  readonly fullName: string;
  readonly type: string;
  readonly error: string;
  readonly problemType?: 'Warning' | 'Error';
  readonly filePath?: string;
}): FileResponseFailure => ({ ...fields, state: ComponentStatus.Failed, problemType: fields.problemType ?? 'Error' });
