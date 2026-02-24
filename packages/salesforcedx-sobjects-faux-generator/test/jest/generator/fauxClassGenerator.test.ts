/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EOL } from 'node:os';
import { generateSObjectDefinition } from '../../../src/generator/declarationGenerator';
import {
  commentToString,
  generateFauxClassText,
  INDENT
} from '../../../src/generator/fauxClassGenerator';
import { nls } from '../../../src/messages';

jest.mock('../../../src/messages');

const nlsMocked = jest.mocked(nls);

describe('FauxClassGenerator Unit Tests.', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  describe('generateFauxClassText()', () => {
    const standardMock = {
      name: 'Account',
      label: 'Account',
      fields: [{ name: 'Id', label: 'Account ID', type: 'string' }]
    };
    const customMock = { name: 'Foo__c', label: 'Foo', fields: [{ name: 'Id', label: 'Foo ID', type: 'string' }] };

    it('Should include the class header generated comment', () => {
      const definition = generateSObjectDefinition(standardMock as never);
      const text = generateFauxClassText(definition);
      expect(text).toContain(nls.localize('class_header_generated_comment'));
    });

    it('Should generate a class declaration for a standard SObject', () => {
      const definition = generateSObjectDefinition(standardMock as never);
      const text = generateFauxClassText(definition);
      expect(text).toContain('class Account');
    });

    it('Should generate a class declaration for a custom SObject', () => {
      const definition = generateSObjectDefinition(customMock as never);
      const text = generateFauxClassText(definition);
      expect(text).toContain('class Foo__c');
    });

    it('Should include field declarations', () => {
      const sobject = JSON.parse('{ "name": "Custom__c", "fields": [{"name":"Name","type":"string","referenceTo":[]}], "childRelationships": [] }');
      const definition = generateSObjectDefinition(sobject);
      const text = generateFauxClassText(definition);
      expect(text).toContain('String Name;');
    });
  });
});
