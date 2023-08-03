/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as fs from 'fs/promises';
import * as os from 'os';
import { userInfo } from 'os';
import { join } from 'path';
import {
  CUSTOMOBJECTS_DIR,
  SOQLMETADATA_DIR,
  STANDARDOBJECTS_DIR
} from '../../src/constants';
import { SObjectShortDescription } from '../../src/describe';
import { SOQLMetadataGenerator } from '../../src/generator/soqlMetadataGenerator';
import { MinObjectRetriever } from '../../src/retriever';
import {
  SObject,
  SObjectCategory,
  SObjectRefreshOutput
} from '../../src/types';
import { exists } from '../../src/utils/fsUtils';

describe('SOQL metadata files generator', () => {
  const sfdxPath = os.tmpdir();
  const soqlMetadataFolder = join(sfdxPath, 'tools', SOQLMETADATA_DIR);
  const standardFolder = join(soqlMetadataFolder, STANDARDOBJECTS_DIR);
  const customFolder = join(soqlMetadataFolder, CUSTOMOBJECTS_DIR);

  async function cleanupMetadata() {
    if (await exists(soqlMetadataFolder)) {
      await fs.rm(soqlMetadataFolder, { recursive: true, force: true });
    }
  }

  const username = userInfo().username;

  beforeEach(async () => {
    await cleanupMetadata();
    await fs.mkdir(standardFolder, { recursive: true });
    await fs.mkdir(customFolder, { recursive: true });
  });

  afterAll(async () => {
    await cleanupMetadata();
  });

  it('Should generate metadata files from "minimal" object set', async () => {
    const MINS_SOBJECTS_COUNT = 16;
    const retrieve = new MinObjectRetriever();
    const output = new TestSObjectRefreshOutput(sfdxPath);
    await retrieve.retrieve(output);
    expect(output.getTypeNames().length).to.equal(MINS_SOBJECTS_COUNT);

    const gen = new SOQLMetadataGenerator(SObjectCategory.STANDARD);
    await gen.generate(output);

    const accountFile = await fs.readFile(join(standardFolder, 'Account.json'));
    const accountSObject = JSON.parse(accountFile.toString());

    expect(accountSObject.name).to.equal('Account');
    expect(accountSObject.label).to.equal('Account');
    expect(accountSObject.fields[0].name).to.equal('Id');
    expect(accountSObject.fields[0].label).to.equal('Account ID');
    const standardFiles = await fs.readdir(standardFolder);
    expect(standardFiles.length).to.equal(MINS_SOBJECTS_COUNT);
  });

  it('Should remove standardObjects folder when category is STANDARD', async () => {
    const gen = new SOQLMetadataGenerator(SObjectCategory.STANDARD);
    const output = new TestSObjectRefreshOutput(sfdxPath);
    await gen.generate(output);
    expect(await exists(customFolder));
    expect(!(await exists(standardFolder)));
  });

  it('Should remove customObjects folder when category is CUSTOM', async () => {
    const gen = new SOQLMetadataGenerator(SObjectCategory.CUSTOM);
    const output = new TestSObjectRefreshOutput(sfdxPath);
    await gen.generate(output);
    expect(!(await exists(customFolder)));
    expect(await exists(standardFolder));
  });
});

class TestSObjectRefreshOutput implements SObjectRefreshOutput {
  private typeNames: SObjectShortDescription[] = [];
  private standard: SObject[] = [];
  private custom: SObject[] = [];
  public error: { message?: string; stack?: string } = {};

  public constructor(public sfdxPath: string) {}
  public hasCustom(): boolean {
    return this.custom.length > 0;
  }
  public hasStandard(): boolean {
    return this.standard.length > 0;
  }
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
