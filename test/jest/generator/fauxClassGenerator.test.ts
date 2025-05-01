/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EOL } from 'node:os';
import { SObjectCategory } from '../../../src';
import { FauxClassGenerator } from '../../../src/generator/fauxClassGenerator';
import { DeclarationGenerator } from '../../../src/generator/declarationGenerator';
import { nls } from '../../../src/messages';
import * as fs from 'node:fs';
import { FieldDeclaration, SObjectDefinition } from '../../../src/types';

jest.mock('node:fs');
const fsMocked = jest.mocked(fs);

describe('SObject faux class generator', () => {
  let classPath = '';
  const declGenerator = new DeclarationGenerator();

  const getGenerator = (): FauxClassGenerator => new FauxClassGenerator(SObjectCategory.CUSTOM, 'custom0');

  beforeEach(() => {
    jest.clearAllMocks();
    fsMocked.writeFileSync.mockImplementation(() => undefined);
    fsMocked.existsSync.mockReturnValue(false);
    fsMocked.mkdirSync.mockImplementation(() => undefined);
    fsMocked.rmSync.mockImplementation(() => undefined);
  });

  afterEach(() => {
    classPath = '';
  });

  it('Should generate a faux class with all types of fields that can be in custom SObjects', () => {
    const mockFields: FieldDeclaration[] = [
      { name: 'StringField', type: 'String', modifier: 'global' },
      { name: 'DoubleField', type: 'Double', modifier: 'global' },
      { name: 'BooleanField', type: 'Boolean', modifier: 'global' },
      { name: 'CurrencyField', type: 'Decimal', modifier: 'global' },
      { name: 'DateField', type: 'Date', modifier: 'global' },
      { name: 'DatetimeField', type: 'Datetime', modifier: 'global' },
      { name: 'EmailField', type: 'String', modifier: 'global' },
      { name: 'LocationField', type: 'Location', modifier: 'global' },
      { name: 'PercentField', type: 'Double', modifier: 'global' },
      { name: 'PicklistField', type: 'String', modifier: 'global' },
      { name: 'MultipicklistField', type: 'String', modifier: 'global' },
      { name: 'TextareaField', type: 'String', modifier: 'global' },
      { name: 'EncryptedField', type: 'String', modifier: 'global' },
      { name: 'UrlField', type: 'String', modifier: 'global' },
      { name: 'IdField', type: 'Id', modifier: 'global' }
    ];

    const mockSObjectDefinition: SObjectDefinition = {
      name: 'CustomObject__c',
      fields: mockFields
    };

    const gen = getGenerator();
    classPath = gen.generateFauxClass(process.cwd(), mockSObjectDefinition);

    const classText = gen.generateFauxClassText(mockSObjectDefinition);
    expect(classText).toContain('String StringField;');
    expect(classText).toContain('Double DoubleField;');
    expect(classText).toContain('Boolean BooleanField;');
    expect(classText).toContain('Decimal CurrencyField;');
    expect(classText).toContain('Date DateField;');
    expect(classText).toContain('Datetime DatetimeField;');
    expect(classText).toContain('String EmailField;');
    expect(classText).toContain('Location LocationField;');
    expect(classText).toContain('Double PercentField;');
    expect(classText).toContain('String PicklistField;');
    expect(classText).toContain('String MultipicklistField;');
    expect(classText).toContain('String TextareaField;');
    expect(classText).toContain('String EncryptedField;');
    expect(classText).toContain('String UrlField;');
    expect(classText).toContain('Id IdField;');

    expect(fsMocked.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('CustomObject__c.cls'),
      expect.any(String),
      expect.objectContaining({ mode: 0o444 })
    );
  });
});
