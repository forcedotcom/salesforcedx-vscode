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
import { QuickPickItem } from 'vscode';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { getTelemetryService } from '../telemetry/telemetry';
import { MetadataOrchestrator } from './metadataOrchestrator';

export class ApexActionController {
  constructor(
    private metadataOrchestrator: MetadataOrchestrator, // Dependency Injection
    private progress?: Progress<{
      message?: string | undefined;
      increment?: number | undefined;
    }>
  ) {}
  public listApexMethods = (apexClassPath: string): Promise<QuickPickItem[]> => {
    // Read the content of the Apex class file
    const fileContent = fs.readFileSync(apexClassPath).toString();

    // Regular expression to match method declarations in Apex
    const methodRegExp = /@[\w]+\s*\b(public|private|protected|global)\s+(static\s+)?[\w<>\[\]]+\s+(\w+)\s*\(/g;

    const methods: QuickPickItem[] = [];
    let match;

    // Extract all method names that match the regular expression
    while ((match = methodRegExp.exec(fileContent)) !== null) {
      const methodName = match[3];
      methods.push({
        label: methodName,
        description: apexClassPath
      });
    }

    // Sort the methods alphabetically by name
    methods.sort((a, b) => a.label.localeCompare(b.label));

    return Promise.resolve(methods);
  };

  public createApexActionFromMethod = async (methodIdentifier: string): Promise<void> => {
    const telemetryService = await getTelemetryService();
    const progressReporter: Progress<any> = {
      report: value => {
        if (value.type === 'StreamingClientProgress' || value.type === 'FormatTestResultProgress') {
          this.progress?.report({ message: value.message });
        }
      }
    };
    try {
      // Step 1: Validate Method
      if (!this.isMethodEligible(methodIdentifier)) {
        void notificationService.showErrorMessage(
          '`Method ${methodIdentifier} is not eligible for Apex Action creation.`'
        );
        throw new Error(`Method ${methodIdentifier} is not eligible for Apex Action creation.`);
      }

      // Step 2: Extract Metadata
      progressReporter.report({ message: 'Extracting metadata.' });
      const metadata = await this.metadataOrchestrator.extractMethodMetadata(methodIdentifier);

      // Step 3: Generate OpenAPI Document
      progressReporter.report({ message: 'Generating OpenAPI document.' });
      const openApiDocument = this.generateOpenAPIDocument(metadata);

      // Step 4: Write OpenAPI Document to File
      const openApiFilePath = `${methodIdentifier}_openapi.json`;
      await this.saveDocument(openApiFilePath, openApiDocument);

      // Step 6: Notify Success
      notificationService.showInformationMessage(`Apex Action created for method: ${methodIdentifier}`);
      telemetryService.sendEventData('ApexActionCreated', { method: methodIdentifier });
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
    fs.writeFileSync(saveLocation, JSON.stringify(content));
    await vscode.workspace.openTextDocument(saveLocation).then((newDocument: any) => {
      void vscode.window.showTextDocument(newDocument);
    });
  };

  public generateOpenAPIDocument = (metadata: any): OpenAPIV3.Document => {
    // Placeholder for OpenAPI generation logic
    return {
      openapi: '3.0.0',
      info: { title: 'Apex Actions', version: '1.0.0' },
      paths: {
        [`/apex/${metadata}`]: {
          post: {
            summary: `Invoke ${metadata}`,
            operationId: metadata,
            responses: { 200: { description: 'Success' } }
          }
        }
      }
    };
  };
}
