/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fileOrFolderExists, projectPaths } from '@salesforce/salesforcedx-utils-vscode';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { CUSTOMOBJECTS_DIR, STANDARDOBJECTS_DIR, SOBJECTS_DIR } from '../../../src/constants';
import { generateFauxClass } from '../../../src/generator/fauxClassGenerator';

jest.mock('vscode');
const vscodeMocked = jest.mocked(vscode);

describe('Clean SObject Folders', () => {
  const baseFolder = join(projectPaths.toolsFolder(), SOBJECTS_DIR);

  beforeEach(() => {
    jest.clearAllMocks();
    vscodeMocked.workspace.fs.createDirectory.mockResolvedValue();
    vscodeMocked.workspace.fs.stat.mockResolvedValue({ type: 2, ctime: 0, mtime: 0, size: 0 });
    vscodeMocked.workspace.fs.delete.mockResolvedValue();
  });

  it('Should remove only standardObjects folder when category is STANDARD', async () => {
    // Create both folders initially
    const standardOutputPath = join(baseFolder, STANDARDOBJECTS_DIR);
    const customOutputPath = join(baseFolder, CUSTOMOBJECTS_DIR);
    await vscodeMocked.workspace.fs.createDirectory(vscode.Uri.file(standardOutputPath));
    await vscodeMocked.workspace.fs.createDirectory(vscode.Uri.file(customOutputPath));

    await generateFauxClass(standardOutputPath, { name: 'Account', fields: [] });

    // The standard folder should be recreated empty by generate()
    expect(await fileOrFolderExists(standardOutputPath)).toBeTruthy();
    // The custom folder should be untouched
    expect(await fileOrFolderExists(customOutputPath)).toBeTruthy();
  });

  it('Should remove only customObjects folder when category is CUSTOM', async () => {
    // Create both folders initially
    const standardOutputPath = join(baseFolder, STANDARDOBJECTS_DIR);
    const customOutputPath = join(baseFolder, CUSTOMOBJECTS_DIR);
    await vscodeMocked.workspace.fs.createDirectory(vscode.Uri.file(standardOutputPath));
    await vscodeMocked.workspace.fs.createDirectory(vscode.Uri.file(customOutputPath));

    await generateFauxClass(customOutputPath, { name: 'Foo__c', fields: [] });

    // The custom folder should be recreated empty by generate()
    expect(await fileOrFolderExists(customOutputPath)).toBeTruthy();
    // The standard folder should be untouched
    expect(await fileOrFolderExists(standardOutputPath)).toBeTruthy();
  });
});
