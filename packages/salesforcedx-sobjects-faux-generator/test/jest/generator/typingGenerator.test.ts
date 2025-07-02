/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { fileOrFolderExists, projectPaths } from '@salesforce/salesforcedx-utils-vscode';
import * as sfdxUtils from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { generateSObjectDefinition } from '../../../src/generator/declarationGenerator';
import { generateType, generateAllTypes } from '../../../src/generator/typingGenerator';
import { minimalCustomSObject } from './sObjectMockData';

jest.mock('vscode');
const vscodeMocked = jest.mocked(vscode);

describe('SObject Javascript type declaration generator', () => {
  let typePath = '';

  beforeEach(() => {
    jest.clearAllMocks();
    vscodeMocked.workspace.fs.writeFile.mockResolvedValue();
    vscodeMocked.workspace.fs.stat.mockResolvedValue({ type: 1, ctime: 0, mtime: 0, size: 0, permissions: 1 });
    vscodeMocked.workspace.fs.createDirectory.mockResolvedValue();
    vscodeMocked.workspace.fs.delete.mockResolvedValue();
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

  it('Should generate a declaration file', async () => {
    const fieldsHeader = '{ "name": "Custom__c", "fields": [ ';
    const closeHeader = ' ], "childRelationships": [] }';

    const sobject1 = `${fieldsHeader}${closeHeader}`;
    const objDef = generateSObjectDefinition(JSON.parse(sobject1));

    const sobjectFolder = process.cwd();
    typePath = await generateType(sobjectFolder, objDef);

    expect(await fileOrFolderExists(typePath)).toBeTruthy();
  });

  it('Should generate a declaration file with all types of fields that can be in custom SObjects', async () => {
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
    const objDef = generateSObjectDefinition(JSON.parse(sobject1));

    const sobjectFolder = process.cwd();
    typePath = await generateType(sobjectFolder, objDef);

    const writeFileCall = vscodeMocked.workspace.fs.writeFile.mock.calls[0];
    const typeText = Buffer.from(writeFileCall[1]).toString('utf8');

    expect(typeText).toContain('@salesforce/schema/Custom__c.StringField');
    expect(typeText).toContain('const StringField:string;');
    expect(typeText).toContain('export default StringField;');

    expect(typeText).toContain('@salesforce/schema/Custom__c.DoubleField');
    expect(typeText).toContain('const DoubleField:number;');
    expect(typeText).toContain('export default DoubleField;');

    expect(typeText).toContain('@salesforce/schema/Custom__c.BooleanField');
    expect(typeText).toContain('const BooleanField:boolean;');
    expect(typeText).toContain('export default BooleanField;');

    expect(typeText).toContain('@salesforce/schema/Custom__c.CurrencyField');
    expect(typeText).toContain('const CurrencyField:number;');
    expect(typeText).toContain('export default CurrencyField;');

    expect(typeText).toContain('@salesforce/schema/Custom__c.DateField');
    expect(typeText).toContain('const DateField:any;');
    expect(typeText).toContain('export default DateField;');

    expect(typeText).toContain('@salesforce/schema/Custom__c.DatetimeField');
    expect(typeText).toContain('const DatetimeField:any;');
    expect(typeText).toContain('export default DatetimeField;');

    expect(typeText).toContain('@salesforce/schema/Custom__c.EmailField');
    expect(typeText).toContain('const EmailField:string;');
    expect(typeText).toContain('export default EmailField;');

    expect(typeText).toContain('@salesforce/schema/Custom__c.LocationField');
    expect(typeText).toContain('const LocationField:any;');
    expect(typeText).toContain('export default LocationField;');

    expect(typeText).toContain('@salesforce/schema/Custom__c.PercentField');
    expect(typeText).toContain('const PercentField:number;');
    expect(typeText).toContain('export default PercentField;');

    expect(typeText).toContain('@salesforce/schema/Custom__c.PicklistField');
    expect(typeText).toContain('const PicklistField:string;');
    expect(typeText).toContain('export default PicklistField;');

    expect(typeText).toContain('@salesforce/schema/Custom__c.MultipicklistField');
    expect(typeText).toContain('const MultipicklistField:string;');
    expect(typeText).toContain('export default MultipicklistField;');

    expect(typeText).toContain('@salesforce/schema/Custom__c.TextareaField');
    expect(typeText).toContain('const TextareaField:string;');
    expect(typeText).toContain('export default TextareaField;');

    expect(typeText).toContain('@salesforce/schema/Custom__c.EncryptedField');
    expect(typeText).toContain('const EncryptedField:string;');
    expect(typeText).toContain('export default EncryptedField;');

    expect(typeText).toContain('@salesforce/schema/Custom__c.UrlField');
    expect(typeText).toContain('const UrlField:string;');
    expect(typeText).toContain('export default UrlField;');

    expect(typeText).toContain('@salesforce/schema/Custom__c.IdField');
    expect(typeText).toContain('const IdField:any;');
    expect(typeText).toContain('export default IdField;');
  });

  it('Should generate a declaration file with all types of fields that show only in standard SObjects', async () => {
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
    const objDef = generateSObjectDefinition(JSON.parse(sobject1));

    const sobjectFolder = process.cwd();
    typePath = await generateType(sobjectFolder, objDef);

    const writeFileCall = vscodeMocked.workspace.fs.writeFile.mock.calls[0];
    const typeText = Buffer.from(writeFileCall[1]).toString('utf8');

    expect(typeText).toContain('const BaseField:any;');
    expect(typeText).toContain('const AddressField:any;');
    expect(typeText).toContain('const IntField:number;');
    expect(typeText).toContain('const AnytypeField:any;');
    expect(typeText).toContain('const ComboboxField:string;');
  });

  it('Should create a declaration file with a field and relationship', async () => {
    const field1 = '{"name": "StringField", "type": "string", "referenceTo": []}';
    const relation1 = '{"name": "Account__c", "referenceTo": ["Account"], "relationshipName": "Account__r"}';
    const sobject1: string = `{ "name": "Custom__c", "fields": [ ${field1},${relation1} ], "childRelationships": [] }`;
    const objDef = generateSObjectDefinition(JSON.parse(sobject1));

    const sobjectFolder = process.cwd();
    typePath = await generateType(sobjectFolder, objDef);

    const writeFileCall = vscodeMocked.workspace.fs.writeFile.mock.calls[0];
    const typeText = Buffer.from(writeFileCall[1]).toString('utf8');

    expect(typeText).toContain('@salesforce/schema/Custom__c.StringField');
    expect(typeText).toContain('const StringField:string;');
    expect(typeText).toContain('export default StringField;');

    expect(typeText).toContain('@salesforce/schema/Custom__c.Account__r');
    expect(typeText).toContain('const Account__r:any;');
    expect(typeText).toContain('export default Account__r;');

    expect(typeText).toContain('@salesforce/schema/Custom__c.Account__c');
    expect(typeText).toContain('const Account__c:any;');
    expect(typeText).toContain('export default Account__c;');
  });

  it('Should create a String field type for an external lookup relationship', async () => {
    const field1 =
      '{"name": "ExtRef__c", "type": "reference", "referenceTo": [], "relationshipName": null, "extraTypeInfo": "externallookup"}';
    const header = '{ "name": "Custom__c",  "childRelationships": []';
    const fieldHeader = '"fields": [';
    const sobject1 = `${header},${fieldHeader}${field1}]}`;
    const objDef = generateSObjectDefinition(JSON.parse(sobject1));

    const sobjectFolder = process.cwd();
    typePath = await generateType(sobjectFolder, objDef);

    const writeFileCall = vscodeMocked.workspace.fs.writeFile.mock.calls[0];
    const typeText = Buffer.from(writeFileCall[1]).toString('utf8');

    expect(typeText).toContain('@salesforce/schema/Custom__c.ExtRef__c');
    expect(typeText).toContain('const ExtRef__c:string;');
    expect(typeText).toContain('export default ExtRef__c;');
  });

  it('Should create a valid declaration file for a metadata object with EntityDefinition relationship target', async () => {
    const header = '{ "name": "Custom__mdt",  "childRelationships": [], "fields": [';
    const field1 =
      '{"name": "MDRef__c", "type": "reference", "referenceTo": [], "relationshipName": null, "extraTypeInfo": "externallookup"}';
    const field2 = '{"name": "StringField", "type": "string", "referenceTo": []}';
    const sobject1 = `${header}${field1},${field2}]}`;
    const objDef = generateSObjectDefinition(JSON.parse(sobject1));

    const sobjectFolder = process.cwd();
    typePath = await generateType(sobjectFolder, objDef);

    const writeFileCall = vscodeMocked.workspace.fs.writeFile.mock.calls[0];
    const typeText = Buffer.from(writeFileCall[1]).toString('utf8');

    expect(typeText).toContain('@salesforce/schema/Custom__mdt.MDRef__c');
    expect(typeText).toContain('const MDRef__c:string;');
    expect(typeText).toContain('export default MDRef__c;');
  });

  it('Should create a valid declaration file for a metadata object with a __mdt target', async () => {
    const header = '{ "name": "Custom__mdt",  "childRelationships": [], "fields": [';
    const field1 = '{"name": "MDRef__r", "type": "reference", "referenceTo": ["XX_mdt"], "relationshipName": null}';
    const field2 = '{"name": "StringField", "type": "string", "referenceTo": []}';
    const sobject1 = `${header}${field1},${field2}]}`;
    const objDef = generateSObjectDefinition(JSON.parse(sobject1));

    const sobjectFolder = process.cwd();
    typePath = await generateType(sobjectFolder, objDef);

    const writeFileCall = vscodeMocked.workspace.fs.writeFile.mock.calls[0];
    const typeText = Buffer.from(writeFileCall[1]).toString('utf8');

    expect(typeText).toContain('@salesforce/schema/Custom__mdt.MDRef__r');
    expect(typeText).toContain('const MDRef__r:any;');
    expect(typeText).toContain('export default MDRef__r;');
  });

  it('Should create a valid declaration file for a platform event object', async () => {
    const fieldsHeader = '{ "name": "PE1__e", "fields": [ ';
    const closeHeader = ' ], "childRelationships": [] }';

    const fields: string[] = [
      '{"name": "StringField", "type": "string", "referenceTo": []}',
      '{"name": "DoubleField", "type" : "double", "referenceTo": []}'
    ];

    const fieldsString = fields.join(',');
    const sobject1 = `${fieldsHeader}${fieldsString}${closeHeader}`;
    const objDef = generateSObjectDefinition(JSON.parse(sobject1));

    const sobjectFolder = process.cwd();
    typePath = await generateType(sobjectFolder, objDef);

    const writeFileCall = vscodeMocked.workspace.fs.writeFile.mock.calls[0];
    const typeText = Buffer.from(writeFileCall[1]).toString('utf8');

    expect(typeText).toContain('declare module "@salesforce/schema/PE1__e.StringField"');
    expect(typeText).toContain('const StringField:string;');
    expect(typeText).toContain('export default StringField;');

    expect(typeText).toContain('declare module "@salesforce/schema/PE1__e.DoubleField"');
    expect(typeText).toContain('const DoubleField:number;');
    expect(typeText).toContain('export default DoubleField;');
  });

  it('Should generate all types for standard and custom sobjects', async () => {
    const standard = { ...minimalCustomSObject, name: 'StandardObj', custom: false };
    const custom = { ...minimalCustomSObject, name: 'CustomObj__c', custom: true };
    const sobjects = { standard: [standard], custom: [custom] };

    // Mock projectPaths.stateFolder to a temp dir
    const tempDir = path.join('tmp', 'typings-test');
    jest.spyOn(projectPaths, 'stateFolder').mockReturnValue(tempDir);
    const createDirectoryMock = jest.spyOn(sfdxUtils, 'createDirectory').mockResolvedValue(undefined);
    const writeFileMock = jest.spyOn(sfdxUtils, 'writeFile').mockResolvedValue(undefined);
    const safeDeleteMock = jest.spyOn(sfdxUtils, 'safeDelete').mockResolvedValue(undefined);

    await generateAllTypes(sobjects);

    const typingsFolder = path.join(tempDir, 'typings', 'lwc', 'sobjects');
    expect(createDirectoryMock).toHaveBeenCalledWith(typingsFolder);
    expect(writeFileMock).toHaveBeenCalledWith(path.join(typingsFolder, 'StandardObj.d.ts'), expect.any(String));
    expect(writeFileMock).toHaveBeenCalledWith(path.join(typingsFolder, 'CustomObj__c.d.ts'), expect.any(String));
    expect(safeDeleteMock).toHaveBeenCalledWith(path.join(typingsFolder, 'StandardObj.d.ts'));
    expect(safeDeleteMock).toHaveBeenCalledWith(path.join(typingsFolder, 'CustomObj__c.d.ts'));
  });
});
