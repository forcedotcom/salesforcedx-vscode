/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { notificationService } from '@salesforce/salesforcedx-utils-vscode';
import { readFileSync } from 'fs';
import * as vscode from 'vscode';
import { ApexActionController } from './apexActionController';
import { MetadataOrchestrator } from './metadataOrchestrator';

const metadataOrchestrator = new MetadataOrchestrator();
const controller = new ApexActionController(metadataOrchestrator);

const validateAuraEnabledMethod = async (
  filePath: string,
  cursorPosition: vscode.Position,
  selectedMethod: string
): Promise<void> => {
  const lineNumber = cursorPosition.line;
  // Read the content of the Apex class file
  const fileContent = readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n');

  // Start from the current line and search upward for the method declaration
  for (let i = lineNumber; i >= 0; i--) {
    const line = lines[i].trim();

    if (line.includes(selectedMethod)) continue;
    // Check if the line contains @AuraEnabled
    if (line.includes('@AuraEnabled')) {
      return;
    }

    // Check if the line contains a method declaration (regex matches methods)
    const methodRegex = /\b(public|private|protected|global)\s+(static\s+)?[\w<>\[\]]+\s+\w+\s*\(/;
    if (methodRegex.test(line)) {
      notificationService.showWarningMessage(`The method "${selectedMethod}" is NOT annotated with @AuraEnabled.`);
      throw Error(`The method "${selectedMethod}" is NOT annotated with @AuraEnabled.`);
    }
  }
};

export const createApexActionFromMethod = async (methodIdentifier: any): Promise<void> => {
  // Step 1: Prompt User to Select a Method
  // const selectedMethod = await controller.listApexMethods();
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    notificationService.showErrorMessage('No active editor detected');
    throw Error('No active editor detected');
  }

  const document = editor.document;
  let selectedMethod;
  const cursorPosition = editor.selection.active; // Get cursor position
  const lineText = document.lineAt(cursorPosition.line).text.trim(); // Get the line content

  // Regular expression to match a method declaration and extract its name
  const methodRegex = /\b(public|private|protected|global)\s+(static\s+)?[\w<>\[\]]+\s+(\w+)\s*\(/;

  const match = methodRegex.exec(lineText);
  if (match) {
    selectedMethod = match[3]; // The third capture group is the method name
  }

  if (!selectedMethod) {
    notificationService.showErrorMessage('No method selected');
    return;
  }

  const filePath = methodIdentifier.path;
  await validateAuraEnabledMethod(filePath, cursorPosition, selectedMethod);

  // Step 2: Call Controller
  await controller.createApexActionFromMethod(selectedMethod);
};
