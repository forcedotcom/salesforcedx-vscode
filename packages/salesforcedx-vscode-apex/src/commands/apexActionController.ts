/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { notificationService, WorkspaceContextUtil, workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import { RegistryAccess } from '@salesforce/source-deploy-retrieve-bundle';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { parse } from 'yaml';
import { workspaceContext } from '../context';
import { nls } from '../messages';
import { OasProcessor } from '../oas/documentProcessorPipeline/oasProcessor';
import { BidRule, PromptGenerationOrchestrator } from '../oas/promptGenerationOrchestrator';
import {
  ApexClassOASEligibleResponse,
  ApexClassOASGatherContextResponse,
  ApexOASInfo,
  ExternalServiceOperation
} from '../oas/schemas';
import { getTelemetryService } from '../telemetry/telemetry';
import { MetadataOrchestrator } from './metadataOrchestrator';
export class ApexActionController {
  constructor(private metadataOrchestrator: MetadataOrchestrator) { }

  /**
   * Creates an OpenAPI Document.
   * @param isClass - Indicates if the action is for a class or a method.
   */
  public createApexAction = async (isClass: boolean, sourceUri: vscode.Uri | vscode.Uri[]): Promise<void> => {
    const type = isClass ? 'Class' : 'Method';
    const command = isClass
      ? 'SFDX: Create OpenAPI Document from This Class'
      : 'SFDX: Create OpenAPI Document from Selected Method';
    let eligibilityResult;
    let context;
    let name;
    const telemetryService = await getTelemetryService();

    try {
      let fullPath: [string, string, boolean] = ['', '', false];
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
          name = path.basename(eligibilityResult.resourceUri, '.cls');
          const openApiFileName = `${name}.externalServiceRegistration-meta.xml`;

          // Step 4: Check if the file already exists
          fullPath = await this.pathExists(openApiFileName);
          if (!fullPath) throw new Error(nls.localize('full_path_failed'));

          // Step 5: Initialize the strategy orchestrator
          const promptGenerationOrchestrator = new PromptGenerationOrchestrator(eligibilityResult, context);

          // Step 6: use the strategy to generate the OAS
          const openApiDocument = await promptGenerationOrchestrator.generateOASWithStrategySelectedByBidRule(
            BidRule.MOST_CALLS
          );

          // Step 7: Process the OAS document
          const processedOasDoc = await this.processOasDocument(openApiDocument, context, eligibilityResult);

          // Step 8: Write OpenAPI Document to File
          progress.report({ message: nls.localize('write_openapi_document') });
          await this.saveOasAsEsrMetadata(processedOasDoc, fullPath[1]);

          // Step 7: If the user chose to merge, open a diff between the original and new ESR files
          if (fullPath[0] !== fullPath[1]) {
            await vscode.commands.executeCommand(
              'vscode.diff',
              vscode.Uri.file(fullPath[0]),
              vscode.Uri.file(fullPath[1]),
              'Manual Diff of ESR Files'
            );
          }
        }
      );

      // Step 5: Notify Success
      if (fullPath[0] === fullPath[1]) {
        // Case 1: User decided to overwrite the original ESR file
        notificationService.showInformationMessage(nls.localize('openapi_doc_created', type.toLowerCase(), name));
        telemetryService.sendEventData(`ApexAction${type}Created`, { method: name! });
      } else {
        // Case 2: User decided to manually merge the original and new ESR files
        const message = nls.localize(
          'openapi_doc_created_merge',
          type.toLowerCase(),
          path.basename(fullPath[1], '.externalServiceRegistration-meta.xml'),
          name
        );
        await notificationService.showInformationMessage(message);
        telemetryService.sendEventData(`ApexAction${type}Created`, { method: name! });
      }
    } catch (error: any) {
      void this.handleError(error, `ApexAction${type}CreationFailed`);
    }
  };

  private processOasDocument = async (
    oasDoc: string,
    context: ApexClassOASGatherContextResponse,
    eligibleResult: ApexClassOASEligibleResponse
  ): Promise<string> => {
    const oasProcessor = new OasProcessor(context, oasDoc, eligibleResult);
    const processResult = await oasProcessor.process();
    return processResult.yaml;
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

  private saveOasAsEsrMetadata = async (oasSpec: string, fullPath: string): Promise<void> => {
    const orgVersion = await (await WorkspaceContextUtil.getInstance().getConnection()).retrieveMaxApiVersion();
    // Replace the schema section in the ESR file if it already exists
    let existingContent;
    let namedCredential;
    if (fs.existsSync(fullPath)) {
      existingContent = fs.readFileSync(fullPath, 'utf8');
    }
    if (!this.isVersionGte(orgVersion, '63.0')) namedCredential = await this.showNamedCredentialsQuickPick();

    const updatedContent = await this.buildESRXml(existingContent, fullPath, namedCredential, oasSpec);
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

  /**
   * Checks if the ESR file already exists and prompts the user on what to do.
   * @param filename
   * @returns Promise<[string, string, boolean]> - [className.externalServiceRegistration-meta.xml, the file name of the generated ESR, a boolean indicating if the file already exists]
   */
  private pathExists = async (filename: string): Promise<[string, string, boolean]> => {
    // Step 1: Prompt for Folder
    const folder = await this.getFolderForArtifact();
    if (!folder) {
      throw new Error(nls.localize('no_folder_selected'));
    }

    // Step 2: Verify folder exists and if not create it
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder);
    }

    // Step 3: Check if File Exists
    const fullPath = path.join(folder, filename);
    let esrExists = false;
    if (fs.existsSync(fullPath)) {
      const whatToDo = await this.handleExistingESR();
      if (whatToDo === 'cancel') {
        throw new Error(nls.localize('operation_cancelled'));
      } else if (whatToDo === nls.localize('merge')) {
        const currentTimestamp = this.getCurrentTimestamp();
        const namePart = path.basename(filename, '.externalServiceRegistration-meta.xml');
        const newFileName = namePart + '_' + currentTimestamp + '.externalServiceRegistration-meta.xml';
        const esr_files_for_merge_folder = path.join(workspaceUtils.getRootWorkspacePath(), 'esr_files_for_merge');
        if (!fs.existsSync(esr_files_for_merge_folder)) {
          fs.mkdirSync(esr_files_for_merge_folder);
        }
        const newFullPath = path.join(esr_files_for_merge_folder, newFileName);
        esrExists = true;
        return [fullPath, newFullPath, esrExists];
      }
    }
    return [fullPath, fullPath, esrExists];
  };

  private getCurrentTimestamp = (): string => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const formattedDate = `${month}${day}${year}_${hours}:${minutes}:${seconds}`;
    return formattedDate;
  };

  private handleExistingESR = async (): Promise<string> => {
    const response = await vscode.window.showWarningMessage(
      nls.localize('file_exists'),
      { modal: true },
      nls.localize('overwrite'),
      nls.localize('merge')
    );
    return response || 'cancel';
  };

  private getFolderForArtifact = async (): Promise<string | undefined> => {
    const registryAccess = new RegistryAccess();
    let esrDefaultDirectoryName;
    let folderUri;
    try {
      esrDefaultDirectoryName = registryAccess.getTypeByName('ExternalServiceRegistration').directoryName;
    } catch (error) {
      throw new Error(nls.localize('registry_access_failed'));
    }

    if (esrDefaultDirectoryName) {
      const defaultESRFolder = path.join(
        workspaceUtils.getRootWorkspacePath(),
        'force-app',
        'main',
        'default',
        esrDefaultDirectoryName
      );
      folderUri = await vscode.window.showInputBox({
        prompt: nls.localize('select_folder_for_oas'),
        value: defaultESRFolder
      });
    }

    return folderUri ? path.resolve(folderUri) : undefined;
  };

  private showNamedCredentialsQuickPick = async (): Promise<string | undefined> => {
    let namedCredentials;
    let selectedNamedCredential: string | undefined;
    let finalNamedCredential: string | undefined;
    try {
      namedCredentials = await (
        await workspaceContext.getConnection()
      ).query('SELECT MasterLabel FROM NamedCredential');
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

    if (!selectedNamedCredential || selectedNamedCredential === nls.localize('enter_new_nc')) {
      finalNamedCredential = await vscode.window.showInputBox({
        prompt: nls.localize('enter_nc_name')
      });
    } else {
      finalNamedCredential = selectedNamedCredential;
    }
    return finalNamedCredential;
  };

  private buildESRXml = async (
    existingContent: string | undefined,
    fullPath: string,
    namedCredential: string | undefined,
    oasSpec: string
  ) => {
    const baseName = path.basename(fullPath).split('.')[0];
    let className;
    if (fullPath.includes('esr_files_for_merge')) {
      // The class name is the part before the second to last underscore
      const parts = baseName.split('_');
      className = parts.slice(0, -2).join('_');
    } else {
      className = baseName;
    }
    const safeOasSpec = oasSpec.replaceAll('"', '&apos;').replaceAll('type: Id', 'type: string');
    const { description, version } = this.extractInfoProperties(safeOasSpec);
    const operations = this.getOperationsFromYaml(safeOasSpec);
    const orgVersion = await (await WorkspaceContextUtil.getInstance().getConnection()).retrieveMaxApiVersion();
    if (!orgVersion) {
      throw new Error(nls.localize('error_retrieving_org_version'));
    }

    const parser = new XMLParser({ ignoreAttributes: false });
    let jsonObj;

    // Ensure namedCredential is provided and not blank
    if (!namedCredential || namedCredential.trim() === '') {
      throw new Error(nls.localize('invalid_named_credential'));
    }

    // If existing XML content, parse and update
    if (existingContent) {
      jsonObj = parser.parse(existingContent);
      if (jsonObj.ExternalServiceRegistration?.schema) {
        jsonObj.ExternalServiceRegistration.schema = safeOasSpec;
      } else {
        throw new Error(nls.localize('schema_element_not_found'));
      }
      if (jsonObj.ExternalServiceRegistration?.operations) {
        jsonObj.ExternalServiceRegistration.operations = operations;
      } else {
        throw new Error(nls.localize('operations_element_not_found'));
      }
      jsonObj.ExternalServiceRegistration.namedCredentialReference = namedCredential;
    } else {
      // Create a new XML structure
      jsonObj = {
        '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
        ExternalServiceRegistration: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          description,
          label: className,
          schema: safeOasSpec,
          schemaType: 'OpenApi3',
          schemaUploadFileExtension: 'yaml',
          schemaUploadFileName: `${className.toLowerCase()}_openapi`,
          status: 'Complete',
          systemVersion: '3',
          operations,
          registrationProvider: className,
          ...(this.isVersionGte(orgVersion, '63.0') // Guarded inclusion for API version 254 and above (instance api version 63.0 and above)
            ? {
              registrationProviderType: 'ApexRest',
              namedCredential: null,
              namedCredentialReferenceId: null,
              catalogedApiVersion: null,
              isStartSchemaVersion: true,
              isHeadSchemaVersion: true,
              schemaArtifactVersion: version
            }
            : {
              registrationProviderType: 'Custom',
              namedCredentialReference: namedCredential
            })
        }
      };
    }

    // Convert back to XML
    const builder = new XMLBuilder({ ignoreAttributes: false, format: true, processEntities: false });
    return builder.build(jsonObj);
  };

  private isVersionGte = (version: string, targetVersion: string): boolean => {
    const major = parseInt(version.split('.')[0], 10);
    const targetMajor = parseInt(targetVersion.split('.')[0], 10);
    return major >= targetMajor;
  };

  private extractInfoProperties = (oasSpec: string): ApexOASInfo => {
    const parsed = parse(oasSpec);
    if (!parsed?.info?.description || !parsed?.info?.version) {
      throw new Error(nls.localize('error_parsing_yaml'));
    }

    return {
      description: parsed?.info?.description,
      version: parsed?.info?.version
    };
  };
  private getOperationsFromYaml = (oasSpec: string): ExternalServiceOperation[] => {
    const parsed = parse(oasSpec);
    if (!parsed?.paths) {
      throw new Error(nls.localize('error_parsing_yaml'));
    }
    const operations = parsed.paths
      ? Object.keys(parsed.paths).flatMap(p =>
        Object.keys(parsed.paths[p]).map(operation => ({
          name: parsed.paths[p][operation].operationId,
          active: true
        }))
      )
      : [];

    return operations;
  };
}
