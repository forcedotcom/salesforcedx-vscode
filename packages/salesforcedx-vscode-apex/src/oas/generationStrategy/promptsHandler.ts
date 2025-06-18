/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fileOrFolderExists, createDirectory, writeFile } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import { stringify } from 'yaml';
import { sourcePrompts } from './prompts';

export const PROMPTS_DIR = path.join('.sfdx', 'oas_prompts');
export const PROMPTS_FILE = path.join(PROMPTS_DIR, 'prompts.yaml');

const getPromptsFromSource = (): Record<string, any> => sourcePrompts;

export const ensurePromptsExist = async (): Promise<void> => {
  await createDirectory(PROMPTS_DIR);

  if (!(await fileOrFolderExists(PROMPTS_FILE))) {
    const extractedPrompts = getPromptsFromSource();
    await writeFile(PROMPTS_FILE, stringify(extractedPrompts));
  }
};
