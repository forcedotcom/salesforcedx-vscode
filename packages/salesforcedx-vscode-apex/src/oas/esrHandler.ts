/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WorkspaceContextUtil, workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
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
import { ApexOASInfo, ExternalServiceOperation } from '../oas/schemas';
import { createProblemTabEntriesForOasDocument, getCurrentTimestamp, summarizeDiagnostics } from '../oasUtils';
import { getTelemetryService } from '../telemetry/telemetry';
import { ProcessorInputOutput } from './documentProcessorPipeline/processorStep';
import { PromptGenerationOrchestrator } from './promptGenerationOrchestrator';

/*
 * Handles the creation and management of External Service Registration (ESR) metadata.
 * This includes saving OpenAPI specifications as ESR metadata, managing named credentials,
 * and building the ESR XML and YAML files.
 */
export class ESRHandler {
  private isESRDecomposed: boolean = false;
  private gil = GenerationInteractionLogger.getInstance();
  private processedOasResult: ProcessorInputOutput = {} as any;
  private oasSpec: OpenAPIV3.Document = {} as any;
  private overwrite: boolean = false;
  private originalPath: string = '';
  private newPath: string = '';

  constructor() {}

  public async initialize(
    isESRDecomposed: boolean,
    processedOasResult: ProcessorInputOutput,
    fullPath: [string, string, boolean]
  ) {
    this.isESRDecomposed = isESRDecomposed;
    this.processedOasResult = processedOasResult;
    this.oasSpec = processedOasResult.openAPIDoc;
    this.overwrite = fullPath[0] === fullPath[1];
    this.originalPath = fullPath[0];
    this.newPath = fullPath[1];
  }

  /**
   * Generates the ESR metadata document.
   * This method handles the process of reading existing ESR content,
   * updating it with the new OpenAPI specification, and writing it back to the file system.
   * It also manages the creation of the corresponding YAML file if ESR decomposition is enabled.
   * Additionally, it gathers metrics, opens a diff editor if needed, and creates entries in the problems tab.
   *
   * @param isClass - Indicates if the generation is for a class.
   * @param generationHrDuration - The duration of the generation process.
   * @param promptGenerationOrchestrator - The orchestrator for prompt generation.
   * @returns An object containing properties and measures for telemetry.
   */
  public async generateEsrMD(
    isClass: boolean,
    generationHrDuration: [number, number],
    promptGenerationOrchestrator: PromptGenerationOrchestrator
  ) {
    const orgVersion = await (await WorkspaceContextUtil.getInstance().getConnection()).retrieveMaxApiVersion();
    let existingContent;
    let namedCredential;
    if (fs.existsSync(this.newPath)) {
      existingContent = fs.readFileSync(this.newPath, 'utf8');
    }

    //Step 1: Let user choose or enter a named credential
    if (!this.isVersionGte(orgVersion, '63.0')) namedCredential = await this.showNamedCredentialsQuickPick();

    //Step 2: Build the content of the ESR Xml file
    const updatedContent = await this.buildESRXml(existingContent, namedCredential);

    //Step 3: Write OpenAPI Document to File
    try {
      fs.writeFileSync(this.newPath, updatedContent);
      await vscode.workspace.openTextDocument(this.newPath).then((newDocument: vscode.TextDocument) => {
        void vscode.window.showTextDocument(newDocument);
      });
      if (this.isESRDecomposed) {
        await vscode.workspace
          .openTextDocument(this.replaceXmlToYaml(this.newPath))
          .then((newDocument: vscode.TextDocument) => {
            void vscode.window.showTextDocument(newDocument);
          });
      }
    } catch (error) {
      throw new Error(nls.localize('artifact_failed', error.message));
    }

    //Step 2: Gather metrics
    const props = {
      isClass: `${isClass}`,
      overwrite: `${this.overwrite}`
    };

    const [errors, warnings, infos, hints, total] = summarizeDiagnostics(this.processedOasResult.errors);

    const measures = {
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

    // Step 3: If the user chose to merge, open a diff between the original and new ESR files
    this.openDiffFiles();

    // Step: 4 Create entries in problems tab for generated file
    createProblemTabEntriesForOasDocument(
      this.isESRDecomposed ? this.replaceXmlToYaml(this.newPath) : this.newPath,
      this.processedOasResult,
      this.isESRDecomposed
    );
    return { props, measures };
  }

  /**
   * Prompts the user to select or enter a named credential.
   * This method queries the available named credentials and presents them in a quick pick menu.
   * If the user selects "Enter new named credential", they are prompted to enter the name manually.
   *
   * @returns A promise that resolves to the selected or entered named credential, or undefined if none was selected.
   */
  private async showNamedCredentialsQuickPick(): Promise<string | undefined> {
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
  }

  /**
   * Builds the ESR XML content.
   * @param existingContent - The existing XML content, if any.
   * @param namedCredential - The named credential to be used.
   */
  private async buildESRXml(existingContent: string | undefined, namedCredential: string | undefined): Promise<string> {
    const baseName = path.basename(this.newPath).split('.')[0];
    let className;
    if (this.newPath.includes('esr_files_for_merge')) {
      // The class name is the part before the second to last underscore
      const parts = baseName.split('_');
      className = parts.slice(0, -2).join('_');
    } else {
      className = baseName;
    }

    const { description, version } = this.extractInfoProperties();
    const operations = this.getOperationsFromYaml();

    // OAS doc inside XML needs &apos; and OAS doc inside YAML needs ' in order to be valid
    let safeOasSpec = stringify(this.oasSpec);
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

    if (existingContent) {
      jsonObj = parser.parse(existingContent);
      if (this.isESRDecomposed) {
        jsonObj = createESRObject();
        this.buildESRYaml(this.newPath, safeOasSpec);
      } else {
        if (jsonObj.ExternalServiceRegistration?.schema) {
          jsonObj.ExternalServiceRegistration.schema = safeOasSpec;
        } else {
          jsonObj = createESRObject();
        }
      }
      jsonObj.ExternalServiceRegistration.operations = operations;
      jsonObj.ExternalServiceRegistration.namedCredentialReference = namedCredential;
    } else {
      if (this.isESRDecomposed) {
        jsonObj = createESRObject();
        this.buildESRYaml(this.newPath, safeOasSpec);
      } else {
        jsonObj = createESRObject();
      }
    }

    const builder = new XMLBuilder({ ignoreAttributes: false, format: true, processEntities: false });
    return builder.build(jsonObj);
  }

  /**
   * Checks if the given version is greater than or equal to the target version.
   * @param version - The version to check.
   * @param targetVersion - The target version to compare against.
   * @returns True if the version is greater than or equal to the target version, false otherwise.
   */
  private isVersionGte(version: string, targetVersion: string): boolean {
    const major = parseInt(version.split('.')[0], 10);
    const targetMajor = parseInt(targetVersion.split('.')[0], 10);
    return major >= targetMajor;
  }

  /**
   * Extracts the description and version properties from the OpenAPI specification.
   * @returns An object containing the description and version properties.
   */
  private extractInfoProperties(): ApexOASInfo {
    return {
      description: this.oasSpec?.info?.description || '',
      version: this.oasSpec?.info?.version
    };
  }

  /**
   * Extracts the operations from the OpenAPI specification.
   * @returns An array of ExternalServiceOperation objects.
   */
  private getOperationsFromYaml(): ExternalServiceOperation[] | [] {
    const operations = Object.entries(this.oasSpec.paths).flatMap(([p, pathItem]) => {
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
  }

  /**
   * Builds the YAML file for the ESR using safeOasSpec as the contents.
   * @param esrXmlPath - The path to the ESR XML file.
   * @param safeOasSpec - The contents of the OAS doc that will be written to the YAML file.
   */
  private buildESRYaml(esrXmlPath: string, safeOasSpec: string) {
    this.gil.addFinalDoc(safeOasSpec);
    const esrYamlPath = this.replaceXmlToYaml(esrXmlPath);
    try {
      fs.writeFileSync(esrYamlPath, safeOasSpec, 'utf8');
      console.log(`File created at ${esrYamlPath}`);
    } catch (err) {
      throw new Error('Error writing file:', err);
    }
  }

  /**
   * Replaces the XML file extension with a YAML file extension.
   * @param filePath - The path to the XML file.
   * @returns The path to the YAML file.
   */
  replaceXmlToYaml = (filePath: string): string => {
    return filePath.replace('.externalServiceRegistration-meta.xml', '.yaml');
  };

  /**
   * Opens a diff editor for the original and new ESR files.
   * @param originalFilePath The file path of the original ESR file.
   * @param newFilePath The file path of the new ESR file.
   * @param isESRDecomposed Indicates if ESR decomposition is enabled.
   */
  public async openDiffFiles(): Promise<void> {
    if (!this.overwrite) {
      void this.openDiffFile(this.originalPath, this.newPath, 'Manual Diff of ESR XML Files');

      // If sfdx-project.json contains decomposeExternalServiceRegistrationBeta, also open a diff for the YAML OAS docs
      if (this.isESRDecomposed) {
        void this.openDiffFile(
          this.replaceXmlToYaml(this.originalPath),
          this.replaceXmlToYaml(this.newPath),
          'Manual Diff of ESR YAML Files'
        );
      }
    }
  }

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
   * Checks if the ESR file already exists and prompts the user on what to do.
   * @param filename
   * @returns Promise<[string, string, boolean]> - [className.externalServiceRegistration-meta.xml, the file name of the generated ESR, a boolean indicating if the file already exists]
   */
  pathExists = async (filename: string): Promise<[string, string, boolean]> => {
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
        const currentTimestamp = getCurrentTimestamp();
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

  /**
   * Handles the scenario where an ESR file already exists.
   * @returns A string indicating the user's choice: 'overwrite', 'merge', or 'cancel'.
   */
  handleExistingESR = async (): Promise<string> => {
    const response = await vscode.window.showWarningMessage(
      nls.localize('file_exists'),
      { modal: true },
      nls.localize('overwrite'),
      nls.localize('merge')
    );
    return response || 'cancel';
  };

  getFolderForArtifact = async (): Promise<string | undefined> => {
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
}
