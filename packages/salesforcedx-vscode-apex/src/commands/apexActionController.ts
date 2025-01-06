/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { notificationService, workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import { JsonMap } from '@salesforce/ts-types';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import * as vscode from 'vscode';
import { parse, stringify } from 'yaml';
import { workspaceContext } from '../context';
import { nls } from '../messages';
import { ApexClassOASEligibleResponse, ApexClassOASGatherContextResponse } from '../openApiUtilities/schemas';
import { getTelemetryService } from '../telemetry/telemetry';
import { MetadataOrchestrator } from './metadataOrchestrator';

export class ApexActionController {
  constructor(private metadataOrchestrator: MetadataOrchestrator) {}

  /**
   * Creates an Apex Action.
   * @param isClass - Indicates if the action is for a class or a method.
   */
  public createApexAction = async (isClass: boolean, sourceUri: vscode.Uri | vscode.Uri[]): Promise<void> => {
    const type = isClass ? 'Class' : 'Method';
    const command = isClass
      ? 'SFDX: Create Apex Action from This Class'
      : 'SFDX: Create Apex Action from Selected Method';
    let eligibilityResult;
    let context;
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
          // Step 1: Validate eligibility
          progress.report({ message: nls.localize('validate_eligibility') });
          eligibilityResult = await this.metadataOrchestrator.validateMetadata(sourceUri, !isClass);
          if (!eligibilityResult) {
            throw new Error(nls.localize('class_validation_failed', type));
          }

          // Step 2: Gather context
          context = await this.metadataOrchestrator.gatherContext(sourceUri);
          if (!context) {
            throw new Error(nls.localize('cannot_gather_context'));
          }

          // Step 3: Determine filename
          name = isClass
            ? path.basename(eligibilityResult.resourceUri, '.cls')
            : eligibilityResult?.symbols?.[0]?.docSymbol?.name;
          const openApiFileName = `${name}.externalServiceRegistration-meta.xml`;
          let fullPath;
          // Step 4: Check if the file already exists
          try {
            fullPath = await this.pathExists(openApiFileName);
          } catch (error) {
            vscode.window.showErrorMessage(error);
          }

          // Step 5: Generate OpenAPI Document
          progress.report({ message: nls.localize('generate_openapi_document') });
          const openApiDocument = await this.generateOpenAPIDocument(eligibilityResult, context);

          // Step 6: Write OpenAPI Document to File
          progress.report({ message: nls.localize('write_openapi_document_to_file') });
          if (fullPath) {
            await this.saveOasAsErsMetadata(openApiDocument, fullPath);
          } else {
            throw new Error('Failed to determine the full path for the OpenAPI document.');
          }
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
   * Generates an OpenAPI document from the provided metadata.
   * @param metadata - The metadata of the methods.
   * @returns The OpenAPI document as a string.
   */
  private generateOpenAPIDocument = async (
    metadata: ApexClassOASEligibleResponse,
    context: ApexClassOASGatherContextResponse
  ): Promise<string> => {
    const documentText = fs.readFileSync(new URL(metadata.resourceUri.toString()), 'utf8');
    const openAPIdocument = await this.metadataOrchestrator.sendPromptToLLM(documentText, context);

    // Convert the OpenAPI document to YAML
    return this.cleanupYaml(openAPIdocument);
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

  private cleanupYaml(doc: string): string {
    // Remove the first line of the document
    const openApiIndex = doc.indexOf('openapi');
    if (openApiIndex === -1) {
      throw new Error('Could not find openapi line in document:\n' + doc);
    }
    const theDoc = doc
      .substring(openApiIndex)
      .split('\n')
      .filter((line: string) => !line.includes('{AUTHOR_PLACEHOLDER}'))
      .join('\n');
    return stringify(parse(theDoc));
  }

  private saveOasAsErsMetadata = async (oasSpec: string, fullPath: string): Promise<void> => {
    // Replace the schema section in the ESR file if it already exists
    let existingContent;
    if (fs.existsSync(fullPath)) {
      existingContent = fs.readFileSync(fullPath, 'utf8');
    }
    const namedCredential = await this.showNamedCredentialsQuickPick();

    const updatedContent = existingContent
      ? existingContent.replace(/<schema>([\s\S]*?)<\/schema>/, `<schema>${oasSpec.replaceAll('"', '&apos;')}</schema>`)
      : [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<ExternalServiceRegistration xmlns="http://soap.sforce.com/2006/04/metadata">`,
          `\t<description>${path.basename(fullPath).split('.')[0]} External Service</description>`,
          `\t<label>${path.basename(fullPath).split('.')[0]}</label>`,
          `\t<namedCredentialReference>${namedCredential}</namedCredentialReference>`,
          `\t<registrationProviderType>Custom</registrationProviderType>`,
          `\t<schema>${oasSpec.replaceAll('"', '&apos;')}</schema>`,
          `\t<schemaType>OpenApi3</schemaType>`,
          `\t<schemaUploadFileExtension>yaml</schemaUploadFileExtension>`,
          `\t<schemaUploadFileName>${path.basename(fullPath).split('.')[0].toLowerCase()}_openapi</schemaUploadFileName>`,
          `\t<status>Complete</status>`,
          `\t<systemVersion>5</systemVersion>`,
          `</ExternalServiceRegistration>`
        ].join('\n');
    try {
      // Step 3: Write File
      fs.writeFileSync(fullPath, updatedContent);
      await vscode.workspace.openTextDocument(fullPath).then((newDocument: vscode.TextDocument) => {
        void vscode.window.showTextDocument(newDocument);
      });
    } catch (error) {
      throw new Error(nls.localize('artifact_failed', error.message));
    }
  };

  private pathExists = async (filename: string): Promise<string> => {
    // Step 1: Prompt for Folder
    const folder = await this.getFolderForArtifact();
    if (!folder) {
      throw new Error(nls.localize('no_folder_selected'));
    }

    // Step 2: Verify folder exists and if not create it
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder);
    }

    // Step 2: Check if File Exists
    const fullPath = path.join(folder, filename);
    if (fs.existsSync(fullPath)) {
      const shouldOverwrite = await this.confirmOverwrite();
      if (!shouldOverwrite) {
        throw new Error(nls.localize('operation_cancelled'));
      }
    }
    return fullPath;
  };

  private confirmOverwrite = async (): Promise<boolean> => {
    const response = await vscode.window.showWarningMessage(
      nls.localize('file_exists'),
      { modal: true },
      nls.localize('overwrite'),
      nls.localize('cancel')
    );
    return response === nls.localize('overwrite');
  };

  private getFolderForArtifact = async (): Promise<string | undefined> => {
    const defaultESRFolder = path.join(
      workspaceUtils.getRootWorkspacePath(),
      'force-app',
      'main',
      'default',
      'externalServiceRegistrations'
    );
    const folderUri = await vscode.window.showInputBox({
      prompt: nls.localize('enter_esr_path'),
      value: defaultESRFolder
    });

    return folderUri ? path.resolve(folderUri) : undefined;
  };
  private showNamedCredentialsQuickPick = async (): Promise<string | undefined> => {
    let namedCredentials;
    let selectedNamedCredential;
    let finalNamedCredential: string | undefined;
    try {
      const rawQueryData = await (
        await workspaceContext.getConnection()
      ).query('SELECT MasterLabel FROM NamedCredential');
      namedCredentials = {
        ...rawQueryData,
        records: this.flattenQueryRecords(rawQueryData.records)
      };
    } catch (parseError) {
      throw new Error(nls.localize('error_parsing_nc'));
    }

    if (namedCredentials) {
      const quickPicks = namedCredentials.records.map(nc => nc.MasterLabel as string);
      quickPicks.push(nls.localize('enter_new_nc'));
      selectedNamedCredential = await vscode.window.showQuickPick(quickPicks, {
        placeHolder: nls.localize('select_named_credential')
      });
    }

    if (selectedNamedCredential === nls.localize('enter_new_nc')) {
      finalNamedCredential = await vscode.window.showInputBox({
        prompt: nls.localize('enter_nc_name')
      });
    } else {
      finalNamedCredential = selectedNamedCredential;
    }
    return finalNamedCredential;
  };

  private flattenQueryRecords(rawQueryRecords: JsonMap[]) {
    // filter out the attributes key
    return rawQueryRecords.map(({ attributes, ...cleanRecords }) => cleanRecords);
  }
}
