/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TOOLS } from '@salesforce/salesforcedx-utils-vscode';
import { EOL } from 'node:os';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { SObjectRefreshOutput, SOBJECTS_DIR } from '../../../src';
import { DeclarationGenerator } from '../../../src/generator/declarationGenerator';
import { FauxClassGenerator, INDENT } from '../../../src/generator/fauxClassGenerator';
import { nls } from '../../../src/messages';

jest.mock('../../../src/generator/declarationGenerator');
jest.mock('../../../src/messages');

const vscodeMocked = jest.mocked(vscode);
const nlsMocked = jest.mocked(nls);

const declarationGeneratorMocked = jest.mocked(DeclarationGenerator);

describe('FauxClassGenerator Unit Tests.', () => {
  const fakePath = './this/is/a/path';
  let typePath = '';

  const getGenerator = (): FauxClassGenerator => new FauxClassGenerator('CUSTOM', 'custom0');

  beforeEach(() => {
    jest.clearAllMocks();
    vscodeMocked.workspace.fs.writeFile.mockResolvedValue(undefined);
    vscodeMocked.workspace.fs.stat.mockResolvedValue({ type: 1, ctime: 0, mtime: 0, size: 0, permissions: 1 });
    vscodeMocked.workspace.fs.createDirectory.mockResolvedValue(undefined);
    vscodeMocked.workspace.fs.delete.mockResolvedValue(undefined);

    // Mock nls.localize to return the expected error message
    nlsMocked.localize.mockImplementation((key: string, ...args: string[]) => {
      if (key === 'no_sobject_output_folder_text') {
        return `No output folder available ${args[0]}.  Please create this folder and refresh again`;
      }
      if (key === 'unsupported_sobject_category') {
        return `SObject category cannot be used to generate metadata ${args[0]}`;
      }
      return key;
    });

    // Mock Uri.file to return a proper URI object
    vscodeMocked.Uri.file.mockImplementation((path: string) => ({
      fsPath: path,
      scheme: 'file',
      path,
      authority: '',
      query: '',
      fragment: '',
      with: jest.fn(),
      toString: () => `file://${path}`,
      toJSON: () => ({ scheme: 'file', path })
    }));
  });

  afterEach(() => {
    if (typePath) {
      try {
        vscodeMocked.workspace.fs.delete(vscode.Uri.file(typePath));
      } catch (e) {
        console.log(e);
      }
      typePath = '';
    }
  });

  it('Should be able to create an instance.', () => {
    const fauxClassGeneratorInst = new FauxClassGenerator('STANDARD', fakePath);
    expect(fauxClassGeneratorInst).toBeDefined();
    expect(fauxClassGeneratorInst).toBeInstanceOf(FauxClassGenerator);
    expect(declarationGeneratorMocked).toHaveBeenCalled();
  });

  it('Should not be able to create an instance for all types.', () => {
    expect(() => {
      new FauxClassGenerator('ALL', fakePath);
    }).toThrowError('SObject category cannot be used to generate metadata ALL');
  });

  it('Should generate a faux class with a proper header comment', async () => {
    const fieldsHeader = '{ "name": "Custom__c", "fields": [ ';
    const closeHeader = ' ], "childRelationships": [] }';

    const sobject1 = `${fieldsHeader}${closeHeader}`;

    const sobjectFolder = process.cwd();
    const gen = getGenerator();
    await gen.generateFauxClass(sobjectFolder, JSON.parse(sobject1));

    expect(vscodeMocked.workspace.fs.stat).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        path: sobjectFolder,
        scheme: 'file'
      })
    );
    expect(vscodeMocked.workspace.fs.writeFile).toHaveBeenCalled();

    const writeFileCall = vscodeMocked.workspace.fs.writeFile.mock.calls[0];
    const fileContent = Buffer.from(writeFileCall[1]).toString('utf8');
    expect(fileContent).toContain(nls.localize('class_header_generated_comment'));
  });

  describe('commentToString()', () => {
    it('Should return empty string for empty input', () => {
      const empty = '';
      const actual = FauxClassGenerator.commentToString(empty);
      expect(actual).toEqual(empty);
    });

    it('Should parse a simple field inline comment', async () => {
      let firstComment = `/* Please add a unique name${EOL}`;
      firstComment += `    */${EOL}`;
      let expectedFirstComment = `${INDENT}/*  Please add a unique name${EOL}`;
      expectedFirstComment += `    ${EOL}${EOL}${INDENT}*/${EOL}`;
      const parseFirstComment = FauxClassGenerator.commentToString(firstComment);
      expect(parseFirstComment).toEqual(expectedFirstComment);
    });

    it('Should parse a complex field inline comment', async () => {
      let secondComment = `/******** More complex **************/${EOL}`;
      secondComment += `**************this is a test **************${EOL}`;
      secondComment += '/**************/';
      let expectedSecondComment = `${INDENT}/*  More complex ${EOL}`;
      expectedSecondComment += `**************this is a test **************${EOL}`;
      expectedSecondComment += `${EOL}${INDENT}*/${EOL}`;
      const parseSecondComment = FauxClassGenerator.commentToString(secondComment);
      expect(parseSecondComment).toEqual(expectedSecondComment);
    });

    it('Should parse a comment with spaces.', () => {
      const thirdComment = 'Bring a sweater and/or jacket';
      const expectedThirdComment = `${INDENT}/* Bring a sweater and/or jacket${EOL}${INDENT}*/${EOL}`;
      const parseThirdComment = FauxClassGenerator.commentToString(thirdComment);
      expect(parseThirdComment).toEqual(expectedThirdComment);
    });
  });

  describe('generate()', () => {
    const fakeSfdxPath = '.totallyFake';
    const expectedFolderPath = join(String(fakeSfdxPath), TOOLS, SOBJECTS_DIR, fakePath);

    let fakeOutput: any;
    let resetOutputFolderMock: jest.SpyInstance;
    let getCustomMock: jest.SpyInstance;
    let getStandardMock: jest.SpyInstance;
    let generateFauxClassMock: jest.SpyInstance;

    beforeEach(() => {
      resetOutputFolderMock = jest
        .spyOn(FauxClassGenerator.prototype as any, 'resetOutputFolder')
        .mockResolvedValue(true);
      generateFauxClassMock = jest.spyOn(FauxClassGenerator.prototype, 'generateFauxClass');
      getStandardMock = jest.fn();
      getCustomMock = jest.fn();
      fakeOutput = {
        sfdxPath: fakeSfdxPath,
        getStandard: getStandardMock,
        getCustom: getCustomMock
      };
    });

    it('Should throw if output folder can not be reset.', async () => {
      resetOutputFolderMock.mockResolvedValue(false);
      getStandardMock.mockReturnValue([]);
      getCustomMock.mockReturnValue([]);
      const expectedError = nls.localize('no_sobject_output_folder_text', expectedFolderPath);
      const fauxClassGeneratorInst = new FauxClassGenerator('STANDARD', fakePath);

      try {
        await fauxClassGeneratorInst.generate(fakeOutput as SObjectRefreshOutput);
      } catch (error) {
        expect(error).toEqual(expectedError);
      }
    });

    it('Should process standard sobjects.', async () => {
      const fakeSObject = { name: 'fake' };
      const fakeSobjectDef = 'look at me the sobject';
      getStandardMock.mockReturnValue([fakeSObject]);
      (declarationGeneratorMocked.prototype.generateSObjectDefinition as any).mockReturnValue(fakeSobjectDef as any);
      generateFauxClassMock.mockResolvedValue('hooray');

      const fauxClassGeneratorInst = new FauxClassGenerator('STANDARD', fakePath);
      await fauxClassGeneratorInst.generate(fakeOutput as SObjectRefreshOutput);

      expect(fakeOutput.getStandard).toHaveBeenCalled();
      expect(fakeOutput.getCustom).not.toHaveBeenCalled();
      expect(declarationGeneratorMocked.prototype.generateSObjectDefinition).toHaveBeenCalledWith(fakeSObject);
      expect(generateFauxClassMock).toHaveBeenCalledWith(expectedFolderPath, fakeSobjectDef);
    });

    it('Should process custom sobjects.', async () => {
      const fakeSObject = { name: 'fake' };
      const fakeSobjectDef = 'look at me the sobject';
      getCustomMock.mockReturnValue([fakeSObject]);
      (declarationGeneratorMocked.prototype.generateSObjectDefinition as any).mockReturnValue(fakeSobjectDef as any);
      generateFauxClassMock.mockResolvedValue('hooray');

      const fauxClassGeneratorInst = new FauxClassGenerator('CUSTOM', fakePath);
      await fauxClassGeneratorInst.generate(fakeOutput as SObjectRefreshOutput);

      expect(fakeOutput.getStandard).not.toHaveBeenCalled();
      expect(fakeOutput.getCustom).toHaveBeenCalled();
      expect(declarationGeneratorMocked.prototype.generateSObjectDefinition).toHaveBeenCalledWith(fakeSObject);
      expect(generateFauxClassMock).toHaveBeenCalledWith(expectedFolderPath, fakeSobjectDef);
    });
  });
});
