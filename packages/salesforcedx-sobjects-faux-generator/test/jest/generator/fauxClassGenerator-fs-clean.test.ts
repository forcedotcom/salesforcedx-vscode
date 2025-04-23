/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TOOLS } from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { SOBJECTS_DIR, CUSTOMOBJECTS_DIR, STANDARDOBJECTS_DIR, SObjectCategory } from '../../../src';
import { FauxClassGenerator } from '../../../src/generator';
import { SObjectRefreshOutput } from '../../../src/types';

describe('Clean SObject Folders', () => {
  const sfdxPath = process.cwd();
  const baseFolder = join(sfdxPath, TOOLS, SOBJECTS_DIR);

  beforeEach(() => {
    fs.mkdirSync(baseFolder, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(baseFolder, { recursive: true, force: true });
  });

  it('Should remove standardObjects folder when category is STANDARD', () => {
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
    fs.mkdirSync(standardOutputPath, { recursive: true });
    fs.mkdirSync(customOutputPath, { recursive: true });

    gen.generate(output);

    // The standard folder should be recreated empty by generate()
    expect(fs.existsSync(standardOutputPath)).toBeTruthy();
    // The custom folder should be untouched
    expect(fs.existsSync(customOutputPath)).toBeTruthy();
  });

  it('Should remove customObjects folder when category is CUSTOM', () => {
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
    fs.mkdirSync(standardOutputPath, { recursive: true });
    fs.mkdirSync(customOutputPath, { recursive: true });

    gen.generate(output);

    // The custom folder should be recreated empty by generate()
    expect(fs.existsSync(customOutputPath)).toBeTruthy();
    // The standard folder should be untouched
    expect(fs.existsSync(standardOutputPath)).toBeTruthy();
  });
});
