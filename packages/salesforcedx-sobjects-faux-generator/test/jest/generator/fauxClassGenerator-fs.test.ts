/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EOL } from 'node:os';
import { generateSObjectDefinition } from '../../../src/generator/declarationGenerator';
import { generateFauxClassText } from '../../../src/generator/fauxClassGenerator';
import { nls } from '../../../src/messages';
import { minimalCustomSObject } from './sObjectMockData';

jest.mock('../../../src/messages');
const nlsMocked = jest.mocked(nls);

describe('FauxClassGenerator Text Content Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    nlsMocked.localize.mockReturnValue('');
  });

  it('Should generate a faux class with a proper header comment', () => {
    const sobject = JSON.parse('{ "name": "Custom__c", "fields": [], "childRelationships": [] }');
    const text = generateFauxClassText(generateSObjectDefinition(sobject));
    expect(text).toContain(nls.localize('class_header_generated_comment'));
  });

  it('Should create a valid class with child relationship', () => {
    const field1 = '{"name": "StringField", "type": "string", "referenceTo": []}';
    const childRelation1 = '{"childSObject": "Case", "relationshipName": "Case__r"}';
    const sobject1 = `{ "name": "Custom__c", "fields": [ ${field1} ], "childRelationships": [${childRelation1}] }`;
    const text = generateFauxClassText(generateSObjectDefinition(JSON.parse(sobject1)));
    expect(text).toContain('List<Case> Case__r');
  });

  it('Should create a valid class for a platform event object', () => {
    const sobject = JSON.parse('{ "name": "PE1__e", "fields": [{"name":"StringField","type":"string","referenceTo":[]},{"name":"DoubleField","type":"double","referenceTo":[]}], "childRelationships": [] }');
    const text = generateFauxClassText(generateSObjectDefinition(sobject));
    expect(text).toContain('String StringField;');
    expect(text).toContain('Double DoubleField;');
  });

  it('Should create a valid field name for a child relationship that is missing the relationshipName', () => {
    const childRelation1 = '{"childSObject": "Case", "field": "RelatedCaseId", "relationshipName": null}';
    const sobject1 = `{ "name": "Custom__c", "childRelationships": [${childRelation1}] }`;
    const text = generateFauxClassText(generateSObjectDefinition(JSON.parse(sobject1)));
    expect(text).toContain('List<Case> RelatedCase;');
  });

  it('Should create a valid class for a metadata object with EntityDefinition relationship target', () => {
    const header = '{ "name": "Custom__mdt", "childRelationships": [], "fields": [';
    const field1 = '{"name": "MDRef__c", "type": "reference", "referenceTo": [], "relationshipName": null, "extraTypeInfo": "externallookup"}';
    const field2 = '{"name": "StringField", "type": "string", "referenceTo": []}';
    const sobject1 = `${header}${field1},${field2}]}`;
    const text = generateFauxClassText(generateSObjectDefinition(JSON.parse(sobject1)));
    expect(text).toContain('String MDRef__c');
  });

  it('Should create a valid class with a field and relationship', () => {
    const field1 = '{"name": "StringField", "type": "string", "referenceTo": []}';
    const relation1 = '{"name": "Account__c", "referenceTo": ["Account"], "relationshipName": "Account__r"}';
    const sobject1 = `{ "name": "Custom__c", "fields": [ ${field1},${relation1} ], "childRelationships": [] }`;
    const text = generateFauxClassText(generateSObjectDefinition(JSON.parse(sobject1)));
    expect(text).toContain('String StringField;');
    expect(text).toContain('Account Account__r');
    expect(text).toContain('Id Account__c');
  });

  it('Should generate a faux class with field inline comments', () => {
    const text = generateFauxClassText(generateSObjectDefinition(minimalCustomSObject));

    let standardFieldComment = `    /* Please add a unique name${EOL}`;
    standardFieldComment += `    */${EOL}`;
    standardFieldComment += `    global String Name;${EOL}`;
    expect(text).toContain(standardFieldComment);

    let customFieldComment = `    /* User field API name${EOL}`;
    customFieldComment += `    */${EOL}`;
    customFieldComment += `    global String Field_API_Name__c;${EOL}`;
    expect(text).toContain(customFieldComment);
  });

  it('Should generate a faux class with all types of fields that can be in custom SObjects', () => {
    const fields = '{"name":"StringField","type":"string","referenceTo":[]},{"name":"DoubleField","type":"double","referenceTo":[]},{"name":"BooleanField","type":"boolean","referenceTo":[]},{"name":"CurrencyField","type":"currency","referenceTo":[]},{"name":"DateField","type":"date","referenceTo":[]},{"name":"DatetimeField","type":"datetime","referenceTo":[]},{"name":"EmailField","type":"email","referenceTo":[]},{"name":"LocationField","type":"location","referenceTo":[]},{"name":"PercentField","type":"percent","referenceTo":[]},{"name":"PicklistField","type":"picklist","referenceTo":[]},{"name":"MultipicklistField","type":"multipicklist","referenceTo":[]},{"name":"TextareaField","type":"textarea","referenceTo":[]},{"name":"EncryptedField","type":"encryptedstring","referenceTo":[]},{"name":"UrlField","type":"url","referenceTo":[]},{"name":"IdField","type":"id","referenceTo":[]}';
    const text = generateFauxClassText(generateSObjectDefinition(JSON.parse(`{"name":"Custom__c","fields":[${fields}],"childRelationships":[]}`)));
    expect(text).toContain('String StringField;');
    expect(text).toContain('Double DoubleField;');
    expect(text).toContain('Boolean BooleanField;');
    expect(text).toContain('Decimal CurrencyField;');
    expect(text).toContain('Date DateField;');
    expect(text).toContain('Datetime DatetimeField;');
    expect(text).toContain('String EmailField;');
    expect(text).toContain('Location LocationField;');
    expect(text).toContain('Double PercentField;');
    expect(text).toContain('String PicklistField;');
    expect(text).toContain('String MultipicklistField;');
    expect(text).toContain('String TextareaField;');
    expect(text).toContain('String EncryptedField;');
    expect(text).toContain('String UrlField;');
    expect(text).toContain('Id IdField;');
  });

  it('Should generate a faux class with all types of fields that show only in standard SObjects', () => {
    const fields = '{"name":"BaseField","type":"base64","referenceTo":[]},{"name":"AddressField","type":"address","referenceTo":[]},{"name":"IntField","type":"int","referenceTo":[]},{"name":"AnytypeField","type":"anyType","referenceTo":[]},{"name":"ComboboxField","type":"combobox","referenceTo":[]}';
    const text = generateFauxClassText(generateSObjectDefinition(JSON.parse(`{"name":"Custom__c","fields":[${fields}],"childRelationships":[]}`)));
    expect(text).toContain('Blob BaseField;');
    expect(text).toContain('Address AddressField;');
    expect(text).toContain('Integer IntField;');
    expect(text).toContain('Object AnytypeField;');
    expect(text).toContain('String ComboboxField;');
  });

  it('Should create a class that has no duplicate field names', () => {
    const childRelation1 = '{"childSObject": "Case", "relationshipName": "Reference"}';
    const childRelation2 = '{"childSObject": "Account", "field": "ReferenceId", "relationshipName": null}';
    const sobject1 = `{ "name": "Custom__c", "childRelationships": [${childRelation2},${childRelation1}] }`;
    const text = generateFauxClassText(generateSObjectDefinition(JSON.parse(sobject1)));
    expect(text).toContain('List<Case> Reference;');
    expect(text).not.toContain('Account Reference');
  });

  it('Should create a valid field reference to another SObject when missing the relationshipName', () => {
    const childRelation1 = '{"childSObject": "Account", "field": "ReferenceId", "relationshipName": null}';
    const field1 = '{"name": "AccountFieldId", "type": "string", "referenceTo": ["Account"], "relationshipName": null}';
    const header = '{ "name": "Custom__c", "childRelationships": [';
    const fieldHeader = '"fields": [';
    const sobject1 = `${header}${childRelation1}],${fieldHeader}${field1}]}`;
    const text = generateFauxClassText(generateSObjectDefinition(JSON.parse(sobject1)));
    expect(text).not.toContain('null');
    expect(text).toContain('Account AccountField');
    expect(text).toContain('List<Account> Reference');
  });

  it('Should create a String field type for an external lookup relationship', () => {
    const field1 = '{"name": "ExtRef__c", "type": "reference", "referenceTo": [], "relationshipName": null, "extraTypeInfo": "externallookup"}';
    const sobject1 = `{ "name": "Custom__c", "childRelationships": [], "fields": [${field1}]}`;
    const text = generateFauxClassText(generateSObjectDefinition(JSON.parse(sobject1)));
    expect(text).toContain('String ExtRef__c');
  });

  it('Should create a valid class for a metadata object with a __mdt target', () => {
    const header = '{ "name": "Custom__mdt", "childRelationships": [], "fields": [';
    const field1 = '{"name": "MDRef__r", "type": "reference", "referenceTo": ["XX_mdt"], "relationshipName": null}';
    const field2 = '{"name": "StringField", "type": "string", "referenceTo": []}';
    const sobject1 = `${header}${field1},${field2}]}`;
    const text = generateFauxClassText(generateSObjectDefinition(JSON.parse(sobject1)));
    expect(text).toContain('XX_mdt MDRef__r');
  });
});
