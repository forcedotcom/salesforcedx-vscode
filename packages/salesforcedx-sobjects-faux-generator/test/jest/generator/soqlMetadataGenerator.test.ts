/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import { join } from 'node:path';
import { CUSTOMOBJECTS_DIR, SOQLMETADATA_DIR, STANDARDOBJECTS_DIR } from '../../../src/constants';
import { SObjectShortDescription } from '../../../src/describe';
import { SOQLMetadataGenerator } from '../../../src/generator/soqlMetadataGenerator';
import { MinObjectRetriever } from '../../../src/retriever';
import { SObject, SObjectCategory, SObjectRefreshOutput } from '../../../src/types';

describe('SOQL metadata files generator', () => {
  const sfdxPath = process.cwd();
  const soqlMetadataFolder = join(sfdxPath, 'tools', SOQLMETADATA_DIR);
  const standardFolder = join(soqlMetadataFolder, STANDARDOBJECTS_DIR);
  const customFolder = join(soqlMetadataFolder, CUSTOMOBJECTS_DIR);

  const cleanupMetadata = () => {
    if (fs.existsSync(soqlMetadataFolder)) {
      fs.rmSync(soqlMetadataFolder, { recursive: true, force: true });
    }
  };

  beforeEach(() => {
    cleanupMetadata();
    fs.mkdirSync(soqlMetadataFolder, { recursive: true });
    fs.mkdirSync(standardFolder, { recursive: true });
    fs.mkdirSync(customFolder, { recursive: true });
  });

  afterAll(() => {
    cleanupMetadata();
  });

  it('Should generate metadata files from "minimal" object set', async () => {
    const MINS_SOBJECTS_COUNT = 19;
    const retrieve = new MinObjectRetriever();
    const output = new TestSObjectRefreshOutput(sfdxPath);
    await retrieve.retrieve(output);
    expect(output.getTypeNames()).toHaveLength(MINS_SOBJECTS_COUNT);

    const gen = new SOQLMetadataGenerator(SObjectCategory.STANDARD);
    await gen.generate(output);

    const accountFile = fs.readFileSync(join(standardFolder, 'Account.json'));
    const accountSObject = JSON.parse(accountFile.toString());

    expect(accountSObject.name).toBe('Account');
    expect(accountSObject.label).toBe('Account');
    expect(accountSObject.fields[0].name).toBe('Id');
    expect(accountSObject.fields[0].label).toBe('Account ID');
    const standardFiles = fs.readdirSync(standardFolder);
    expect(standardFiles).toHaveLength(MINS_SOBJECTS_COUNT);
  });

  it('Should temporarily remove standardObjects folder when category is STANDARD', async () => {
    const gen = new SOQLMetadataGenerator(SObjectCategory.STANDARD);
    const output = new TestSObjectRefreshOutput(sfdxPath);
    await gen.generate(output);
    expect(fs.existsSync(customFolder)).toBe(true);
    expect(fs.existsSync(standardFolder)).toBe(true);
  });

  it('Should temporarily remove customObjects folder when category is CUSTOM', async () => {
    const gen = new SOQLMetadataGenerator(SObjectCategory.CUSTOM);
    const output = new TestSObjectRefreshOutput(sfdxPath);
    await gen.generate(output);
    expect(fs.existsSync(customFolder)).toBe(true);
    expect(fs.existsSync(standardFolder)).toBe(true);
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
