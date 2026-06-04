/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { annotateRootSpan } from '@salesforce/effect-ext-utils';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { nls } from '../messages/nls';
import { processOasDocument } from '../oas/documentProcessorPipeline/oasProcessor';
import { generateEsrMD, pathExists } from '../oas/externalServiceRegistrationManager';
import { selectStrategyByBidRule } from '../oas/promptGenerationOrchestrator';
import { checkIfESRIsDecomposed, hasMixedFrameworks, parseOASDocFromJson, summarizeDiagnostics } from '../oasUtils';
import { gatherContext, validateMetadata } from './metadataOrchestrator';

/** @ExportTaggedError */
export class MixedFrameworksNotAllowed extends Data.TaggedError('MixedFrameworksNotAllowed')<{
  readonly message: string;
}> {}

/**
 * Creates an OpenAPI Document.
 */
export const createApexAction = Effect.fn('ApexOas.Command.createApexAction')(function* (sourceUri: URI | URI[]) {
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
  const strategy = yield* selectStrategyByBidRule(eligibilityResult, context);

  // Step 5: Determine filename
  const name = path.basename(eligibilityResult.resourceUri.fsPath, '.cls');
  const openApiFileName = `${name}.externalServiceRegistration-meta.xml`;

  // Step 6: Check if the file already exists
  const fullPath = yield* pathExists(openApiFileName);

  // Step 7: Use the strategy to generate the OAS
  const openApiDocument = yield* strategy.generateOAS();

  // Step 8: Process the OAS document
  const processedOasResult = yield* processOasDocument(parseOASDocFromJson(openApiDocument), {
    context,
    eligibleResult: eligibilityResult,
    isRevalidation: false
  });

  // Step 9: Write OpenAPI Document to File
  const isESRDecomposed = yield* checkIfESRIsDecomposed();
  yield* generateEsrMD(isESRDecomposed, processedOasResult, fullPath);

  // Step 11: Gather metrics
  const overwrite = fullPath[0] === fullPath[1];
  const [errors, warnings, infos, hints, total] = summarizeDiagnostics(processedOasResult.errors);

  yield* annotateRootSpan({
    overwrite,
    documentTtlProblems: total,
    documentErrors: errors,
    documentWarnings: warnings,
    documentInfo: infos,
    documentHints: hints,
    command: 'SFDX: Create OpenAPI Document from This Class'
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
