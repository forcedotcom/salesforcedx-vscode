/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { ApexActionController } from './apexActionController';
import { MetadataOrchestrator } from './metadataOrchestrator';

const metadataOrchestrator = new MetadataOrchestrator();
const controller = new ApexActionController(metadataOrchestrator);

/**
 * Creates an Apex Action from the method at the current cursor position.
 */
export const createApexActionFromMethod = async (): Promise<void> => {
  // Call Controller
  await controller.createApexAction(false);
};

/**
 * Creates Apex Actions from all methods in the current class.
 */
export const createApexActionFromClass = async (sourceUri: vscode.Uri | undefined): Promise<void> => {
  // Call Controller
  await controller.createApexAction(true, sourceUri);
};