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
import { OpenAPIV3 } from 'openapi-types';
import * as path from 'path';
import * as vscode from 'vscode';
import { stringify } from 'yaml';
import { workspaceContext } from '../context';
import { nls } from '../messages';
import GenerationInteractionLogger from '../oas/generationInteractionLogger';
import {
  checkIfESRIsDecomposed,
  createProblemTabEntriesForOasDocument,
  processOasDocument,
  summarizeDiagnostics
} from '../oas/oasUtils';
import { BidRule, PromptGenerationOrchestrator } from '../oas/promptGenerationOrchestrator';
import { ApexOASInfo, ExternalServiceOperation } from '../oas/schemas';
import {
  getTelemetryService,
  OASGenerationCommandMeasure,
  OASGenerationCommandProperties
} from '../telemetry/telemetry';
import { MetadataOrchestrator } from './metadataOrchestrator';
export class ApexActionController {
  private isESRDecomposed: boolean = false;
  private gil = GenerationInteractionLogger.getInstance();
  constructor(private metadataOrchestrator: MetadataOrchestrator) {}

  public async initialize(extensionContext: vscode.ExtensionContext) {
    await WorkspaceContextUtil.getInstance().initialize(extensionContext);
    this.isESRDecomposed = await checkIfESRIsDecomposed();
  }

  /**
   * Creates an OpenAPI Document.
   * @param isClass - Indicates if the action is for a class or a method.
   */
  public createApexAction = async (isClass: boolean, sourceUri: vscode.Uri | vscode.Uri[]): Promise<void> => {
    const type = isClass ? 'Class' : 'Method';
    const command = isClass
      ? 'SFDX: Create OpenAPI Document from This Class (Beta)'
      : 'SFDX: Create OpenAPI Document from Selected Method';
    let eligibilityResult;
    let context;
    let name;
    let generationHrStart: [number, number] = [-1, -1];
    let generationHrDuration: [number, number] = [-1, -1];
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
      generationSize: 0,
      documentTtlProblems: 0,
      documentErrors: 0,
      documentWarnings: 0,
      documentInfo: 0,
      documentHints: 0
    };

    try {
      let fullPath: [string, string, boolean] = ['', '', false];
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: command,
          cancellable: true
        },
        async progress => {
          // Step0
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
          name = path.basename(eligibilityResult.resourceUri, '.cls');
          const openApiFileName = `${name}.externalServiceRegistration-meta.xml`;

          // Step 4: Check if the file already exists
          progress.report({ message: nls.localize('get_document_path') });
          fullPath = await this.pathExists(openApiFileName);
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
          await this.saveOasAsEsrMetadata(processedOasResult.openAPIDoc, fullPath[1]);
          const overwrite = fullPath[0] === fullPath[1];

          props = {
            isClass: `${isClass}`,
            overwrite: `${overwrite}`
          };

          const [errors, warnings, infos, hints, total] = summarizeDiagnostics(processedOasResult.errors);

          measures = {
            generationDuration: telemetryService.hrTimeToMilliseconds(generationHrDuration),
            llmCallCount: promptGenerationOrchestrator.strategy?.callCounts,
            generationSize: promptGenerationOrchestrator.strategy?.maxBudget,
            documentTtlProblems: total,
            documentErrors: errors,
            documentWarnings: warnings,
            documentInfo: infos,
            documentHints: hints
          };

          // Step 9: If the user chose to merge, open a diff between the original and new ESR files
          if (overwrite) {
            void this.openDiffFile(fullPath[0], fullPath[1], 'Manual Diff of ESR XML Files');

            // If sfdx-project.json contains decomposeExternalServiceRegistrationBeta, also open a diff for the YAML OAS docs
            if (this.isESRDecomposed) {
              void this.openDiffFile(
                this.replaceXmlToYaml(fullPath[0]),
                this.replaceXmlToYaml(fullPath[1]),
                'Manual Diff of ESR YAML Files'
              );
            }
          }

          // Step: 10 Create entries in problems tab for generated file
          createProblemTabEntriesForOasDocument(
            this.isESRDecomposed ? this.replaceXmlToYaml(fullPath[0]) : fullPath[0],
            processedOasResult,
            this.isESRDecomposed
          );

          // Step 11: Call Mulesoft extension if installed
          const callMulesoftExtension = async () => {
            if (await this.isCommandAvailable('mule-dx-api.open-api-project')) {
              try {
                const yamlUri = vscode.Uri.file(this.replaceXmlToYaml(fullPath[1]));
                await vscode.commands.executeCommand('mule-dx-api.open-api-project', yamlUri);
              } catch (error) {
                telemetryService.sendEventData('mule-dx-api.open-api-project command could not be executed', {
                  error: error.message
                });
                console.error('mule-dx-api.open-api-project command could not be executed', error);
              }
            } else {
              telemetryService.sendEventData('mule-dx-api.open-api-project command not found');
            }
          };
          await callMulesoftExtension();
        }
      );

      // Step 5: Notify Success
      if (fullPath[0] === fullPath[1]) {
        // Case 1: User decided to overwrite the original ESR file
        notificationService.showInformationMessage(nls.localize('openapi_doc_created', type.toLowerCase(), name));
        telemetryService.sendCommandEvent(`ApexAction${type}Created`, hrStart, props, measures);
      } else {
        // Case 2: User decided to manually merge the original and new ESR files
        const message = nls.localize(
          'openapi_doc_created_merge',
          type.toLowerCase(),
          path.basename(fullPath[1], '.externalServiceRegistration-meta.xml'),
          name
        );
        await notificationService.showInformationMessage(message);
        telemetryService.sendCommandEvent(`ApexAction${type}Created`, hrStart, props, measures);
      }
    } catch (error: any) {
      void this.handleError(error, `ApexAction${type}CreationFailed`);
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

  private saveOasAsEsrMetadata = async (oasSpec: OpenAPIV3.Document, fullPath: string): Promise<void> => {
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
      if (this.isESRDecomposed) {
        await vscode.workspace
          .openTextDocument(this.replaceXmlToYaml(fullPath))
          .then((newDocument: vscode.TextDocument) => {
            void vscode.window.showTextDocument(newDocument);
          });
      }
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

  /**
   * Handles the scenario where an ESR file already exists.
   * @returns A string indicating the user's choice: 'overwrite', 'merge', or 'cancel'.
   */
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

  /**
   * Builds the ESR XML content.
   * @param existingContent - The existing XML content, if any.
   * @param fullPath - The full path to the ESR file.
   * @param namedCredential - The named credential to be used.
   * @param oasSpec - The OpenAPI specification.
   */
  private buildESRXml = async (
    existingContent: string | undefined,
    fullPath: string,
    namedCredential: string | undefined,
    oasSpec: OpenAPIV3.Document
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

    const { description, version } = this.extractInfoProperties(oasSpec);
    const operations = this.getOperationsFromYaml(oasSpec);

    // OAS doc inside XML needs &apos; and OAS doc inside YAML needs ' in order to be valid
    let safeOasSpec = stringify(oasSpec);
    if (this.isESRDecomposed) {
      safeOasSpec = safeOasSpec.replaceAll('"', "'").replaceAll('type: Id', 'type: string');
    } else {
      safeOasSpec = safeOasSpec.replaceAll('"', '&apos;').replaceAll('type: Id', 'type: string');
    }

    const orgVersion = await (await WorkspaceContextUtil.getInstance().getConnection()).retrieveMaxApiVersion();
    if (!orgVersion) {
      throw new Error(nls.localize('error_retrieving_org_version'));
    }

    const parser = new XMLParser({ ignoreAttributes: false });
    let jsonObj;

    // Ensure namedCredential is provided and not blank
    if (!this.isVersionGte(orgVersion, '63.0') && (!namedCredential || namedCredential.trim() === '')) {
      throw new Error(nls.localize('invalid_named_credential'));
    }

    const createESRObject = () => ({
      '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      ExternalServiceRegistration: {
        '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
        description,
        label: className,
        ...(this.isESRDecomposed ? {} : { schema: safeOasSpec }),
        schemaType: 'OpenApi3',
        schemaUploadFileExtension: 'yaml',
        schemaUploadFileName: `${className.toLowerCase()}_openapi`,
        status: 'Complete',
        systemVersion: '3',
        operations,
        registrationProvider: className,
        ...(this.isVersionGte(orgVersion, '63.0')
          ? {
              registrationProviderType: 'ApexRest',
              namedCredential: 'null'
            }
          : {
              registrationProviderType: 'Custom',
              namedCredentialReference: namedCredential
            })
      }
    });

    // If existing XML content, parse and update
    if (existingContent) {
      jsonObj = parser.parse(existingContent);
      if (this.isESRDecomposed) {
        // Create a new XML structure without schema
        jsonObj = createESRObject();
        // Replace the contents of the YAML file with the new OAS spec
        this.buildESRYaml(fullPath, safeOasSpec);
      } else {
        if (jsonObj.ExternalServiceRegistration?.schema) {
          // Replace the schema content with the new OAS spec
          jsonObj.ExternalServiceRegistration.schema = safeOasSpec;
        } else {
          // Create a new XML structure with schema
          jsonObj = createESRObject();
        }
      }
      // Replace the operations with the new methods
      jsonObj.ExternalServiceRegistration.operations = operations;
      // Replace the named credential with the one from the input
      jsonObj.ExternalServiceRegistration.namedCredentialReference = namedCredential;
    } else {
      if (this.isESRDecomposed) {
        // Create a new XML structure without schema
        jsonObj = createESRObject();
        this.buildESRYaml(fullPath, safeOasSpec);
      } else {
        // Create a new XML structure with schema
        jsonObj = createESRObject();
      }
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

  private extractInfoProperties = (oasSpec: OpenAPIV3.Document): ApexOASInfo => {
    return {
      description: oasSpec?.info?.description || '',
      version: oasSpec?.info?.version
    };
  };

  private getOperationsFromYaml = (oasSpec: OpenAPIV3.Document): ExternalServiceOperation[] | [] => {
    const operations = Object.entries(oasSpec.paths).flatMap(([p, pathItem]) => {
      if (!pathItem || typeof pathItem !== 'object') return [];
      return Object.entries(pathItem).map(([method, operation]) => {
        if ((operation as OpenAPIV3.OperationObject).operationId) {
          return {
            name: (operation as OpenAPIV3.OperationObject).operationId,
            active: true
          };
        }
        return null;
      });
    });

    return operations.filter((operation): operation is ExternalServiceOperation => operation !== null);
  };

  /**
   * Builds the YAML file for the ESR using safeOasSpec as the contents.
   * @param esrXmlPath - The path to the ESR XML file.
   * @param safeOasSpec - The contents of the OAS doc that will be written to the YAML file.
   */
  private buildESRYaml = (esrXmlPath: string, safeOasSpec: string) => {
    this.gil.addFinalDoc(safeOasSpec);
    const esrYamlPath = this.replaceXmlToYaml(esrXmlPath);
    try {
      fs.writeFileSync(esrYamlPath, safeOasSpec, 'utf8');
      console.log(`File created at ${esrYamlPath}`);
    } catch (err) {
      throw new Error('Error writing file:', err);
    }
  };

  /**
   * Gets the filepath for the YAML file of the ESR.
   * @param filePath - The path to the ESR XML file.
   * @returns A string with the YAML filepath.
   */
  private replaceXmlToYaml = (filePath: string): string => {
    return filePath.replace('.externalServiceRegistration-meta.xml', '.yaml');
  };

  /**
   * Opens a diff editor for the two files.
   * @param filepath1 The file on the left side of the diff editor.
   * @param filepath2 The file on the right side of the diff editor.
   * @param diffWindowName The title of the diff editor.
   */
  private openDiffFile = async (filepath1: string, filepath2: string, diffWindowName: string): Promise<void> => {
    await vscode.commands.executeCommand(
      'vscode.diff',
      vscode.Uri.file(filepath1),
      vscode.Uri.file(filepath2),
      diffWindowName
    );
  };

  /**
   * Checks if a VSCode command is available.
   * @param commandId Command ID of the VSCode command to check
   * @returns boolean - true if the command is available, false otherwise
   */
  private isCommandAvailable = async (commandId: string): Promise<boolean> => {
    const commands = await vscode.commands.getCommands(true);
    return commands.includes(commandId);
  };

  private getConfigBidRule(): BidRule {
    return vscode.workspace
      .getConfiguration()
      .get('salesforcedx-vscode-apex.oas_generation_strategy', 'JSON_METHOD_BY_METHOD');
  }
}
