/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/consistent-type-assertions */

import { workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import { RegistryAccess } from '@salesforce/source-deploy-retrieve-bundle';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { OpenAPIV3 } from 'openapi-types';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { stringify } from 'yaml';
import { nls } from '../messages';
import {
  createProblemTabEntriesForOasDocument,
  getCurrentTimestamp,
  hasValidRestAnnotations,
  hasAuraEnabledMethods
} from '../oasUtils';
import { ProcessorInputOutput } from './documentProcessorPipeline/processorStep';
import GenerationInteractionLogger from './generationInteractionLogger';
import { ApexOASInfo, ExternalServiceOperation } from './schemas';

export type FullPath = [originalPath: string, newPath: string];

/*
 * Handles the creation and management of External Service Registration (ESR) metadata.
 * This includes saving OpenAPI specifications as ESR metadata, managing named credentials,
 * and building the ESR XML and YAML files.
 */
export class ExternalServiceRegistrationManager {
  private isESRDecomposed = false;
  private gil = GenerationInteractionLogger.getInstance();
  private oasSpec?: OpenAPIV3.Document;
  private overwrite = false;
  private originalPath: string = '';
  private newPath: string = '';
  providerType: string | undefined;

  private initialize(
    isESRDecomposed: boolean,
    processedOasResult: ProcessorInputOutput,
    fullPath: [originalPath: string, newPath: string]
  ) {
    this.isESRDecomposed = isESRDecomposed;
    this.oasSpec = processedOasResult.openAPIDoc;
    this.overwrite = fullPath[0] === fullPath[1];
    this.originalPath = fullPath[0];
    this.newPath = fullPath[1];
  }

  /**
   * Determines the provider type based on the annotations in the context.
   * @param context - The context containing class and method details with annotations
   * @returns
   * "ApexRest" if class has RestResource annotation and methods have Http* annotations,
   * "AuraEnabled" if no class annotation and methods have AuraEnabled annotations,
   * or undefined if neither pattern matches
   */
  private determineProviderType(context?: ProcessorInputOutput['context']): string | undefined {
    if (!context) {
      return undefined;
    }

    // ApexRest: has class RestResource annotation AND at least one Http* method annotation
    if (hasValidRestAnnotations(context)) {
      return 'ApexRest';
    }

    // AuraEnabled: no class annotation AND at least one AuraEnabled method annotation
    if (hasAuraEnabledMethods(context)) {
      return 'AuraEnabled';
    }

    return undefined;
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
    isESRDecomposed: boolean,
    processedOasResult: ProcessorInputOutput,
    fullPath: FullPath
  ): Promise<void> {
    this.initialize(isESRDecomposed, processedOasResult, fullPath);
    this.providerType = this.determineProviderType(processedOasResult.context);

    const existingContent = fs.existsSync(this.newPath) ? fs.readFileSync(this.newPath, 'utf8') : undefined;

    //Step 1: Build the content of the ESR Xml file
    const updatedContent = await this.buildESRXml(existingContent);

    //Step 2: Write OpenAPI Document to File
    await this.writeAndOpenEsrFile(updatedContent);

    // Step 3: If the user chose to merge, open a diff between the original and new ESR files
    await this.displayFileDifferences();

    // Step: 4 Create entries in problems tab for generated file
    createProblemTabEntriesForOasDocument(
      this.isESRDecomposed ? replaceXmlToYaml(this.newPath) : this.newPath,
      processedOasResult,
      this.isESRDecomposed
    );
  }

  /**
   * Writes the updated content to a file and opens it in the editor.
   * If the ESR is decomposed, it also opens the corresponding YAML file.
   *
   * @param updatedContent - The content to be written to the file.
   * @throws Will throw an error if the file write or document open operation fails.
   */
  public async writeAndOpenEsrFile(updatedContent: string) {
    try {
      fs.writeFileSync(this.newPath, updatedContent);
      await vscode.workspace.openTextDocument(this.newPath).then((newDocument: vscode.TextDocument) => {
        void vscode.window.showTextDocument(newDocument);
      });
      if (this.isESRDecomposed) {
        await vscode.workspace
          .openTextDocument(replaceXmlToYaml(this.newPath))
          .then((newDocument: vscode.TextDocument) => {
            void vscode.window.showTextDocument(newDocument);
          });
      }
    } catch (error) {
      throw new Error(nls.localize('artifact_failed', error.message));
    }
  }

  /**
   * Builds the ESR XML content.
   * @param existingContent - The existing XML content, if any.
   * @param namedCredential - The named credential to be used.
   */
  public async buildESRXml(existingContent: string | undefined): Promise<string> {
    const baseName = path.basename(this.newPath).split('.')[0];
    const className = this.newPath.includes('esr_files_for_merge')
      ? // The class name is the part before the second to last underscore
        baseName.split('_').slice(0, -2).join('_')
      : baseName;

    const { description } = this.extractInfoProperties();
    const operations = this.getOperationsFromYaml();

    // OAS doc inside XML needs &apos; and OAS doc inside YAML needs ' in order to be valid
    const replaceElement = this.isESRDecomposed ? "'" : '&apos;';
    const safeOasSpec = stringify(this.oasSpec ?? {})
      .replaceAll('"', replaceElement)
      .replaceAll('type: Id', 'type: string');
    const parser = new XMLParser({ ignoreAttributes: false });
    let jsonObj;

    // Create ESR Object
    const esrObject = this.createESRObject(description, className, safeOasSpec, operations);

    if (existingContent) {
      jsonObj = parser.parse(existingContent);
      if (this.isESRDecomposed) {
        jsonObj = esrObject;
        this.buildESRYaml(this.newPath, safeOasSpec);
      } else {
        if (jsonObj.ExternalServiceRegistration?.schema) {
          jsonObj.ExternalServiceRegistration.schema = safeOasSpec;
        } else {
          jsonObj = esrObject;
        }
      }
      jsonObj.ExternalServiceRegistration.operations = operations;
    } else {
      jsonObj = esrObject;
      if (this.isESRDecomposed) this.buildESRYaml(this.newPath, safeOasSpec);
    }

    const builder = new XMLBuilder({ ignoreAttributes: false, format: true, processEntities: false });
    return builder.build(jsonObj);
  }

  /**
   * Creates an External Service Registration (ESR) object.
   *
   * @param description - The description of the ESR.
   * @param className - The name of the class associated with the ESR.
   * @param safeOasSpec - The sanitized OpenAPI specification.
   * @param operations - The operations defined in the ESR.
   * @returns An object representing the ESR.
   */
  public createESRObject(description: string, className: string, safeOasSpec: string, operations: any) {
    return {
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
        registrationProviderType: this.providerType,
        namedCredential: 'null'
      }
    };
  }

  /**
   * Extracts the description and version properties from the OpenAPI specification.
   * @returns An object containing the description and version properties.
   */
  public extractInfoProperties(): ApexOASInfo {
    return {
      description: this.oasSpec?.info?.description || ''
    };
  }

  /**
   * Extracts the operations from the OpenAPI specification.
   * @returns An array of ExternalServiceOperation objects.
   */
  public getOperationsFromYaml(): ExternalServiceOperation[] | [] {
    const operations = Object.entries(this.oasSpec?.paths ?? {}).flatMap(([, pathItem]) => {
      if (!pathItem || typeof pathItem !== 'object') return [];
      return Object.entries(pathItem).map(([, operation]) => {
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
  public buildESRYaml(esrXmlPath: string, safeOasSpec: string) {
    this.gil.addFinalDoc(safeOasSpec);
    const esrYamlPath = replaceXmlToYaml(esrXmlPath);
    try {
      fs.writeFileSync(esrYamlPath, safeOasSpec, 'utf8');
      console.log(`File created at ${esrYamlPath}`);
    } catch (err) {
      throw new Error('Error writing file:', err);
    }
  }

  /**
   * Opens a diff editor for the original and new ESR files.
   * @param originalFilePath The file path of the original ESR file.
   * @param newFilePath The file path of the new ESR file.
   * @param isESRDecomposed Indicates if ESR decomposition is enabled.
   */
  public async displayFileDifferences(): Promise<void> {
    if (!this.overwrite) {
      void openDiffFile(this.originalPath, this.newPath, 'Manual Diff of ESR XML Files');

      // If sfdx-project.json contains decomposeExternalServiceRegistrationBeta, also open a diff for the YAML OAS docs
      if (this.isESRDecomposed) {
        void openDiffFile(
          replaceXmlToYaml(this.originalPath),
          replaceXmlToYaml(this.newPath),
          'Manual Diff of ESR YAML Files'
        );
      }
    }
  }

  /**
   * Checks if the ESR file already exists and prompts the user on what to do.
   * @param filename
   * @returns Promise<[string, string, boolean]> - [className.externalServiceRegistration-meta.xml, the file name of the generated ESR, a boolean indicating if the file already exists]
   */
  pathExists = async (filename: string): Promise<FullPath> => {
    // Step 1: Prompt for Folder
    const folder = await this.getFolderForArtifact();
    if (!folder) {
      throw new Error(nls.localize('no_folder_selected'));
    }

    // Step 2: Verify folder exists and if not create it
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    // Step 3: Check if File Exists
    const fullPath = path.join(folder, filename);
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
        return [fullPath, newFullPath];
      }
    }
    return [fullPath, fullPath];
  };

  /**
   * Handles the scenario where an ESR file already exists.
   * @returns A string indicating the user's choice: 'overwrite', 'merge', or 'cancel'.
   */
  handleExistingESR = async (): Promise<string> =>
    (await vscode.window.showWarningMessage(
      nls.localize('file_exists'),
      { modal: true },
      nls.localize('overwrite'),
      nls.localize('merge')
    )) ?? 'cancel';

  getFolderForArtifact = async (): Promise<string | undefined> => {
    const registryAccess = new RegistryAccess();
    let esrDefaultDirectoryName;
    let folderUri;
    try {
      esrDefaultDirectoryName = registryAccess.getTypeByName('ExternalServiceRegistration').directoryName;
    } catch {
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

/**
 * Replaces the XML file extension with a YAML file extension.
 * @param filePath - The path to the XML file.
 * @returns The path to the YAML file.
 */
export const replaceXmlToYaml = (filePath: string): string =>
  filePath.replace('.externalServiceRegistration-meta.xml', '.yaml');

/**
 * Opens a diff editor for the two files.
 * @param filepath1 The file on the left side of the diff editor.
 * @param filepath2 The file on the right side of the diff editor.
 * @param diffWindowName The title of the diff editor.
 */
const openDiffFile = async (filepath1: string, filepath2: string, diffWindowName: string): Promise<void> => {
  await vscode.commands.executeCommand('vscode.diff', URI.file(filepath1), URI.file(filepath2), diffWindowName);
};
