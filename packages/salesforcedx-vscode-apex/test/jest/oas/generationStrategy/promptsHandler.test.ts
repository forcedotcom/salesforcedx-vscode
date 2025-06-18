/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { ensurePromptsExist, PROMPTS_DIR, PROMPTS_FILE } from '../../../../src/oas/generationStrategy/promptsHandler';

describe('ensurePromptsExist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create the prompts directory and file if they do not exist', async () => {
    jest
      .spyOn(vscode.workspace.fs, 'stat')
      .mockRejectedValueOnce(new Error('Directory not found'))
      .mockRejectedValueOnce(new Error('File not found'));

    await ensurePromptsExist();

    expect(vscode.workspace.fs.createDirectory).toHaveBeenCalledWith(URI.file(PROMPTS_DIR));
    expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(URI.file(PROMPTS_FILE), expect.any(Uint8Array));
  });

  it('should not create the prompts directory or file if they already exist', async () => {
    jest.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ type: vscode.FileType.Directory } as vscode.FileStat);

    await ensurePromptsExist();

    expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
  });
});
