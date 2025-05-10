/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TOOLS } from '@salesforce/salesforcedx-utils-vscode';
import { EOL } from 'node:os';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { CUSTOMOBJECTS_DIR, folderExists, SObjectCategory, SOBJECTS_DIR } from '../../../src';
import { FauxClassGenerator } from '../../../src/generator';
import { DeclarationGenerator } from '../../../src/generator/declarationGenerator';
import { nls } from '../../../src/messages';
import { minimalCustomSObject } from './sObjectMockData';

jest.mock('vscode');
const vscodeMocked = jest.mocked(vscode);

describe('FauxClassGenerator Filesystem Tests', () => {
  let classPath = '';
  const declGenerator = new DeclarationGenerator();
  const sfdxPath = process.cwd();
  const baseFolder = join(sfdxPath, TOOLS, SOBJECTS_DIR);
  const customOutputPath = join(baseFolder, CUSTOMOBJECTS_DIR);

  const getGenerator = (): FauxClassGenerator => new FauxClassGenerator(SObjectCategory.CUSTOM, CUSTOMOBJECTS_DIR);

  beforeEach(() => {
    jest.clearAllMocks();
    vscodeMocked.workspace.fs.writeFile.mockImplementation((uri, content) => {
      if (!(content instanceof Buffer)) {
        content = Buffer.from(content);
      }
      return Promise.resolve();
    });
    vscodeMocked.workspace.fs.stat.mockResolvedValue({ type: 1, ctime: 0, mtime: 0, size: 0 });
    vscodeMocked.workspace.fs.createDirectory.mockResolvedValue();
    vscodeMocked.workspace.fs.delete.mockResolvedValue();
  });

  afterEach(() => {
    if (classPath) {
      try {
        vscodeMocked.workspace.fs.delete(vscode.Uri.file(classPath));
      } catch (e) {
        console.log(e);
      }
      classPath = '';
    }
    vscodeMocked.workspace.fs.delete(vscode.Uri.file(baseFolder), { recursive: true, useTrash: false });
  });

  it('Should generate a faux class with a proper header comment', async () => {
    const fieldsHeader = '{ "name": "Custom__c", "fields": [ ';
    const closeHeader = ' ], "childRelationships": [] }';

    const sobject1 = `${fieldsHeader}${closeHeader}`;

    const gen = getGenerator();
    classPath = await gen.generateFauxClass(customOutputPath, JSON.parse(sobject1));
    expect(await folderExists(classPath)).toBeTruthy();
    const writeFileCall = vscodeMocked.workspace.fs.writeFile.mock.calls[0];
    const classText = Buffer.from(writeFileCall[1]).toString('utf8');
    expect(classText).toContain(nls.localize('class_header_generated_comment'));
  });

  it('Should generate a faux class as read-only', async () => {
    const fieldsHeader = '{ "name": "Custom__c", "fields": [ ';
    const closeHeader = ' ], "childRelationships": [] }';

    const sobject1 = `${fieldsHeader}${closeHeader}`;

    const gen = getGenerator();
    classPath = await gen.generateFauxClass(customOutputPath, JSON.parse(sobject1));
    expect(await folderExists(classPath)).toBeTruthy();
  });

  it('Should create a valid class with child relationship', async () => {
    const field1 = '{"name": "StringField", "type": "string", "referenceTo": []}';
    const childRelation1 = '{"childSObject": "Case", "relationshipName": "Case__r"}';
    const sobject1 = `{ "name": "Custom__c", "fields": [ ${field1} ], "childRelationships": [${childRelation1}] }`;
    const objDef = declGenerator.generateSObjectDefinition(JSON.parse(sobject1));

    const gen = getGenerator();
    classPath = await gen.generateFauxClass(customOutputPath, objDef);
    const writeFileCall = vscodeMocked.workspace.fs.writeFile.mock.calls[0];
    const classText = Buffer.from(writeFileCall[1]).toString('utf8');
    expect(classText).toContain('List<Case> Case__r');
  });

  it('Should create a valid class for a platform event object', async () => {
    const fieldsHeader = '{ "name": "PE1__e", "fields": [ ';
    const closeHeader = ' ], "childRelationships": [] }';

    const fields: string[] = [
      '{"name": "StringField", "type": "string", "referenceTo": []}',
      '{"name": "DoubleField", "type" : "double", "referenceTo": []}'
    ];

    const fieldsString = fields.join(',');
    const sobject1 = `${fieldsHeader}${fieldsString}${closeHeader}`;
    const objDef = declGenerator.generateSObjectDefinition(JSON.parse(sobject1));

    const gen = getGenerator();
    classPath = await gen.generateFauxClass(customOutputPath, objDef);
    expect(await folderExists(classPath)).toBeTruthy();
    const writeFileCall = vscodeMocked.workspace.fs.writeFile.mock.calls[0];
    const classText = Buffer.from(writeFileCall[1]).toString('utf8');
    expect(classText).toContain('String StringField;');
    expect(classText).toContain('Double DoubleField;');
  });

  it('Should create a valid field name for a child relationship that is missing the relationshipName', async () => {
    const childRelation1 = '{"childSObject": "Case", "field": "RelatedCaseId", "relationshipName": null}';
    const sobject1 = `{ "name": "Custom__c", "childRelationships": [${childRelation1}] }`;
    const objDef = declGenerator.generateSObjectDefinition(JSON.parse(sobject1));

    const gen = getGenerator();
    classPath = await gen.generateFauxClass(customOutputPath, objDef);
    expect(await folderExists(classPath)).toBeTruthy();
    const writeFileCall = vscodeMocked.workspace.fs.writeFile.mock.calls[0];
    const classText = Buffer.from(writeFileCall[1]).toString('utf8');
    expect(classText).toContain('List<Case> RelatedCase;');
  });

  it('Should create a valid class for a metadata object with EntityDefinition relationship target', async () => {
    const header = '{ "name": "Custom__mdt", "childRelationships": [], "fields": [';
    const field1 =
      '{"name": "MDRef__c", "type": "reference", "referenceTo": [], "relationshipName": null, "extraTypeInfo": "externallookup"}';
    const field2 = '{"name": "StringField", "type": "string", "referenceTo": []}';
    const sobject1 = `${header}${field1},${field2}]}`;
    const objDef = declGenerator.generateSObjectDefinition(JSON.parse(sobject1));

    const gen = getGenerator();
    classPath = await gen.generateFauxClass(customOutputPath, objDef);
    expect(await folderExists(classPath)).toBeTruthy();
    const writeFileCall = vscodeMocked.workspace.fs.writeFile.mock.calls[0];
    const classText = Buffer.from(writeFileCall[1]).toString('utf8');
    expect(classText).toContain('String MDRef__c');
  });

  it('Should create a valid class with a field and relationship', async () => {
    const field1 = '{"name": "StringField", "type": "string", "referenceTo": []}';
    const relation1 = '{"name": "Account__c", "referenceTo": ["Account"], "relationshipName": "Account__r"}';
    const sobject1 = `{ "name": "Custom__c", "fields": [ ${field1},${relation1} ], "childRelationships": [] }`;
    const objDef = declGenerator.generateSObjectDefinition(JSON.parse(sobject1));

    const gen = getGenerator();
    classPath = await gen.generateFauxClass(customOutputPath, objDef);
    expect(await folderExists(classPath)).toBeTruthy();
    const writeFileCall = vscodeMocked.workspace.fs.writeFile.mock.calls[0];
    const classText = Buffer.from(writeFileCall[1]).toString('utf8');
    expect(classText).toContain('String StringField;');
    expect(classText).toContain('Account Account__r');
    expect(classText).toContain('Id Account__c');
  });

  it('Should generate a faux class with all types of fields that show only in standard SObjects', async () => {
    const fieldsHeader = '{ "name": "Custom__c", "fields": [ ';
    const closeHeader = ' ], "childRelationships": [] }';

    const fields: string[] = [
      '{"name": "BaseField", "type": "base64", "referenceTo": []}',
      '{"name": "AddressField", "type" : "address", "referenceTo": []}',
      '{"name": "IntField", "type" : "int", "referenceTo": []}',
      '{"name": "AnytypeField", "type" : "anyType", "referenceTo": []}',
      '{"name": "ComboboxField", "type" : "combobox", "referenceTo": []}'
    ];

    const fieldsString = fields.join(',');
    const sobject1 = `${fieldsHeader}${fieldsString}${closeHeader}`;
    const objDef = declGenerator.generateSObjectDefinition(JSON.parse(sobject1));

    const gen = getGenerator();
    classPath = await gen.generateFauxClass(customOutputPath, objDef);
    expect(await folderExists(classPath)).toBeTruthy();
    const writeFileCall = vscodeMocked.workspace.fs.writeFile.mock.calls[0];
    const classText = Buffer.from(writeFileCall[1]).toString('utf8');
    expect(classText).toContain('Blob BaseField;');
    expect(classText).toContain('Address AddressField;');
    expect(classText).toContain('Integer IntField;');
    expect(classText).toContain('Object AnytypeField;');
    expect(classText).toContain('String ComboboxField;');
  });

  it('Should generate a faux class with field inline comments', async () => {
    vscodeMocked.workspace.fs.stat.mockRejectedValue(new Error('Not found'));
    const gen = getGenerator();
    const customDef = declGenerator.generateSObjectDefinition(minimalCustomSObject);
    const classContent = gen.generateFauxClassText(customDef);

    let standardFieldComment = `    /* Please add a unique name${EOL}`;
    standardFieldComment += `    */${EOL}`;
    standardFieldComment += `    global String Name;${EOL}`;
    expect(classContent).toContain(standardFieldComment);

    let customFieldComment = `    /* User field API name${EOL}`;
    customFieldComment += `    */${EOL}`;
    customFieldComment += `    global String Field_API_Name__c;${EOL}`;
    expect(classContent).toContain(customFieldComment);
  });

  it('Should generate a faux class with all types of fields that can be in custom SObjects', async () => {
    const fieldsHeader = '{ "name": "Custom__c", "fields": [ ';
    const closeHeader = ' ], "childRelationships": [] }';

    const fields: string[] = [
      '{"name": "StringField", "type": "string", "referenceTo": []}',
      '{"name": "DoubleField", "type" : "double", "referenceTo": []}',
      '{"name": "BooleanField", "type" : "boolean", "referenceTo": []}',
      '{"name": "CurrencyField", "type" : "currency", "referenceTo": []}',
      '{"name": "DateField", "type" : "date", "referenceTo": []}',
      '{"name": "DatetimeField", "type" : "datetime", "referenceTo": []}',
      '{"name": "EmailField", "type" : "email", "referenceTo": []}',
      '{"name": "LocationField", "type" : "location", "referenceTo": []}',
      '{"name": "PercentField", "type" : "percent", "referenceTo": []}',
      '{"name": "PicklistField", "type" : "picklist", "referenceTo": []}',
      '{"name": "MultipicklistField", "type" : "multipicklist", "referenceTo": []}',
      '{"name": "TextareaField", "type" : "textarea", "referenceTo": []}',
      '{"name": "EncryptedField", "type" : "encryptedstring", "referenceTo": []}',
      '{"name": "UrlField", "type" : "url", "referenceTo": []}',
      '{"name": "IdField", "type" : "id", "referenceTo": []}'
    ];

    const fieldsString = fields.join(',');
    const sobject1 = `${fieldsHeader}${fieldsString}${closeHeader}`;
    const objDef = declGenerator.generateSObjectDefinition(JSON.parse(sobject1));

    const gen = getGenerator();
    classPath = await gen.generateFauxClass(customOutputPath, objDef);
    expect(await folderExists(classPath)).toBeTruthy();
    const writeFileCall = vscodeMocked.workspace.fs.writeFile.mock.calls[0];
    const classText = Buffer.from(writeFileCall[1]).toString('utf8');
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
  });

  it('Should create a class that has no duplicate field names', async () => {
    const childRelation1 = '{"childSObject": "Case", "relationshipName": "Reference"}';
    const childRelation2 = '{"childSObject": "Account", "field": "ReferenceId", "relationshipName": null}';

    const sobject1 = `{ "name": "Custom__c", "childRelationships": [${childRelation2},${childRelation1}] }`;
    const objDef = declGenerator.generateSObjectDefinition(JSON.parse(sobject1));

    const gen = getGenerator();
    classPath = await gen.generateFauxClass(customOutputPath, objDef);
    expect(await folderExists(classPath)).toBeTruthy();
    const writeFileCall = vscodeMocked.workspace.fs.writeFile.mock.calls[0];
    const classText = Buffer.from(writeFileCall[1]).toString('utf8');
    expect(classText).toContain('List<Case> Reference;');
    expect(classText).not.toContain('Account Reference');
  });

  it('Should create a valid field reference to another SObject when missing the relationshipName', async () => {
    const childRelation1 = '{"childSObject": "Account", "field": "ReferenceId", "relationshipName": null}';
    const field1 = '{"name": "AccountFieldId", "type": "string", "referenceTo": ["Account"], "relationshipName": null}';
    const header = '{ "name": "Custom__c", "childRelationships": [';
    const fieldHeader = '"fields": [';
    const sobject1 = `${header}${childRelation1}],${fieldHeader}${field1}]}`;
    const objDef = declGenerator.generateSObjectDefinition(JSON.parse(sobject1));

    const gen = getGenerator();
    classPath = await gen.generateFauxClass(customOutputPath, objDef);
    expect(await folderExists(classPath)).toBeTruthy();
    const writeFileCall = vscodeMocked.workspace.fs.writeFile.mock.calls[0];
    const classText = Buffer.from(writeFileCall[1]).toString('utf8');
    expect(classText).not.toContain('null');
    expect(classText).toContain('Account AccountField');
    expect(classText).toContain('List<Account> Reference');
  });

  it('Should create a String field type for an external lookup relationship', async () => {
    const field1 =
      '{"name": "ExtRef__c", "type": "reference", "referenceTo": [], "relationshipName": null, "extraTypeInfo": "externallookup"}';
    const header = '{ "name": "Custom__c", "childRelationships": []';
    const fieldHeader = '"fields": [';
    const sobject1 = `${header},${fieldHeader}${field1}]}`;
    const objDef = declGenerator.generateSObjectDefinition(JSON.parse(sobject1));

    const gen = getGenerator();
    classPath = await gen.generateFauxClass(customOutputPath, objDef);
    expect(await folderExists(classPath)).toBeTruthy();
    const writeFileCall = vscodeMocked.workspace.fs.writeFile.mock.calls[0];
    const classText = Buffer.from(writeFileCall[1]).toString('utf8');
    expect(classText).toContain('String ExtRef__c');
  });

  it('Should create a valid class for a metadata object with a __mdt target', async () => {
    const header = '{ "name": "Custom__mdt", "childRelationships": [], "fields": [';
    const field1 = '{"name": "MDRef__r", "type": "reference", "referenceTo": ["XX_mdt"], "relationshipName": null}';
    const field2 = '{"name": "StringField", "type": "string", "referenceTo": []}';
    const sobject1 = `${header}${field1},${field2}]}`;
    const objDef = declGenerator.generateSObjectDefinition(JSON.parse(sobject1));

    const gen = getGenerator();
    classPath = await gen.generateFauxClass(customOutputPath, objDef);
    expect(await folderExists(classPath)).toBeTruthy();
    const writeFileCall = vscodeMocked.workspace.fs.writeFile.mock.calls[0];
    const classText = Buffer.from(writeFileCall[1]).toString('utf8');
    expect(classText).toContain('XX_mdt MDRef__r');
  });
});
