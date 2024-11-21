/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { notificationService, workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
import { OpenAPIV3 } from 'openapi-types';
import * as path from 'path';
import * as vscode from 'vscode';
import { stringify } from 'yaml';
import { nls } from '../messages';
import { getTelemetryService } from '../telemetry/telemetry';
import { MetadataOrchestrator, MethodMetadata } from './metadataOrchestrator';

export class ApexActionController {
  constructor(private metadataOrchestrator: MetadataOrchestrator) {}

  /**
   * Creates an Apex Action.
   * @param isClass - Indicates if the action is for a class or a method.
   */
  public createApexAction = async (isClass: boolean, sourceUri?: vscode.Uri): Promise<void> => {
    const type = isClass ? 'Class' : 'Method';
    const command = isClass
      ? 'SFDX: Create Apex Action from This Class'
      : 'SFDX: Create Apex Action from Selected Method';
    let metadata;
    let name;
    const telemetryService = await getTelemetryService();
    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: command,
          cancellable: true
        },
        async progress => {
          // Step 1: Extract Metadata
          progress.report({ message: nls.localize('extract_metadata') });
          metadata = isClass
            ? await this.metadataOrchestrator.extractAllMethodsMetadata(sourceUri)
            : this.metadataOrchestrator.extractMethodMetadata();
          if (!metadata) {
            throw new Error(nls.localize('extraction_failed', type));
          }

          // Step 3: Generate OpenAPI Document
          progress.report({ message: nls.localize('generate_openapi_document') });
          const openApiDocument = this.generateOpenAPIDocument(Array.isArray(metadata) ? metadata : [metadata]);

          // Step 4: Write OpenAPI Document to File
          name = Array.isArray(metadata) ? metadata[0].className : metadata.name;
          const openApiFileName = `${name}_openapi.yml`;
          progress.report({ message: nls.localize('write_openapi_document_to_file') });
          await this.saveAndOpenDocument(openApiFileName, openApiDocument);
        }
      );

      // Step 5: Notify Success
      notificationService.showInformationMessage(nls.localize('apex_action_created', type.toLowerCase(), name));
      telemetryService.sendEventData(`ApexAction${type}Created`, { method: name! });
    } catch (error: any) {
      void this.handleError(error, `ApexAction${type}CreationFailed`);
    }
  };

  /**
   * Saves and opens the OpenAPI document to a file.
   * @param fileName - The name of the file.
   * @param content - The content of the file.
   */
  private saveAndOpenDocument = async (fileName: string, content: string): Promise<void> => {
    const openAPIdocumentsPath = path.join(workspaceUtils.getRootWorkspacePath(), 'OpenAPIdocuments');
    if (!fs.existsSync(openAPIdocumentsPath)) {
      fs.mkdirSync(openAPIdocumentsPath);
    }
    const saveLocation = path.join(openAPIdocumentsPath, fileName);
    fs.writeFileSync(saveLocation, content);
    await vscode.workspace.openTextDocument(saveLocation).then((newDocument: vscode.TextDocument) => {
      void vscode.window.showTextDocument(newDocument);
    });
  };

  /**
   * Generates an OpenAPI document from the provided metadata.
   * @param metadata - The metadata of the methods.
   * @returns The OpenAPI document as a string.
   */
  private generateOpenAPIDocument = (metadata: MethodMetadata[]): string => {
    const paths: OpenAPIV3.PathsObject = {};

    metadata?.forEach(method => {
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

  /**
   * Handles errors by showing a notification and sending telemetry data.
   * @param error - The error to handle.
   * @param telemetryEvent - The telemetry event name.
   */
  private handleError = async (error: any, telemetryEvent: string): Promise<void> => {
    const telemetryService = await getTelemetryService();
    const errorMessage = error instanceof Error ? error.message : String(error);
    notificationService.showErrorMessage(`${nls.localize('create_apex_action_failed')}: ${errorMessage}`);
    telemetryService.sendException(telemetryEvent, errorMessage);
  };
}
