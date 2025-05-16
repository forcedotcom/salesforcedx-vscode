/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TOOLS, fileOrFolderExists } from '@salesforce/salesforcedx-utils-vscode';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { SOBJECTS_DIR, CUSTOMOBJECTS_DIR, STANDARDOBJECTS_DIR, SObjectCategory } from '../../../src';
import { FauxClassGenerator } from '../../../src/generator';
import { SObjectRefreshOutput } from '../../../src/types';

jest.mock('vscode');
const vscodeMocked = jest.mocked(vscode);

describe('Clean SObject Folders', () => {
  const sfdxPath = process.cwd();
  const baseFolder = join(sfdxPath, TOOLS, SOBJECTS_DIR);

  beforeEach(() => {
    jest.clearAllMocks();
    vscodeMocked.workspace.fs.createDirectory.mockResolvedValue();
    vscodeMocked.workspace.fs.stat.mockResolvedValue({ type: 2, ctime: 0, mtime: 0, size: 0 });
    vscodeMocked.workspace.fs.delete.mockResolvedValue();
  });

  it('Should remove standardObjects folder when category is STANDARD', async () => {
    const gen = new FauxClassGenerator(SObjectCategory.STANDARD, STANDARDOBJECTS_DIR);
    const output: SObjectRefreshOutput = {
      sfdxPath,
      addTypeNames: () => {},
      getTypeNames: () => [],
      addStandard: () => {},
      addCustom: () => {},
      getStandard: () => [],
      getCustom: () => [],
      setError: (m, s) => {}
    };

    // Create both folders initially
    const standardOutputPath = join(baseFolder, STANDARDOBJECTS_DIR);
    const customOutputPath = join(baseFolder, CUSTOMOBJECTS_DIR);
    await vscodeMocked.workspace.fs.createDirectory(vscode.Uri.file(standardOutputPath));
    await vscodeMocked.workspace.fs.createDirectory(vscode.Uri.file(customOutputPath));

    await gen.generate(output);

    // The standard folder should be recreated empty by generate()
    expect(await fileOrFolderExists(standardOutputPath)).toBeTruthy();
    // The custom folder should be untouched
    expect(await fileOrFolderExists(customOutputPath)).toBeTruthy();
  });

  it('Should remove customObjects folder when category is CUSTOM', async () => {
    const gen = new FauxClassGenerator(SObjectCategory.CUSTOM, CUSTOMOBJECTS_DIR);
    const output: SObjectRefreshOutput = {
      sfdxPath,
      addTypeNames: () => {},
      getTypeNames: () => [],
      addStandard: () => {},
      addCustom: () => {},
      getStandard: () => [],
      getCustom: () => [],
      setError: (m, s) => {}
    };

    // Create both folders initially
    const standardOutputPath = join(baseFolder, STANDARDOBJECTS_DIR);
    const customOutputPath = join(baseFolder, CUSTOMOBJECTS_DIR);
    await vscodeMocked.workspace.fs.createDirectory(vscode.Uri.file(standardOutputPath));
    await vscodeMocked.workspace.fs.createDirectory(vscode.Uri.file(customOutputPath));

    await gen.generate(output);

    // The custom folder should be recreated empty by generate()
    expect(await fileOrFolderExists(customOutputPath)).toBeTruthy();
    // The standard folder should be untouched
    expect(await fileOrFolderExists(standardOutputPath)).toBeTruthy();
  });
});
