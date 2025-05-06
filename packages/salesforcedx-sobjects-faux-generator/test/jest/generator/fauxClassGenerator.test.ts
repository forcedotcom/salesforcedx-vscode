/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TOOLS } from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'node:fs';
import { EOL } from 'node:os';
import { join } from 'node:path';
import { SObjectCategory, SObjectRefreshOutput, SOBJECTS_DIR } from '../../../src';
import { FauxClassGenerator } from '../../../src/generator';
import { DeclarationGenerator } from '../../../src/generator/declarationGenerator';
import { INDENT } from '../../../src/generator/fauxClassGenerator';
import { nls } from '../../../src/messages';

jest.mock('../../../src/generator/declarationGenerator');

const declarationGeneratorMocked = jest.mocked(DeclarationGenerator);

describe('FauxClassGenerator Unit Tests.', () => {
  const fakePath = './this/is/a/path';
  let classPath = '';

  const getGenerator = (): FauxClassGenerator => new FauxClassGenerator(SObjectCategory.CUSTOM, 'custom0');

  afterEach(() => {
    if (classPath) {
      try {
        fs.unlinkSync(classPath);
      } catch (e) {
        console.log(e);
      }
      classPath = '';
    }
  });

  it('Should be able to create an instance.', () => {
    const fauxClassGeneratorInst = new FauxClassGenerator(SObjectCategory.STANDARD, fakePath);
    expect(fauxClassGeneratorInst).toBeDefined();
    expect(fauxClassGeneratorInst).toBeInstanceOf(FauxClassGenerator);
    expect(declarationGeneratorMocked).toHaveBeenCalled();
  });

  it('Should not be able to create an instance for all types.', () => {
    expect(() => {
      new FauxClassGenerator(SObjectCategory.ALL, fakePath);
    }).toThrowError(`SObject category cannot be used to generate metadata ${SObjectCategory.ALL}`);
  });

  it('Should generate a faux class with a proper header comment', async () => {
    const fieldsHeader = '{ "name": "Custom__c", "fields": [ ';
    const closeHeader = ' ], "childRelationships": [] }';

    const sobject1 = `${fieldsHeader}${closeHeader}`;

    const sobjectFolder = process.cwd();
    const gen = getGenerator();
    classPath = gen.generateFauxClass(sobjectFolder, JSON.parse(sobject1));
    expect(fs.existsSync(classPath)).toBeTruthy();
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).toContain(nls.localize('class_header_generated_comment'));
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
      expect(expectedFirstComment).toEqual(parseFirstComment);
    });

    it('Should parse a complex field inline comment', async () => {
      let secondComment = `/******** More complex **************/${EOL}`;
      secondComment += `**************this is a test **************${EOL}`;
      secondComment += '/**************/';
      let expectedSecondComment = `${INDENT}/*  More complex ${EOL}`;
      expectedSecondComment += `**************this is a test **************${EOL}`;
      expectedSecondComment += `${EOL}${INDENT}*/${EOL}`;
      const parseSecondComment = FauxClassGenerator.commentToString(secondComment);
      expect(expectedSecondComment).toEqual(parseSecondComment);
    });

    it('Should parse a comment with spaces.', () => {
      const thirdComment = 'Bring a sweater and/or jacket';
      let expectedThirdComment = `${INDENT}/* ${thirdComment}`;
      expectedThirdComment += `${EOL}${INDENT}*/${EOL}`;
      const parseThirdComment = FauxClassGenerator.commentToString(thirdComment);
      expect(expectedThirdComment).toEqual(parseThirdComment);
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
        .mockReturnValue(true);
      generateFauxClassMock = jest.spyOn(FauxClassGenerator.prototype, 'generateFauxClass');
      getStandardMock = jest.fn();
      getCustomMock = jest.fn();
      fakeOutput = {
        sfdxPath: fakeSfdxPath,
        getStandard: getStandardMock,
        getCustom: getCustomMock
      };
    });

    it('Should throw if output folder can not be reset.', () => {
      resetOutputFolderMock.mockReturnValue(false);
      const expectedError = `No output folder available ${expectedFolderPath}.  Please create this folder and refresh again`;
      const fauxClassGeneratorInst = new FauxClassGenerator(SObjectCategory.STANDARD, fakePath);
      expect(() => {
        fauxClassGeneratorInst.generate(fakeOutput as SObjectRefreshOutput);
      }).toThrowError(expectedError);
    });

    it('Should process standard sobjects.', () => {
      const fakeSObject = { name: 'fake' };
      const fakeSobjectDef = 'look at me the sobject';
      getStandardMock.mockReturnValue([fakeSObject]);
      (declarationGeneratorMocked.prototype.generateSObjectDefinition as any).mockReturnValue(fakeSobjectDef as any);
      generateFauxClassMock.mockReturnValue('hooray');

      const fauxClassGeneratorInst = new FauxClassGenerator(SObjectCategory.STANDARD, fakePath);
      fauxClassGeneratorInst.generate(fakeOutput as SObjectRefreshOutput);

      expect(fakeOutput.getStandard).toHaveBeenCalled();
      expect(fakeOutput.getCustom).not.toHaveBeenCalled();
      expect(declarationGeneratorMocked.prototype.generateSObjectDefinition).toHaveBeenCalledWith(fakeSObject);
      expect(generateFauxClassMock).toHaveBeenCalledWith(expectedFolderPath, fakeSobjectDef);
    });

    it('Should process custom sobjects.', () => {
      const fakeSObject = { name: 'fake' };
      const fakeSobjectDef = 'look at me the sobject';
      getCustomMock.mockReturnValue([fakeSObject]);
      (declarationGeneratorMocked.prototype.generateSObjectDefinition as any).mockReturnValue(fakeSobjectDef as any);
      generateFauxClassMock.mockReturnValue('hooray');

      const fauxClassGeneratorInst = new FauxClassGenerator(SObjectCategory.CUSTOM, fakePath);
      fauxClassGeneratorInst.generate(fakeOutput as SObjectRefreshOutput);

      expect(fakeOutput.getStandard).not.toHaveBeenCalled();
      expect(fakeOutput.getCustom).toHaveBeenCalled();
      expect(declarationGeneratorMocked.prototype.generateSObjectDefinition).toHaveBeenCalledWith(fakeSObject);
      expect(generateFauxClassMock).toHaveBeenCalledWith(expectedFolderPath, fakeSobjectDef);
    });
  });
});
