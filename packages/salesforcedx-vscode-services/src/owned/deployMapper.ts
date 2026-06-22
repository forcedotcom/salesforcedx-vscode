/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Adapter layer: maps SDR results to owned types. MAY import SDR.
import type { DeployOutcome, RetrieveOutcome, FileResponseInfo } from './deploy';
import type { DeployResult, RetrieveResult, FileResponse } from '@salesforce/source-deploy-retrieve';

const mapFileResponse = (fr: FileResponse): FileResponseInfo => ({
  fullName: fr.fullName,
  type: fr.type,
  state: fr.state,
  filePath: fr.filePath,
  error: 'error' in fr ? fr.error : undefined
});

export const toDeployOutcome = (result: DeployResult): DeployOutcome => ({
  success: result.response.success,
  status: result.response.status,
  fileResponses: result.getFileResponses().map(mapFileResponse)
});

export const toRetrieveOutcome = (result: RetrieveResult): RetrieveOutcome => ({
  success: result.response.success,
  status: result.response.status,
  fileResponses: result.getFileResponses().map(mapFileResponse)
});
