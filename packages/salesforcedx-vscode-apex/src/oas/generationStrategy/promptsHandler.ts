/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import { stringify } from 'yaml';
import { sourcePrompts } from './prompts';

export const PROMPTS_DIR = path.join('.sfdx', 'oas_prompts');
export const PROMPTS_FILE = path.join(PROMPTS_DIR, 'prompts.yaml');

const getPromptsFromSource = (): Record<string, any> => {
  return sourcePrompts;
};

export const ensurePromptsExist = (): void => {
  if (!fs.existsSync(PROMPTS_DIR)) {
    fs.mkdirSync(PROMPTS_DIR, { recursive: true });
  }

  if (!fs.existsSync(PROMPTS_FILE)) {
    const extractedPrompts = getPromptsFromSource();
    fs.writeFileSync(PROMPTS_FILE, stringify(extractedPrompts), 'utf8');
  }
};
