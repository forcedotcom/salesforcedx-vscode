/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OASGenerationCommandMeasure, OASGenerationCommandProperties } from '../oas/schemas';
import { getOrgApiVersion, notificationService, WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { nls } from '../messages/nls';
import { ExternalServiceRegistrationManager, FullPath, pathExists } from '../oas/externalServiceRegistrationManager';
import GenerationInteractionLogger from '../oas/generationInteractionLogger';
import { BidRule, PromptGenerationOrchestrator as GenerationOrchestrator } from '../oas/promptGenerationOrchestrator';
import { checkIfESRIsDecomposed, processOasDocument, summarizeDiagnostics, hasMixedFrameworks } from '../oasUtils';
import { telemetryService } from '../telemetry/telemetryService';
import { gatherContext, validateMetadata } from './metadataOrchestrator';

export class ApexActionController {
  private isESRDecomposed: boolean = false;
  private gil = GenerationInteractionLogger.getInstance();
  private esrHandler: ExternalServiceRegistrationManager;
  constructor() {
    this.esrHandler = new ExternalServiceRegistrationManager();
  }

  public async initialize(extensionContext: vscode.ExtensionContext) {
    await WorkspaceContextUtil.getInstance().initialize(extensionContext);
    this.isESRDecomposed = await checkIfESRIsDecomposed();
  }

  /**
   * Creates an OpenAPI Document.
   * @param isClass - Indicates if the action is for a class or a method.
   */
  public createApexAction = async (isClass: boolean, sourceUri: URI | URI[]): Promise<void> => {
    const type = isClass ? 'Class' : 'Method';
    const createdMessage = `OASDocumentFor${type}Created`;
    const command = isClass
      ? 'SFDX: Create OpenAPI Document from This Class'
      : 'SFDX: Create OpenAPI Document from Selected Method';
    let eligibilityResult;
    let context;
    let name: string = 'Should Never Be Empty';
    let overwrite = true;
    this.gil.clear();
    const startTime = globalThis.performance.now();
    let props: OASGenerationCommandProperties = {
      isClass: `${isClass}`,
      overwrite: 'false',
      strategy: 'unknown'
    };

    let measures: OASGenerationCommandMeasure = {
      generationDuration: 0,
      llmCallCount: 0,
      biddedCallCount: 0,
      generationSize: 0,
      documentTtlProblems: 0,
      documentErrors: 0,
      documentWarnings: 0,
      documentInfo: 0,
      documentHints: 0
    };

    try {
      let fullPath: FullPath = ['', ''];
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: command,
          cancellable: true
        },
        async progress => {
          // Step 1: Validate eligibility
          progress.report({ message: nls.localize('validate_eligibility') });
          eligibilityResult = await validateMetadata(sourceUri, !isClass);
          if (!eligibilityResult) {
            throw new Error(nls.localize('class_validation_failed', type));
          }

          nls.localize('apex_class_not_valid', '123');

          // Step 2: Gather context
          progress.report({ message: nls.localize('gathering_context') });
          context = await gatherContext(sourceUri);
          if (!context) {
            throw new Error(nls.localize('cannot_gather_context'));
          }

          // Step 2.5: Check for mixed frameworks (Apex Rest + AuraEnabled)
          if (hasMixedFrameworks(context)) {
            const className = path.basename(eligibilityResult.resourceUri.fsPath, '.cls');
            throw new Error(nls.localize('mixed_frameworks_not_allowed', className));
          }

          // Step 3: Initialize the strategy orchestrator
          progress.report({ message: nls.localize('generating_oas_doc') });
          const generationOrchestrator = new GenerationOrchestrator(eligibilityResult, context);

          // Step 4: Get the strategy
          const strategy = await generationOrchestrator.selectStrategyByBidRule(getBidRule());

          // Step 5: Determine filename
          name = path.basename(eligibilityResult.resourceUri.fsPath, '.cls');
          const openApiFileName = `${name}.externalServiceRegistration-meta.xml`;

          // Step 6: Check if the file already exists
          progress.report({ message: nls.localize('get_document_path') });
          fullPath = await pathExists(openApiFileName);
          if (!fullPath) throw new Error(nls.localize('full_path_failed'));

          // Step 7: Use the strategy to generate the OAS
          const generationStartTime = globalThis.performance.now();
          const openApiDocument = await strategy.generateOAS();
          const generationHrDuration = globalThis.performance.now() - generationStartTime;
          const telemetry = strategy.getTelemetry();
          this.gil.addPostGenDoc(openApiDocument);
          this.gil.addGenerationStrategy(getBidRule() ?? 'MANUAL');
          if (telemetry.outputTokenLimit !== undefined) {
            this.gil.addOutputTokenLimit(telemetry.outputTokenLimit);
          }
          if (telemetry.guidedJson) {
            this.gil.addGuidedJson(telemetry.guidedJson);
          }

          // Step 8: Get org version for conditional beta info and active property
          const orgApiVersion = await getOrgApiVersion();
          const shouldIncludeBetaInfo = orgApiVersion !== undefined && orgApiVersion < 66.0;

          // Step 9: Process the OAS document
          progress.report({ message: nls.localize('processing_generated_oas') });
          const processedOasResult = await processOasDocument(openApiDocument, {
            context,
            eligibleResult: eligibilityResult,
            isRevalidation: false,
            betaInfo: shouldIncludeBetaInfo ? strategy?.betaInfo : undefined
          });

          // Step 10: Write OpenAPI Document to File
          progress.report({ message: nls.localize('write_openapi_document') });
          overwrite = fullPath[0] === fullPath[1];
          await this.esrHandler.generateEsrMD(this.isESRDecomposed, processedOasResult, fullPath, orgApiVersion);

          // Step 11: Gather metrics
          props = {
            isClass: `${isClass}`,
            overwrite: `${overwrite}`,
            strategy: telemetry.strategyName
          };

          const [errors, warnings, infos, hints, total] = summarizeDiagnostics(processedOasResult.errors);

          measures = {
            generationDuration: generationHrDuration,
            biddedCallCount: telemetry.biddedCallCount,
            llmCallCount: telemetry.llmCallCount,
            generationSize: telemetry.generationSize,
            documentTtlProblems: total,
            documentErrors: errors,
            documentWarnings: warnings,
            documentInfo: infos,
            documentHints: hints
          };
        }
      );

      // Step 12: Notify Success
      if (overwrite) {
        // Case 1: User decided to overwrite the original ESR file
        notificationService.showInformationMessage(nls.localize('openapi_doc_created', type.toLowerCase(), name));
        telemetryService.sendCommandEvent(createdMessage, startTime, props, measures);
      } else {
        // Case 2: User decided to manually merge the original and new ESR files
        const message = nls.localize(
          'openapi_doc_created_merge',
          type.toLowerCase(),
          path.basename(fullPath[1], '.externalServiceRegistration-meta.xml'),
          name
        );
        await notificationService.showInformationMessage(message);
        telemetryService.sendCommandEvent(createdMessage, startTime, props, measures);
      }
    } catch (error) {
      void handleError(error, `OASDocumentFor${type}CreationFailed`);
    }
    await this.gil.writeLogs();
  };
}

const getBidRule = (): BidRule => {
  const currentBidRule = vscode.workspace
    .getConfiguration()
    .get<BidRule>('salesforcedx-vscode-apex-oas.generation_strategy', 'LEAST_CALLS');

  return isBidRule(currentBidRule) ? currentBidRule : 'LEAST_CALLS';
};

const handleError = async (error: unknown, telemetryEvent: string): Promise<void> => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  await notificationService.showErrorMessage(`${nls.localize('create_openapi_doc_failed')}: ${errorMessage}`);
  telemetryService.sendException(telemetryEvent, errorMessage);
};

const isBidRule = (value: unknown): value is BidRule => value === 'LEAST_CALLS' || value === 'MOST_CALLS';
