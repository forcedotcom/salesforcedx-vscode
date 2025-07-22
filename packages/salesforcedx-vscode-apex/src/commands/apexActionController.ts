/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { notificationService, TimingUtils, WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { nls } from '../messages';
import { ExternalServiceRegistrationManager, FullPath } from '../oas/externalServiceRegistrationManager';
import GenerationInteractionLogger from '../oas/generationInteractionLogger';
import {
  BidRule,
  PromptGenerationOrchestrator as GenerationOrchestrator,
  BID_RULES
} from '../oas/promptGenerationOrchestrator';
import { OASGenerationCommandMeasure, OASGenerationCommandProperties } from '../oas/schemas';
import { checkIfESRIsDecomposed, processOasDocument, summarizeDiagnostics, hasMixedFrameworks } from '../oasUtils';
import { getTelemetryService } from '../telemetry/telemetry';
import { MetadataOrchestrator } from './metadataOrchestrator';

export class ApexActionController {
  private isESRDecomposed: boolean = false;
  private gil = GenerationInteractionLogger.getInstance();
  private esrHandler: ExternalServiceRegistrationManager;
  constructor(private metadataOrchestrator: MetadataOrchestrator) {
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
      ? 'SFDX: Create OpenAPI Document from This Class (Beta)'
      : 'SFDX: Create OpenAPI Document from Selected Method';
    let eligibilityResult;
    let context;
    let name: string = 'Should Never Be Empty';
    let overwrite = true;
    const telemetryService = getTelemetryService();
    this.gil.clear();
    const startTime = TimingUtils.getCurrentTime();
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
          eligibilityResult = await this.metadataOrchestrator.validateMetadata(sourceUri, !isClass);
          if (!eligibilityResult) {
            throw new Error(nls.localize('class_validation_failed', type));
          }

          nls.localize('apex_class_not_valid', '123');

          // Step 2: Gather context
          progress.report({ message: nls.localize('gathering_context') });
          context = await this.metadataOrchestrator.gatherContext(sourceUri);
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
          const strategy = await generationOrchestrator.selectStrategyByBidRule(this.getBidRule());

          // Step 5: Determine filename
          name = path.basename(eligibilityResult.resourceUri.fsPath, '.cls');
          const openApiFileName = `${name}.externalServiceRegistration-meta.xml`;

          // Step 6: Check if the file already exists
          progress.report({ message: nls.localize('get_document_path') });
          fullPath = await this.esrHandler.pathExists(openApiFileName);
          if (!fullPath) throw new Error(nls.localize('full_path_failed'));

          // Step 7: Use the strategy to generate the OAS
          const generationStartTime = TimingUtils.getCurrentTime();
          const openApiDocument = await strategy.generateOAS();
          const generationHrDuration = TimingUtils.getCurrentTime() - generationStartTime;
          this.gil.addPostGenDoc(openApiDocument);
          this.gil.addGenerationStrategy(this.getBidRule() ?? 'MANUAL');
          this.gil.addOutputTokenLimit(strategy!.outputTokenLimit);
          if (strategy!.includeOASSchema && strategy!.openAPISchema) {
            this.gil.addGuidedJson(strategy!.openAPISchema);
          }

          // Step 8: Process the OAS document
          progress.report({ message: nls.localize('processing_generated_oas') });
          const processedOasResult = await processOasDocument(openApiDocument, {
            context,
            eligibleResult: eligibilityResult,
            isRevalidation: false,
            betaInfo: strategy?.betaInfo
          });

          // Step 9: Write OpenAPI Document to File
          progress.report({ message: nls.localize('write_openapi_document') });
          overwrite = fullPath[0] === fullPath[1];
          await this.esrHandler.generateEsrMD(this.isESRDecomposed, processedOasResult, fullPath);

          // Step 10: Gather metrics
          props = {
            isClass: `${isClass}`,
            overwrite: `${overwrite}`,
            strategy: generationOrchestrator.strategy?.strategyName ?? 'unknown'
          };

          const [errors, warnings, infos, hints, total] = summarizeDiagnostics(processedOasResult.errors);

          measures = {
            generationDuration: generationHrDuration,
            biddedCallCount: generationOrchestrator.strategy?.biddedCallCount,
            llmCallCount: generationOrchestrator.strategy?.resolutionAttempts,
            generationSize: generationOrchestrator.strategy?.maxBudget,
            documentTtlProblems: total,
            documentErrors: errors,
            documentWarnings: warnings,
            documentInfo: infos,
            documentHints: hints
          };
        }
      );

      // Step 11: Notify Success
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
    } catch (error: any) {
      void this.handleError(error, `OASDocumentFor${type}CreationFailed`);
    }
    await this.gil.writeLogs();
  };

  /**
   * Handles errors by showing a notification and sending telemetry data.
   * @param error - The error to handle.
   * @param telemetryEvent - The telemetry event name.
   */
  private handleError = async (error: any, telemetryEvent: string): Promise<void> => {
    const telemetryService = getTelemetryService();
    const errorMessage = error instanceof Error ? error.message : String(error);
    await notificationService.showErrorMessage(`${nls.localize('create_openapi_doc_failed')}: ${errorMessage}`);
    telemetryService.sendException(telemetryEvent, errorMessage);
  };

  private isBidRule(value: unknown): value is BidRule {
    return typeof value === 'string' && value in BID_RULES;
  }

  private getBidRule(): BidRule {
    const currentBidRule = vscode.workspace
      .getConfiguration()
      .get('salesforcedx-vscode-apex.oas_generation_strategy', BID_RULES.LEAST_CALLS);

    return this.isBidRule(currentBidRule) ? currentBidRule : BID_RULES.LEAST_CALLS;
  }
}
