/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { URI } from 'vscode-uri';
import { apexActionController } from '../index';

/**
 * Creates an OpenAPI Document from the method at the current cursor position.
 */
export const createApexActionFromMethod = async (sourceUri: URI | URI[]): Promise<void> => {
  // Call Controller
  await apexActionController.createApexAction(false, sourceUri);
};

/**
 * Creates an OpenAPI Document from all methods in the current class.
 */
export const createApexActionFromClass = async (sourceUri: URI | URI[]): Promise<void> => {
  // Call Controller
  await apexActionController.createApexAction(true, sourceUri);
};
