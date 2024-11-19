/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { notificationService } from '@salesforce/salesforcedx-utils-vscode';
import { stringify } from 'querystring';
import * as vscode from 'vscode';
export interface MethodMetadata {
  name: string;
  parameters: Parameter[];
  returnType: string;
  isAuraEnabled: boolean;
  className?: string;
}
export interface Parameter {
  name: string;
  in: string;
  required: boolean;
  description: string;
  schema: { type: string };
}
export class MetadataOrchestrator {
  constructor() {
    // Initialization code here
  }

  public extractMethodMetadata = (): MethodMetadata | undefined => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      notificationService.showErrorMessage('No active editor detected.');
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
    for (let i = currentLineIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      methodSignature += ` ${line}`;

      // Stop once the closing parenthesis is reached
      if (line.includes(')')) {
        break;
      }
    }

    if (!methodSignature) {
      notificationService.showWarningMessage('No valid method found at cursor position.');
      return;
    }

    // Parse the method signature
    const methodRegex = /\b(public|private|protected|global)\s+(static\s+)?([\w<>\[\]]+)\s+(\w+)\s*\((.*?)\)/s;
    const match = methodRegex.exec(methodSignature);
    if (!match) {
      notificationService.showWarningMessage('Failed to parse method signature.');
      throw Error('Failed to parse method signature.');
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
      isAuraEnabled
    };
  };

  public extractAllMethodsMetadata = (): MethodMetadata[] | undefined => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      notificationService.showErrorMessage('No active editor detected.');
      return;
    }

    const document = editor.document;
    const filePath = document.fileName;
    const className = filePath
      .substring(filePath.lastIndexOf(process.platform === 'win32' ? '\\' : '/') + 1)
      .split('.')
      .shift();
    const lines = document.getText().split('\n');
    const metadataList: MethodMetadata[] = [];
    let currentMethodSignature = '';
    let isAuraEnabled = false;
    let isEligible = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Detect @AuraEnabled annotation
      if (line.includes('@AuraEnabled')) {
        isAuraEnabled = true;
        isEligible = true;
      }

      // Build the method signature
      currentMethodSignature += ` ${line}`;
      if (line.includes(') {') && currentMethodSignature.includes('(')) {
        // Method signature is complete
        if (isEligible) {
          isEligible = false;
          const methodRegex = /\b(public|private|protected|global)\s+(static\s+)?([\w<>\[\]]+)\s+(\w+)\s*\((.*?)\)/s;
          const match = methodRegex.exec(currentMethodSignature);
          if (match) {
            const returnType = match[3];
            const methodName = match[4];
            const parametersRaw = match[5] ? match[5].split(',').map(param => param.trim()) : [];

            // Map parameters to the desired structure
            const parameters = parametersRaw.map(param => {
              const [type, name] = param.split(/\s+/);
              return {
                name: name || '',
                in: 'query', // Assuming query parameters; adjust as needed
                required: true, // Assuming all parameters are required; adjust as needed
                description: `The ${name || 'parameter'} of type ${type}.`, // Generic description
                schema: { type: this.mapApexTypeToJsonType(type || '') }
              };
            });

            metadataList.push({
              name: methodName,
              parameters,
              returnType,
              isAuraEnabled,
              className
            });
          }
        }

        // Reset for the next method
        currentMethodSignature = '';
        isAuraEnabled = false;
      }
    }

    if (metadataList.length === 0) {
      notificationService.showWarningMessage('No methods found in the active file.');
      return;
    }

    return metadataList;
  };

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

  public validateAuraEnabledMethod = (isAuraEnabled: boolean): boolean => {
    return isAuraEnabled;
  };
}
