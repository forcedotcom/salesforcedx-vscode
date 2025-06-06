/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as utils from '@salesforce/salesforcedx-utils-vscode';
import { strict as assert } from 'node:assert';
import { EOL } from 'node:os';
import * as vscode from 'vscode';
import * as declarationGenerator from '../../../src/generator/declarationGenerator';
import {
  commentToString,
  generateFauxClass,
  generateFauxClasses,
  INDENT
} from '../../../src/generator/fauxClassGenerator';
import { nls } from '../../../src/messages';

jest.mock('../../../src/messages');

const vscodeMocked = jest.mocked(vscode);
const nlsMocked = jest.mocked(nls);

describe('FauxClassGenerator Unit Tests.', () => {
  let typePath = '';

  beforeEach(() => {
    jest.clearAllMocks();
    vscodeMocked.workspace.fs.writeFile.mockResolvedValue(undefined);
    vscodeMocked.workspace.fs.createDirectory.mockResolvedValue(undefined);
    vscodeMocked.workspace.fs.delete.mockResolvedValue(undefined);

    // Mock nls.localize to return the expected error message
    nlsMocked.localize.mockImplementation((key, ...args) => {
      if (key === 'no_sobject_output_folder_text') {
        return `No output folder available ${args[0]}.  Please create this folder and refresh again`;
      }
      if (key === 'unsupported_sobject_category') {
        return `SObject category cannot be used to generate metadata ${args[0]}`;
      }
      return key;
    });
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

  it('Should generate a faux class with a proper header comment', async () => {
    const createDirSpy = jest.spyOn(utils, 'createDirectory');
    const fieldsHeader = '{ "name": "Custom__c", "fields": [ ';
    const closeHeader = ' ], "childRelationships": [] }';

    const sobject1 = `${fieldsHeader}${closeHeader}`;

    const sobjectFolder = process.cwd();
    await generateFauxClass(sobjectFolder, JSON.parse(sobject1));
    expect(createDirSpy).toHaveBeenCalledWith(sobjectFolder);
    expect(vscodeMocked.workspace.fs.writeFile).toHaveBeenCalled();

    const writeFileCall = vscodeMocked.workspace.fs.writeFile.mock.calls[0];
    const fileContent = Buffer.from(writeFileCall[1]).toString('utf8');
    expect(fileContent).toContain(nls.localize('class_header_generated_comment'));
  });

  describe('commentToString()', () => {
    it('Should return empty string for empty input', () => {
      const empty = '';
      const actual = commentToString(empty);
      expect(actual).toEqual(empty);
    });

    it('Should parse a simple field inline comment', async () => {
      let firstComment = `/* Please add a unique name${EOL}`;
      firstComment += `    */${EOL}`;
      let expectedFirstComment = `${INDENT}/*  Please add a unique name${EOL}`;
      expectedFirstComment += `    ${EOL}${EOL}${INDENT}*/${EOL}`;
      const parseFirstComment = commentToString(firstComment);
      expect(parseFirstComment).toEqual(expectedFirstComment);
    });

    it('Should parse a complex field inline comment', async () => {
      let secondComment = `/******** More complex **************/${EOL}`;
      secondComment += `**************this is a test **************${EOL}`;
      secondComment += '/**************/';
      let expectedSecondComment = `${INDENT}/*  More complex ${EOL}`;
      expectedSecondComment += `**************this is a test **************${EOL}`;
      expectedSecondComment += `${EOL}${INDENT}*/${EOL}`;
      const parseSecondComment = commentToString(secondComment);
      expect(parseSecondComment).toEqual(expectedSecondComment);
    });

    it('Should parse a comment with spaces.', () => {
      const thirdComment = 'Bring a sweater and/or jacket';
      const expectedThirdComment = `${INDENT}/* Bring a sweater and/or jacket${EOL}${INDENT}*/${EOL}`;
      const parseThirdComment = commentToString(thirdComment);
      expect(parseThirdComment).toEqual(expectedThirdComment);
    });
  });

  describe('generate()', () => {
    let declarationGeneratorSpy: jest.SpyInstance;

    const standardMock = {
      name: 'Account',
      label: 'Account',
      fields: [{ name: 'Id', label: 'Account ID', type: 'string' }]
    };
    const customMock = { name: 'Foo__c', label: 'Foo', fields: [{ name: 'Id', label: 'Foo ID', type: 'string' }] };

    beforeEach(() => {
      jest.restoreAllMocks();
      declarationGeneratorSpy = jest.spyOn(declarationGenerator, 'generateSObjectDefinition');
    });

    it('Should throw if output folder can not be reset.', async () => {
      const originalErrorMsg = 'Failed to delete folder';
      jest.spyOn(utils, 'safeDelete').mockRejectedValue(new Error(originalErrorMsg));

      try {
        // @ts-expect-error - partial mock
        await generateFauxClasses({ standard: [standardMock], custom: [] });
      } catch (error) {
        assert(error instanceof Error);
        expect(error.message).toContain(utils.projectPaths.toolsFolder());
        expect(error.message).toContain(originalErrorMsg);
      }
    });

    it('Should process standard sobjects.', async () => {
      // @ts-expect-error - partial mock
      await generateFauxClasses({ standard: [standardMock], custom: [] });
      // the actual declarationGenerated is tested separately, so we just check that it is being called
      expect(declarationGeneratorSpy).toHaveBeenCalledWith(standardMock);
    });

    it('Should process custom sobjects.', async () => {
      // @ts-expect-error - partial mock
      await generateFauxClasses({ standard: [], custom: [customMock] });
      // the actual declarationGenerated is tested separately, so we just check that it is being was called
      expect(declarationGeneratorSpy).toHaveBeenCalledWith(customMock);
    });

    it('Should process both standard and custom sobjects.', async () => {
      // @ts-expect-error - partial mock
      await generateFauxClasses({ standard: [standardMock], custom: [customMock] });
      // the actual declarationGenerated is tested separately, so we just check that it is being called
      expect(declarationGeneratorSpy).toHaveBeenCalledWith(standardMock);
      expect(declarationGeneratorSpy).toHaveBeenCalledWith(customMock);
    });
  });
});
