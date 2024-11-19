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
        throw new Error('Failed to extract metadata from selected method.');
      }

      // Step 2: Validate Method
      if (!this.metadataOrchestrator.validateAuraEnabledMethod(metadata.isAuraEnabled)) {
        throw new Error(
          `Method ${metadata.name} is not eligible for Apex Action creation. It is not annotated with @AuraEnabled.`
        );
      }

      // Step 3: Generate OpenAPI Document
      progressReporter.report({ message: 'Generating OpenAPI document.' });
      const openApiDocument = this.generateOpenAPIDocument([metadata]);

      // Step 4: Write OpenAPI Document to File
      const openApiFilePath = `${metadata.name}_openapi.yml`;
      await this.saveDocument(openApiFilePath, openApiDocument);

      // Step 6: Notify Success
      notificationService.showInformationMessage(`Apex Action created for method: ${metadata.name}.`);
      telemetryService.sendEventData('ApexActionCreated', { method: metadata.name });
    } catch (error) {
      // Error Handling
      notificationService.showErrorMessage(`Failed to create Apex Action: ${error.message}`);
      telemetryService.sendException('ApexActionCreationFailed', error);
      throw error;
    }
  };

  public createApexActionFromClass = async (): Promise<void> => {
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
      const metadata = this.metadataOrchestrator.extractAllMethodsMetadata();
      if (!metadata) {
        throw new Error('Failed to extract metadata from class.');
      } else if (metadata.length > 0) {
        // Step 2: Generate OpenAPI Document
        progressReporter.report({ message: 'Generating OpenAPI document.' });
        const openApiDocument = this.generateOpenAPIDocument(metadata);

        // Step 3: Write OpenAPI Document to File
        const openApiFilePath = `${metadata[0].name}_openapi.yml`;
        await this.saveDocument(openApiFilePath, openApiDocument);

        // Step 4: Notify Success
        notificationService.showInformationMessage(`Apex Action created for class: ${metadata[0].name}.`);
        telemetryService.sendEventData('ApexActionCreated', { method: metadata[0].name });
      }
    } catch (error) {
      // Error Handling
      notificationService.showErrorMessage(`Failed to create Apex Action: ${error.message}`);
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

  public generateOpenAPIDocument = (metadata: MethodMetadata[]): string => {
    // Placeholder for OpenAPI generation logic
    const paths: OpenAPIV3.PathsObject = {};

    metadata.forEach(method => {
      paths[`/apex/${method.name}`] = {
        post: {
          operationId: method.name,
          summary: `Invoke ${method.name}`,
          parameters: method.parameters as unknown as (OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject)[],
          responses: {
            200: {
              description: 'Success',
              content: {
                'application/json': { schema: { type: method.returnType as OpenAPIV3.NonArraySchemaObjectType } }
              }
            }
          }
        }
      };
    });

    const openAPIDocument: OpenAPIV3.Document = {
      openapi: '3.0.0',
      info: { title: 'Apex Actions', version: '1.0.0' },
      paths
    };
    // Convert the OpenAPI document to YAML
    return stringify(openAPIDocument);
  };
}
