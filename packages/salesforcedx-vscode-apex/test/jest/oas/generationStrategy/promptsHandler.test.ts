/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs';
import { ensurePromptsExist, PROMPTS_DIR, PROMPTS_FILE } from '../../../../src/oas/generationStrategy/promptsHandler';

jest.mock('node:fs');

describe('ensurePromptsExist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create the prompts directory and file if they do not exist', () => {
    (fs.existsSync as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(false);

    ensurePromptsExist();

    expect(fs.mkdirSync).toHaveBeenCalledWith(PROMPTS_DIR, { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(PROMPTS_FILE, expect.any(String), 'utf8');
  });

  it('should not create the prompts directory or file if they already exist', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    ensurePromptsExist();

    expect(fs.mkdirSync).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});
