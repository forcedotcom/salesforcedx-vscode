/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable prettier/prettier */

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
import { ApexClassOASGatherContextResponse, ApexOASInfo, ExternalServiceOperation } from '../openApiUtilities/schemas';
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

          // Step 4: Check if the file already exists
          const fullPath = await this.pathExists(openApiFileName);
          if (!fullPath) throw new Error(nls.localize('full_path_failed'));

          // Step 5: Initialize the strategy orchestrator
          const promptGenerationOrchestrator = new PromptGenerationOrchestrator(eligibilityResult, context);
          // Step 6: use the strategy to generate the OAS
          const openApiDocument = await promptGenerationOrchestrator.generateOASWithStrategySelectedByBidRule(
            BidRule.MOST_CALLS
          );

          // Step 7: Process the OAS document
          const processedOasDoc = await this.processOasDocument(openApiDocument, context);
          // Step 8: Write OpenAPI Document to File
          progress.report({ message: nls.localize('write_openapi_document_to_file') });
          await this.saveOasAsErsMetadata(processedOasDoc, fullPath);
        }
      );

      // Step 5: Notify Success
      notificationService.showInformationMessage(nls.localize('apex_action_created', type.toLowerCase(), name));
      telemetryService.sendEventData(`ApexAction${type}Created`, { method: name! });
    } catch (error: any) {
      void this.handleError(error, `ApexAction${type}CreationFailed`);
    }
  };

  private processOasDocument = async (oasDoc: string, context: ApexClassOASGatherContextResponse): Promise<string> => {
    const oasProcessor = new OasProcessor(context, oasDoc);
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
    notificationService.showErrorMessage(`${nls.localize('create_apex_action_failed')}: ${errorMessage}`);
    telemetryService.sendException(telemetryEvent, errorMessage);
  };

  private saveOasAsErsMetadata = async (oasSpec: string, fullPath: string): Promise<void> => {
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
        prompt: nls.localize('enter_esr_path'),
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
    const safeOasSpec = oasSpec.replaceAll('"', '&apos;').replaceAll('type: Id', 'type: string');
    const { description, version } = this.extractInfoProperties(safeOasSpec);
    const operations = this.getOperationsFromYaml(safeOasSpec);
    const orgVersion = await (await WorkspaceContextUtil.getInstance().getConnection()).retrieveMaxApiVersion();
    if (!orgVersion) {
      throw new Error(nls.localize('error_retrieving_org_version'));
    }

    const parser = new XMLParser({ ignoreAttributes: false });
    let jsonObj;

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
    } else {
      // Create a new XML structure
      jsonObj = {
        '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
        ExternalServiceRegistration: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          description,
          label: baseName,
          schema: safeOasSpec,
          schemaType: 'OpenApi3',
          schemaUploadFileExtension: 'yaml',
          schemaUploadFileName: `${baseName.toLowerCase()}_openapi`,
          status: 'Complete',
          systemVersion: '3',
          operations,
          registrationProvider: baseName,
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
