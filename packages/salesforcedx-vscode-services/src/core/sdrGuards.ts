/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { type FileResponse, type FileResponseSuccess, ComponentStatus } from '@salesforce/source-deploy-retrieve';

export const isFileResponseSuccess = (fileResponse: FileResponse): fileResponse is FileResponseSuccess =>
  fileResponse.state !== ComponentStatus.Failed;

export const fileResponseHasPath = (
  fileResponse: FileResponseSuccess
): fileResponse is FileResponseSuccess & { filePath: string } => fileResponse.filePath !== undefined;
