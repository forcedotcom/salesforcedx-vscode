/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfProject } from '@salesforce/core-bundle';
import { workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { parse } from 'yaml';
import { nls } from '../messages';
import OasProcessor from './documentProcessorPipeline';
import { ProcessorInputOutput } from './documentProcessorPipeline/processorStep';
import GenerationInteractionLogger from './generationInteractionLogger';
import { ApexClassOASGatherContextResponse, ApexClassOASEligibleResponse } from './schemas';

const gil = GenerationInteractionLogger.getInstance();

export const processOasDocument = async (
  oasDoc: string,
  context?: ApexClassOASGatherContextResponse,
  eligibleResult?: ApexClassOASEligibleResponse,
  isRevalidation?: boolean
): Promise<ProcessorInputOutput> => {
  if (isRevalidation || context?.classDetail.annotations.find(a => a.name === 'RestResource')) {
    const parsed = parse(oasDoc);
    const oasProcessor = new OasProcessor(parsed, eligibleResult);

    const processResult = await oasProcessor.process();

    return processResult;
  }
  throw nls.localize('invalid_file_for_processing_oas_doc');
};

export const createProblemTabEntriesForOasDocument = (
  fullPath: string,
  processedOasResult: ProcessorInputOutput,
  isESRDecomposed: boolean
): void => {
  const uri = vscode.Uri.parse(fullPath);
  OasProcessor.diagnosticCollection.clear();

  const adjustErrors = processedOasResult.errors.map(result => {
    // if embedded inside of ESR.xml then position is hardcoded because of `apexActionController.createESRObject`
    const lineAdjustment = isESRDecomposed ? 0 : 4;
    const startCharacterAdjustment = isESRDecomposed ? 0 : 11;
    const range = new vscode.Range(
      result.range.start.line + lineAdjustment,
      result.range.start.character + result.range.start.line <= 1 ? startCharacterAdjustment : 0,
      result.range.end.line + lineAdjustment,
      result.range.end.character + result.range.start.line <= 1 ? startCharacterAdjustment : 0
    );
    return new vscode.Diagnostic(range, result.message, result.severity);
  });

  gil.addDiagnostics(adjustErrors);

  const mulesoftExtension = vscode.extensions.getExtension('salesforce.mule-dx-agentforce-api-component');
  if (!mulesoftExtension?.isActive) {
    OasProcessor.diagnosticCollection.set(uri, adjustErrors);
  }
};

/**
 * Reads sfdx-project.json and checks if decomposeExternalServiceRegistrationBeta is enabled.
 * @returns boolean - true if sfdx-project.json contains decomposeExternalServiceRegistrationBeta
 */
export const checkIfESRIsDecomposed = async (): Promise<boolean> => {
  const projectPath = workspaceUtils.getRootWorkspacePath();
  const sfProject = await SfProject.resolve(projectPath);
  const sfdxProjectJson = sfProject.getSfProjectJson();
  if (sfdxProjectJson.getContents().sourceBehaviorOptions?.includes('decomposeExternalServiceRegistrationBeta')) {
    return true;
  }

  return false;
};

export const summarizeDiagnostics = (diagnostices: vscode.Diagnostic[]): number[] => {
  return diagnostices.reduce(
    (acc, cur) => {
      acc[cur.severity] += 1;
      acc[acc.length - 1] += 1; // [error, warning, info, hint, total
      return acc;
    },
    [0, 0, 0, 0, 0]
  );
};
