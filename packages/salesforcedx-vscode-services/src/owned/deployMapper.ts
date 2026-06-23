/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Adapter layer: maps SDR results to owned types. Imports SDR TYPES ONLY (no value imports), so consumers
// that transitively load this mapper don't pull SDR's runtime module graph.
import type { ComponentFailureInfo, DeployOutcome, FileResponseInfo, RetrieveOutcome } from './deploy';
import type { DeployMessage, DeployResult, FileResponse, RetrieveResult } from '@salesforce/source-deploy-retrieve';

const mapFileResponse = (fr: FileResponse): FileResponseInfo => ({
  fullName: fr.fullName,
  type: fr.type,
  state: fr.state,
  filePath: 'filePath' in fr ? fr.filePath : undefined,
  error: 'error' in fr ? fr.error : undefined,
  lineNumber: 'lineNumber' in fr ? fr.lineNumber : undefined,
  columnNumber: 'columnNumber' in fr ? fr.columnNumber : undefined,
  problemType: 'problemType' in fr ? fr.problemType : undefined
});

const toDeployMessageArray = (raw: DeployMessage | DeployMessage[] | undefined): DeployMessage[] =>
  raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];

const mapComponentFailure = (m: DeployMessage): ComponentFailureInfo => ({
  fullName: m.fullName,
  type: m.componentType ?? 'UNKNOWN',
  problem: m.problem ?? 'UNKNOWN',
  problemType: m.problemType ?? 'Error'
});

// RequestStatus is a string enum; compare to its string values to avoid a runtime value-import of SDR.
const appliedToOrg = (status: string): boolean => status === 'Succeeded' || status === 'SucceededPartial';

export const toDeployOutcome = (result: DeployResult): DeployOutcome => ({
  success: result.response.success,
  status: result.response.status,
  appliedToOrg: appliedToOrg(result.response.status),
  completedDate: result.response.completedDate,
  fileResponses: result.getFileResponses().map(mapFileResponse),
  componentFailures: toDeployMessageArray(result.response.details?.componentFailures).map(mapComponentFailure),
  errorMessage: result.response.errorMessage
});

export const toRetrieveOutcome = (result: RetrieveResult): RetrieveOutcome => {
  const fileProperties = result.response?.fileProperties;
  const normalizedProperties =
    fileProperties === undefined ? [] : Array.isArray(fileProperties) ? fileProperties : [fileProperties];

  return {
    success: result.response.success,
    status: result.response.status,
    fileResponses: result.getFileResponses().map(mapFileResponse),
    components: normalizedProperties.map(fp => ({
      type: fp.type,
      fullName: fp.fullName,
      lastModifiedDate: fp.lastModifiedDate
    }))
  };
};
