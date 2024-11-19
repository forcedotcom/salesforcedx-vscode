/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ApexActionController } from './apexActionController';
import { MetadataOrchestrator } from './metadataOrchestrator';

const metadataOrchestrator = new MetadataOrchestrator();
const controller = new ApexActionController(metadataOrchestrator);

export const createApexActionFromMethod = async (): Promise<void> => {
  // Call Controller
  await controller.createApexActionFromMethod();
};

export const createApexActionFromClass = async (): Promise<void> => {
  // Call Controller
  await controller.createApexActionFromClass();
};
