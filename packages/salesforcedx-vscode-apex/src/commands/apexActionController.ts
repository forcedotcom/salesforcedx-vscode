/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Progress } from '@salesforce/apex-node-bundle';
import { notificationService, workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
import { OpenAPIV3 } from 'openapi-types'; // Adjust the import path as necessary
import * as path from 'path';
import * as vscode from 'vscode';
import { stringify } from 'yaml';
import { getTelemetryService } from '../telemetry/telemetry';
import { MetadataOrchestrator, MethodMetadata } from './metadataOrchestrator';

export class ApexActionController {
  constructor(
    private metadataOrchestrator: MetadataOrchestrator, // Dependency Injection
    private progress?: Progress<{
      message?: string | undefined;
      increment?: number | undefined;
    }>
  ) {}

  public createApexActionFromMethod = async (): Promise<void> => {
    const telemetryService = await getTelemetryService();
    const progressReporter: Progress<any> = {
      report: value => {
        if (value.type === 'StreamingClientProgress' || value.type === 'FormatTestResultProgress') {
          this.progress?.report({ message: value.message });
        }
      }
    };
    try {
      // // Step 0: Validate Method
      // if (!this.isMethodEligible(methodIdentifier)) {
      //   void notificationService.showErrorMessage(
      //     '`Method ${methodIdentifier} is not eligible for Apex Action creation.`'
      //   );
      //   throw new Error(`Method ${methodIdentifier} is not eligible for Apex Action creation.`);
      // }

      // Step 1: Extract Metadata
      progressReporter.report({ message: 'Extracting metadata.' });
      const metadata = this.metadataOrchestrator.extractMethodMetadata();
      if (!metadata) {
        void notificationService.showErrorMessage('Failed to extract metadata from selected method.');
        throw new Error('Failed to extract metadata from selected method.');
      }

      // Step 2: Validate Method
      if (!this.metadataOrchestrator.validateAuraEnabledMethod(metadata.isAuraEnabled)) {
        void notificationService.showErrorMessage(
          `Method ${metadata.name} is not eligible for Apex Action creation. It is NOT annotated with @AuraEnabled.`
        );
        throw new Error(
          `Method ${metadata.name} is not eligible for Apex Action creation. It is NOT annotated with @AuraEnabled.`
        );
      }

      // Step 3: Generate OpenAPI Document
      progressReporter.report({ message: 'Generating OpenAPI document.' });
      const openApiDocument = this.generateOpenAPIDocument(metadata);

      // Step 4: Write OpenAPI Document to File
      const openApiFilePath = `${metadata.name}_openapi.yml`;
      await this.saveDocument(openApiFilePath, openApiDocument);

      // Step 6: Notify Success
      notificationService.showInformationMessage(`Apex Action created for method: ${metadata.name}.`);
      telemetryService.sendEventData('ApexActionCreated', { method: metadata.name });
    } catch (error) {
      // Error Handling
      notificationService.showErrorMessage(`Failed to create Apex Action: ${error.message}.`);
      telemetryService.sendException('ApexActionCreationFailed', error);
      throw error;
    }
  };

  public isMethodEligible = (methodIdentifier: string): boolean => {
    // Placeholder for eligibility logic
    return true;
  };

  private saveDocument = async (fileName: string, content: any): Promise<void> => {
    const openAPIdocumentsPath = path.join(workspaceUtils.getRootWorkspacePath(), 'OpenAPIdocuments');
    if (!fs.existsSync(openAPIdocumentsPath)) {
      fs.mkdirSync(openAPIdocumentsPath);
    }
    const saveLocation = path.join(openAPIdocumentsPath, fileName);
    fs.writeFileSync(saveLocation, content);
    await vscode.workspace.openTextDocument(saveLocation).then((newDocument: any) => {
      void vscode.window.showTextDocument(newDocument);
    });
  };

  public generateOpenAPIDocument = (metadata: MethodMetadata): string => {
    // Placeholder for OpenAPI generation logic
    // ProgressNotification.show(execution, cancellationTokenSource);
    const openAPIDocument: OpenAPIV3.Document = {
      openapi: '3.0.0',
      info: { title: 'Apex Actions', version: '1.0.0' },
      paths: {
        [`/apex/${metadata.name}`]: {
          post: {
            operationId: metadata.name,
            summary: `Invoke ${metadata.name}`,
            parameters: metadata.parameters as unknown as (OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject)[],
            responses: {
              200: {
                description: 'Success',
                content: {
                  'application/json': { schema: { type: metadata.returnType as OpenAPIV3.NonArraySchemaObjectType } }
                }
              }
            }
          }
        }
      }
    };

    // Convert the OpenAPI document to YAML
    return stringify(openAPIDocument);
  };
}
