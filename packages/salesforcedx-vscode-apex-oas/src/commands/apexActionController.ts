/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { MixedFrameworksNotAllowed } from '../errors';
import { nls } from '../messages/nls';
import { processOasDocument } from '../oas/documentProcessorPipeline/oasProcessor';
import { generateEsrMD, pathExists } from '../oas/externalServiceRegistrationManager';
import { BidRule, selectStrategyByBidRule } from '../oas/promptGenerationOrchestrator';
import { checkIfESRIsDecomposed, hasMixedFrameworks, parseOASDocFromJson, summarizeDiagnostics } from '../oasUtils';
import { gatherContext, validateMetadata } from './metadataOrchestrator';

const getBidRule = (): BidRule => {
  const currentBidRule = vscode.workspace
    .getConfiguration()
    .get<BidRule>('salesforcedx-vscode-apex-oas.generation_strategy', 'LEAST_CALLS');
  return isBidRule(currentBidRule) ? currentBidRule : 'LEAST_CALLS';
};

const isBidRule = (value: unknown): value is BidRule => value === 'LEAST_CALLS' || value === 'MOST_CALLS';

/**
 * Creates an OpenAPI Document.
 */
export const createApexAction = Effect.fn('ApexOas.Command.createApexAction')(function* (sourceUri: URI | URI[]) {
  const command = 'SFDX: Create OpenAPI Document from This Class';
  const bidRule = getBidRule();

  // Step 1: Validate eligibility
  const eligibilityResult = yield* validateMetadata(sourceUri);

  // Step 2: Gather context
  const context = yield* gatherContext(sourceUri);

  // Step 2.5: Check for mixed frameworks (Apex Rest + AuraEnabled)
  if (hasMixedFrameworks(context)) {
    const className = path.basename(eligibilityResult.resourceUri.fsPath, '.cls');
    return yield* new MixedFrameworksNotAllowed({ message: nls.localize('mixed_frameworks_not_allowed', className) });
  }

  // Step 3-4: Select the generation strategy by bid rule
  const strategy = yield* selectStrategyByBidRule(eligibilityResult, context, bidRule);

  // Step 5: Determine filename
  const name = path.basename(eligibilityResult.resourceUri.fsPath, '.cls');
  const openApiFileName = `${name}.externalServiceRegistration-meta.xml`;

  // Step 6: Check if the file already exists
  const fullPath = yield* pathExists(openApiFileName);

  // Step 7: Use the strategy to generate the OAS
  const openApiDocument = yield* strategy.generateOAS();
  const telemetry = strategy.getTelemetry();

  // Step 8: Process the OAS document
  const processedOasResult = yield* processOasDocument(parseOASDocFromJson(openApiDocument), {
    context,
    eligibleResult: eligibilityResult,
    isRevalidation: false,
    betaInfo: undefined
  });

  // Step 9: Write OpenAPI Document to File
  const isESRDecomposed = yield* checkIfESRIsDecomposed();
  yield* generateEsrMD(isESRDecomposed, processedOasResult, fullPath);

  // Step 11: Gather metrics
  const overwrite = fullPath[0] === fullPath[1];
  const [errors, warnings, infos, hints, total] = summarizeDiagnostics(processedOasResult.errors);

  yield* Effect.annotateCurrentSpan({
    overwrite,
    strategy: telemetry.strategyName,
    biddedCallCount: telemetry.biddedCallCount,
    llmCallCount: telemetry.llmCallCount,
    generationSize: telemetry.generationSize,
    documentTtlProblems: total,
    documentErrors: errors,
    documentWarnings: warnings,
    documentInfo: infos,
    documentHints: hints,
    command
  });

  // Step 12: Notify Success — overwrite means user replaced the original ESR; otherwise a merge file was emitted alongside
  const message = overwrite
    ? nls.localize('openapi_doc_created', 'class', name)
    : nls.localize(
        'openapi_doc_created_merge',
        'class',
        path.basename(fullPath[1], '.externalServiceRegistration-meta.xml'),
        name
      );
  yield* Effect.promise(() => vscode.window.showInformationMessage(message));
});
