/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse, stringify } from 'yaml';
import { Prompts } from '../schemas';
import { sourcePrompts } from './prompts';

export const PROMPTS_DIR = path.join('.sfdx', 'oas_prompts');
export const PROMPTS_FILE = path.join(PROMPTS_DIR, 'prompts.yaml');

export const getPromptsFromSource = (): Record<string, any> => sourcePrompts;

export const ensurePromptsExist = (): void => {
  if (!fs.existsSync(PROMPTS_DIR)) {
    fs.mkdirSync(PROMPTS_DIR, { recursive: true });
  }

  if (!fs.existsSync(PROMPTS_FILE)) {
    const extractedPrompts = getPromptsFromSource();
    fs.writeFileSync(PROMPTS_FILE, stringify(extractedPrompts), 'utf8');
  }
};

export const getPrompts = (): Prompts => {
  ensurePromptsExist();
  const data = fs.readFileSync(PROMPTS_FILE, 'utf8');
  return parse(data) as Prompts;
};

// For future use cases (if needed)
export const updatePrompts = (newPrompts: Record<string, any>): void => {
  fs.writeFileSync(PROMPTS_FILE, stringify(newPrompts), 'utf8');
};
