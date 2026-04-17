/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/** Parsed JSON object (not array, not null). */
export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** File entry from SDR retrieve outcome `getFileResponses()` (see MetadataRetrieveService). */
export type MetadataRetrieveFileResponse = {
  readonly filePath?: string;
};

/** Minimal retrieve poll result shape with `getFileResponses()` from @salesforce/source-deploy-retrieve. */
type MetadataRetrieveOutcomeLike = {
  getFileResponses(): readonly MetadataRetrieveFileResponse[];
};

export const isMetadataRetrieveOutcomeLike = (value: unknown): value is MetadataRetrieveOutcomeLike => {
  if (!isPlainObject(value)) {
    return false;
  }
  return typeof value['getFileResponses'] === 'function';
};

export const isMetadataRetrieveFileResponse = (value: unknown): value is MetadataRetrieveFileResponse => {
  if (!isPlainObject(value)) {
    return false;
  }
  const fp = value['filePath'];
  return fp === undefined || typeof fp === 'string';
};
