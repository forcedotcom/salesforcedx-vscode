/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { notificationService } from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { LanguageClientUtils } from '../languageUtils/languageClientUtils';
import { nls } from '../messages';

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

type ApexOASEligiblePayload = {
  payload: ApexClassOASEligibleRequest[];
};

type ApexClassOASEligibleRequest = {
  resourceUri: string;
  includeAllMethods: boolean;
  includeAllProperties: boolean;
  positions: vscode.Position[] | null;
  methodNames: string[] | null;
  propertyNames: string[] | null;
};

interface SymbolEligibility {
  isEligible: boolean;
  docSymbol: vscode.DocumentSymbol;
}

type ApexClassOASEligibleResponse = {
  isEligible: boolean;
  resourceUri: string;
  symbols?: SymbolEligibility[];
};

type ApexClassOASEligibleRequests = ApexClassOASEligibleRequest[];
type ApexClassOASEligibleResponses = ApexClassOASEligibleResponse[] | undefined;
/**
 * Class responsible for orchestrating metadata operations.
 */
export class MetadataOrchestrator {
  private writeEligibleResponse(isEligibleResponses: ApexClassOASEligibleResponses, fileName = 'eligible.json') {
    fs.writeFileSync(path.join(process.cwd(), fileName), JSON.stringify(isEligibleResponses, undefined, 2));
  }

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
  public extractMethodMetadata = async (): Promise<MethodMetadata | undefined> => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      notificationService.showErrorMessage(nls.localize('no_active_editor'));
      return;
    }

    const isEligibleRequest: ApexClassOASEligibleRequest = {
      resourceUri: editor.document.uri.toString(),
      includeAllMethods: false,
      includeAllProperties: false,
      positions: [editor.selection.active],
      methodNames: [],
      propertyNames: []
    };

    const languageClient = LanguageClientUtils.getInstance().getClientInstance();

    const oasEligiblePayload: ApexOASEligiblePayload = {
      payload: [isEligibleRequest]
    };

    const isEligibleResponses: ApexClassOASEligibleResponses = await languageClient?.sendRequest(
      'apexoas/isEligible',
      oasEligiblePayload
    );
    if (!isEligibleResponses) {
      notificationService.showWarningMessage('No valid method found at cursor position.');
      return;
    }
    this.writeEligibleResponse(isEligibleResponses);

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
    const uri: vscode.Uri | undefined = sourceUri
      ? sourceUri
      : vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.document.uri
        : undefined;

    if (!uri) {
      notificationService.showErrorMessage(nls.localize('no_active_editor'));
      return;
    }

    let isEligibleRequest: ApexClassOASEligibleRequest = {
      resourceUri: uri.toString(),
      includeAllMethods: true,
      includeAllProperties: true,
      positions: [],
      methodNames: [],
      propertyNames: []
    };

    const languageClient = LanguageClientUtils.getInstance().getClientInstance();

    let oasEligiblePayload: ApexOASEligiblePayload = {
      payload: [isEligibleRequest]
    };

    let isEligibleResponses: ApexClassOASEligibleResponses = await languageClient?.sendRequest(
      'apexoas/isEligible',
      oasEligiblePayload
    );

    if (!isEligibleResponses) {
      notificationService.showWarningMessage('No valid method found at cursor position.');
    } else {
      this.writeEligibleResponse(isEligibleResponses);
    }

    const parent = path.dirname(uri.fsPath);

    isEligibleRequest = {
      resourceUri: `file://${path.resolve(parent)}`,
      includeAllMethods: true,
      includeAllProperties: true,
      positions: [],
      methodNames: [],
      propertyNames: []
    };

    oasEligiblePayload = {
      payload: [isEligibleRequest]
    };

    isEligibleResponses = await languageClient?.sendRequest('apexoas/isEligible', oasEligiblePayload);

    if (!isEligibleResponses) {
      notificationService.showWarningMessage('No valid method found at cursor position.');
    }

    this.writeEligibleResponse(isEligibleResponses, `${path.basename(parent)}-all-isEligible-response.json`);

    const className = path.basename(uri.fsPath, '.cls');
    const fileContent = await vscode.workspace.fs.readFile(uri);
    const fileText = Buffer.from(fileContent).toString('utf-8');
    const lines = fileText.split('\n');

    const metadataList: MethodMetadata[] = [];
    let currentMethodSignature = '';
    let isAuraEnabled = false;

    try {
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
    } catch (e) {
      console.log(e);
      throw e;
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
}
