/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'node:path';
import * as vscode from 'vscode';
import { folderExists, readFile } from '../../../src';
import { CUSTOMOBJECTS_DIR, SOQLMETADATA_DIR, STANDARDOBJECTS_DIR } from '../../../src/constants';
import { SObjectShortDescription } from '../../../src/describe';
import { SOQLMetadataGenerator } from '../../../src/generator/soqlMetadataGenerator';
import { MinObjectRetriever } from '../../../src/retriever';
import { SObject, SObjectCategory, SObjectRefreshOutput } from '../../../src/types';

jest.mock('vscode');
const vscodeMocked = jest.mocked(vscode);

describe('SOQL metadata files generator', () => {
  const sfdxPath = process.cwd();
  const soqlMetadataFolder = join(sfdxPath, 'tools', SOQLMETADATA_DIR);
  const standardFolder = join(soqlMetadataFolder, STANDARDOBJECTS_DIR);
  const customFolder = join(soqlMetadataFolder, CUSTOMOBJECTS_DIR);

  beforeEach(() => {
    jest.clearAllMocks();
    vscodeMocked.workspace.fs.writeFile.mockResolvedValue();
    vscodeMocked.workspace.fs.stat.mockResolvedValue({ type: 2, ctime: 0, mtime: 0, size: 0 });
    vscodeMocked.workspace.fs.createDirectory.mockResolvedValue();
    vscodeMocked.workspace.fs.delete.mockResolvedValue();
    vscodeMocked.workspace.fs.readFile.mockResolvedValue(
      Buffer.from(
        JSON.stringify({
          name: 'Account',
          label: 'Account',
          fields: [{ name: 'Id', label: 'Account ID' }]
        })
      )
    );
  });

  it('Should generate metadata files from "minimal" object set', async () => {
    const MINS_SOBJECTS_COUNT = 19;
    const retrieve = new MinObjectRetriever();
    const output = new TestSObjectRefreshOutput(sfdxPath);
    await retrieve.retrieve(output);
    expect(output.getTypeNames()).toHaveLength(MINS_SOBJECTS_COUNT);

    const gen = new SOQLMetadataGenerator(SObjectCategory.STANDARD);
    await gen.generate(output);

    const accountFile = await readFile(join(standardFolder, 'Account.json'));
    const accountSObject = JSON.parse(accountFile.toString());

    expect(accountSObject.name).toBe('Account');
    expect(accountSObject.label).toBe('Account');
    expect(accountSObject.fields[0].name).toBe('Id');
    expect(accountSObject.fields[0].label).toBe('Account ID');
  });

  it('Should temporarily remove standardObjects folder when category is STANDARD', async () => {
    const gen = new SOQLMetadataGenerator(SObjectCategory.STANDARD);
    const output = new TestSObjectRefreshOutput(sfdxPath);
    await gen.generate(output);
    expect(await folderExists(customFolder)).toBe(true);
    expect(await folderExists(standardFolder)).toBe(true);
  });

  it('Should temporarily remove customObjects folder when category is CUSTOM', async () => {
    const gen = new SOQLMetadataGenerator(SObjectCategory.CUSTOM);
    const output = new TestSObjectRefreshOutput(sfdxPath);
    await gen.generate(output);
    expect(await folderExists(customFolder)).toBe(true);
    expect(await folderExists(standardFolder)).toBe(true);
  });
});

class TestSObjectRefreshOutput implements SObjectRefreshOutput {
  private typeNames: SObjectShortDescription[] = [];
  private standard: SObject[] = [];
  private custom: SObject[] = [];
  public error: { message?: string; stack?: string } = {};

  public constructor(public sfdxPath: string) {}

  public addTypeNames(sobjShort: SObjectShortDescription[]): void {
    this.typeNames.push(...sobjShort);
  }
  public getTypeNames(): SObjectShortDescription[] {
    return this.typeNames;
  }

  public addStandard(sobjs: SObject[]): void {
    this.standard.push(...sobjs);
  }
  public getStandard(): SObject[] {
    return this.standard;
  }
  public addCustom(sobjs: SObject[]): void {
    this.custom.push(...sobjs);
  }
  public getCustom(): SObject[] {
    return this.custom;
  }
  public setError(message: string, stack?: string | undefined): void {
    this.error = { message, stack };
  }
}
