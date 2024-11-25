/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { notificationService } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { languageClientUtils } from '../languageUtils';
import { nls } from '../messages';
import {
  ApexClassOASEligibleRequest,
  ApexClassOASEligibleResponses,
  ApexOASEligiblePayload,
  ApexOASResource
} from '../openApiUtilities/schemas';
import { getTelemetryService } from '../telemetry/telemetry';

/**
 * Interface representing the metadata of a method.
 */
export interface MethodMetadata {
  name: string;
  parameters: Parameter[];
  returnType: string;
  isAuraEnabled: boolean;
  className?: string;
}

/**
 * Interface representing a parameter of a method.
 */
export interface Parameter {
  name: string;
  in: string;
  required: boolean;
  description: string;
  schema: { type: string };
}

/**
 * Class responsible for orchestrating metadata operations.
 */
export class MetadataOrchestrator {
  /**
   * Checks if a method is eligible for Apex Action creation.
   * @param methodIdentifier - The identifier of the method.
   * @returns True if the method is eligible, false otherwise.
   */
  public isMethodEligible = (methodIdentifier: string): boolean => {
    // Placeholder for eligibility logic
    return true;
  };

  /**
   * Extracts metadata for the method at the current cursor position.
   * @returns The metadata of the method, or undefined if no method is found.
   */
  public extractMethodMetadata = (): MethodMetadata | undefined => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith('cls')) {
      notificationService.showErrorMessage(nls.localize('invalid_active_text_editor'));
      return;
    }

    const document = editor.document;
    const cursorPosition = editor.selection.active;
    const lines = document.getText().split('\n');
    const currentLineIndex = cursorPosition.line;

    let methodSignature = '';
    let isAuraEnabled = false;

    // Check if the preceding line contains @AuraEnabled
    if (currentLineIndex > 0 && lines[currentLineIndex - 1].includes('@AuraEnabled')) {
      isAuraEnabled = true;
    }

    // Traverse lines starting from the cursor position to construct the method signature
    for (let line of lines) {
      line = line.trim();
      methodSignature += ` ${line}`;

      // Stop once the closing parenthesis is reached
      if (line.includes(') {')) {
        break;
      }
    }

    const methodMetadata = this.parseMethodSignature(methodSignature, isAuraEnabled);
    if (!methodMetadata.isAuraEnabled) {
      throw new Error(nls.localize('not_aura_enabled', methodMetadata.name));
    }
    return methodMetadata;
  };

  public extractAllMethodsMetadata = async (
    sourceUri: vscode.Uri | undefined
  ): Promise<MethodMetadata[] | undefined> => {
    let lines;
    let className;
    if (sourceUri) {
      const path = sourceUri?.path.toString();
      className = path!
        .substring(path!.lastIndexOf(process.platform === 'win32' ? '\\' : '/') + 1)
        .split('.')
        .shift();
      const fileContent = await vscode.workspace.fs.readFile(sourceUri!);
      const fileText = Buffer.from(fileContent).toString('utf-8');
      lines = fileText.split('\n');
    } else {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !editor.document.fileName.endsWith('cls')) {
        notificationService.showErrorMessage(nls.localize('invalid_active_text_editor'));
        return;
      }

      const document = editor.document;
      const filePath = document.fileName;
      className = filePath
        .substring(filePath.lastIndexOf(process.platform === 'win32' ? '\\' : '/') + 1)
        .split('.')
        .shift();
      lines = document.getText().split('\n');
    }
    const metadataList: MethodMetadata[] = [];
    let currentMethodSignature = '';
    let isAuraEnabled = false;

    for (let line of lines) {
      line = line.trim();

      // Detect @AuraEnabled annotation
      if (line.includes('@AuraEnabled')) {
        isAuraEnabled = true;
      }

      // Build the method signature
      currentMethodSignature += ` ${line}`;
      if (line.includes(') {') && currentMethodSignature.includes('(')) {
        // Method signature is complete
        if (isAuraEnabled) {
          const methodMetadata = this.parseMethodSignature(currentMethodSignature, isAuraEnabled, className);
          if (methodMetadata) {
            metadataList.push(methodMetadata);
          }
          isAuraEnabled = false;
        }

        // Reset for the next method
        currentMethodSignature = '';
      }
    }

    if (metadataList.length === 0) {
      throw new Error(nls.localize('no_eligible_methods_found'));
    }

    return metadataList;
  };
  /**
   * Parses a method signature and returns the method metadata.
   * @param methodSignature - The method signature to parse.
   * @param isAuraEnabled - Indicates if the method is Aura-enabled.
   * @param className - The name of the class containing the method.
   * @returns The metadata of the method, or undefined if parsing fails.
   */
  private parseMethodSignature(methodSignature: string, isAuraEnabled: boolean, className?: string): MethodMetadata {
    const methodRegex = /\b(public|private|protected|global)\s+(static\s+)?([\w<>\[\]]+)\s+(\w+)\s*\((.*?)\)/s;
    const match = methodRegex.exec(methodSignature);
    if (!match) {
      throw Error(nls.localize('no_valid_method_found'));
    }

    const returnType = match[3];
    const methodName = match[4];
    const parametersRaw = match[5] ? match[5].split(',').map(param => param.trim()) : [];
    const parameters = parametersRaw.map(param => {
      const [type, name] = param.split(/\s+/);
      return {
        name,
        in: 'query',
        required: true,
        description: `The ${name} parameter of type ${type}.`,
        schema: { type: this.mapApexTypeToJsonType(type) }
      };
    });

    return {
      name: methodName,
      parameters,
      returnType,
      isAuraEnabled,
      className
    };
  }

  /**
   * Maps an Apex type to a JSON type.
   * @param apexType - The Apex type to map.
   * @returns The corresponding JSON type.
   */
  private mapApexTypeToJsonType = (apexType: string): string => {
    switch (apexType.toLowerCase()) {
      case 'string':
        return 'string';
      case 'integer':
      case 'int':
      case 'long':
        return 'integer';
      case 'boolean':
        return 'boolean';
      case 'decimal':
      case 'double':
      case 'float':
        return 'number';
      default:
        return 'string';
    }
  };

  public eligibilityDelegate = async (
    requests: ApexOASEligiblePayload
  ): Promise<ApexClassOASEligibleResponses | undefined> => {
    const telemetryService = await getTelemetryService();
    let response;
    const languageClient = languageClientUtils.getClientInstance();
    if (languageClient) {
      const classNumbers = requests.payload.length.toString();
      const requestTarget = this.requestTarget(requests);
      try {
        response = (await languageClient?.sendRequest('apexoas/isEligible', requests)) as ApexClassOASEligibleResponses;
        telemetryService.sendEventData('isEligibleResponseSucceeded', {
          classNumbers,
          requestTarget
        });
      } catch (error) {
        telemetryService.sendException(
          'isEligibleResponseFailed',
          `${error} failed to send request to language server with ${classNumbers} classes and target of request for ${requestTarget}`
        );
        // fallback TBD after we understand it better
        throw new Error(nls.localize('cannot_get_apexoaseligibility_response'));
      }
    }
    return response;
  };

  public validateEligibility = async (
    sourceUri: vscode.Uri | vscode.Uri[],
    isMethodSelected: boolean = false
  ): Promise<ApexClassOASEligibleResponses | undefined> => {
    const telemetryService = await getTelemetryService();
    const requests = [];
    if (Array.isArray(sourceUri)) {
      // if sourceUri is an array, then multiple classes/folders are selected
      for (const uri of sourceUri) {
        const request = {
          resourceUri: uri.path,
          includeAllMethods: true,
          includeAllProperties: true,
          methodNames: [],
          positions: null,
          propertyNames: []
        } as ApexClassOASEligibleRequest;
        requests.push(request);
      }
    } else {
      let cursorPosition;
      if (isMethodSelected) {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.fileName.endsWith('cls')) {
          cursorPosition = editor.selection.active;
        } else {
          telemetryService.sendException('activeTextEditorNotApex', nls.localize('active_text_editor_not_apex'));
          throw new Error(nls.localize('invalid_active_text_editor'));
        }
      }
      // generate the payload
      const request: ApexClassOASEligibleRequest = {
        resourceUri: sourceUri.path,
        includeAllMethods: !isMethodSelected,
        includeAllProperties: !isMethodSelected,
        positions: cursorPosition ? [cursorPosition] : null,
        methodNames: [],
        propertyNames: []
      };
      requests.push(request);
    }

    const responses = await this.eligibilityDelegate({ payload: requests });
    return responses;
  };

  public requestTarget(requestPayload: ApexOASEligiblePayload): ApexOASResource {
    const payload = requestPayload.payload;
    if (payload.length > 1) return ApexOASResource.multiClass;
    else {
      const request = payload[0];
      if (!request.includeAllMethods && !request.includeAllProperties) return ApexOASResource.singleMethodOrProp;
      if (!request.resourceUri.endsWith('.cls')) {
        return ApexOASResource.folder;
      } else return ApexOASResource.class;
    }
  }
}
