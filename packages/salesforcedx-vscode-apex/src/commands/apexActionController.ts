/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { notificationService, WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { nls } from '../messages';
import { ExternalServiceRegistrationManager, FullPath } from '../oas/externalServiceRegistrationManager';
import GenerationInteractionLogger from '../oas/generationInteractionLogger';
import { BidRule, PromptGenerationOrchestrator } from '../oas/promptGenerationOrchestrator';
import { OASGenerationCommandMeasure, OASGenerationCommandProperties } from '../oas/schemas';
import { checkIfESRIsDecomposed, processOasDocument, summarizeDiagnostics } from '../oasUtils';
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
    let name;
    let generationHrStart: [number, number] = [-1, -1];
    let generationHrDuration: [number, number] = [-1, -1];
    let overwrite = true;
    const telemetryService = await getTelemetryService();
    this.gil.clear();
    const hrStart = process.hrtime();
    let props: OASGenerationCommandProperties = {
      isClass: `${isClass}`,
      overwrite: 'false'
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

          // Step 2: Gather context
          progress.report({ message: nls.localize('gathering_context') });
          context = await this.metadataOrchestrator.gatherContext(sourceUri);
          if (!context) {
            throw new Error(nls.localize('cannot_gather_context'));
          }

          // Step 3: Determine filename
          name = path.basename(eligibilityResult.resourceUri.fsPath, '.cls');
          const openApiFileName = `${name}.externalServiceRegistration-meta.xml`;

          // Step 4: Check if the file already exists
          progress.report({ message: nls.localize('get_document_path') });
          fullPath = await this.esrHandler.pathExists(openApiFileName);
          if (!fullPath) throw new Error(nls.localize('full_path_failed'));

          // Step 5: Initialize the strategy orchestrator
          progress.report({ message: nls.localize('generating_oas_doc') });
          const promptGenerationOrchestrator = new PromptGenerationOrchestrator(eligibilityResult, context);

          // Step 6: use the strategy to generate the OAS
          generationHrStart = process.hrtime();
          const openApiDocument = await promptGenerationOrchestrator.generateOASWithStrategySelectedByBidRule(
            this.getConfigBidRule()
          );
          generationHrDuration = process.hrtime(generationHrStart);

          // Step 7: Process the OAS document
          progress.report({ message: nls.localize('processing_generated_oas') });
          const processedOasResult = await processOasDocument(openApiDocument, context, eligibilityResult);

          // Step 8: Write OpenAPI Document to File
          progress.report({ message: nls.localize('write_openapi_document') });
          overwrite = fullPath[0] === fullPath[1];
          await this.esrHandler.generateEsrMD(this.isESRDecomposed, processedOasResult, fullPath);

          // Step 9: Gather metrics
          props = {
            isClass: `${isClass}`,
            overwrite: `${overwrite}`
          };

          const [errors, warnings, infos, hints, total] = summarizeDiagnostics(processedOasResult.errors);

          measures = {
            generationDuration: (await getTelemetryService()).hrTimeToMilliseconds(generationHrDuration),
            biddedCallCount: promptGenerationOrchestrator.strategy?.biddedCallCount,
            llmCallCount: promptGenerationOrchestrator.strategy?.llmCallCount,
            generationSize: promptGenerationOrchestrator.strategy?.maxBudget,
            documentTtlProblems: total,
            documentErrors: errors,
            documentWarnings: warnings,
            documentInfo: infos,
            documentHints: hints
          };
        }
      );

      // Step 10: Notify Success
      if (overwrite) {
        // Case 1: User decided to overwrite the original ESR file
        notificationService.showInformationMessage(nls.localize('openapi_doc_created', type.toLowerCase(), name));
        telemetryService.sendCommandEvent(createdMessage, hrStart, props, measures);
      } else {
        // Case 2: User decided to manually merge the original and new ESR files
        const message = nls.localize(
          'openapi_doc_created_merge',
          type.toLowerCase(),
          path.basename(fullPath[1], '.externalServiceRegistration-meta.xml'),
          name
        );
        await notificationService.showInformationMessage(message);
        telemetryService.sendCommandEvent(createdMessage, hrStart, props, measures);
      }
    } catch (error: any) {
      void this.handleError(error, `OASDocumentFor${type}CreationFailed`);
    }
    this.gil.writeLogs();
  };

  /**
   * Handles errors by showing a notification and sending telemetry data.
   * @param error - The error to handle.
   * @param telemetryEvent - The telemetry event name.
   */
  private handleError = async (error: any, telemetryEvent: string): Promise<void> => {
    const telemetryService = await getTelemetryService();
    const errorMessage = error instanceof Error ? error.message : String(error);
    notificationService.showErrorMessage(`${nls.localize('create_openapi_doc_failed')}: ${errorMessage}`);
    telemetryService.sendException(telemetryEvent, errorMessage);
  };

  private getConfigBidRule(): BidRule {
    return vscode.workspace
      .getConfiguration()
      .get('salesforcedx-vscode-apex.oas_generation_strategy', 'JSON_METHOD_BY_METHOD');
  }
}
