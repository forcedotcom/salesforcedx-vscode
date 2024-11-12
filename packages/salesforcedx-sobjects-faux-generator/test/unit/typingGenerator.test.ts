/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as chai from 'chai';
import * as fs from 'fs';
import { DeclarationGenerator } from '../../src/generator/declarationGenerator';
import { TypingGenerator } from '../../src/generator/typingGenerator';

const expect = chai.expect;

describe('SObject Javacript type declaration generator', () => {
  let typePath = '';
  const declGenerator = new DeclarationGenerator();

  afterEach(() => {
    if (typePath) {
      try {
        fs.unlinkSync(typePath);
      } catch (e) {
        console.log(e);
      }
      typePath = '';
    }
  });

  it('Should generate a declaration file as read-only', async () => {
    const fieldsHeader = '{ "name": "Custom__c", "fields": [ ';
    const closeHeader = ' ], "childRelationships": [] }';

    const sobject1 = `${fieldsHeader}${closeHeader}`;
    const objDef = declGenerator.generateSObjectDefinition(JSON.parse(sobject1));

    const sobjectFolder = process.cwd();
    const gen = new TypingGenerator();
    typePath = gen.generateType(sobjectFolder, objDef);
    expect(fs.existsSync(typePath));
    const stat = fs.lstatSync(typePath);
    const expectedMode = parseInt('100444', 8);
    expect(stat.mode).to.equal(expectedMode);
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
    const objDef = declGenerator.generateSObjectDefinition(JSON.parse(sobject1));

    const sobjectFolder = process.cwd();
    const gen = new TypingGenerator();
    typePath = gen.generateType(sobjectFolder, objDef);
    expect(fs.existsSync(typePath));
    const typeText = fs.readFileSync(typePath, 'utf8');
    expect(typeText).to.include('@salesforce/schema/Custom__c.StringField');
    expect(typeText).to.include('const StringField:string;');
    expect(typeText).to.include('export default StringField;');

    expect(typeText).to.include('@salesforce/schema/Custom__c.DoubleField');
    expect(typeText).to.include('const DoubleField:number;');
    expect(typeText).to.include('export default DoubleField;');

    expect(typeText).to.include('@salesforce/schema/Custom__c.BooleanField');
    expect(typeText).to.include('const BooleanField:boolean;');
    expect(typeText).to.include('export default BooleanField;');

    expect(typeText).to.include('@salesforce/schema/Custom__c.CurrencyField');
    expect(typeText).to.include('const CurrencyField:number;');
    expect(typeText).to.include('export default CurrencyField;');

    expect(typeText).to.include('@salesforce/schema/Custom__c.DateField');
    expect(typeText).to.include('const DateField:any;');
    expect(typeText).to.include('export default DateField;');

    expect(typeText).to.include('@salesforce/schema/Custom__c.DatetimeField');
    expect(typeText).to.include('const DatetimeField:any;');
    expect(typeText).to.include('export default DatetimeField;');

    expect(typeText).to.include('@salesforce/schema/Custom__c.EmailField');
    expect(typeText).to.include('const EmailField:string;');
    expect(typeText).to.include('export default EmailField;');

    expect(typeText).to.include('@salesforce/schema/Custom__c.LocationField');
    expect(typeText).to.include('const LocationField:any;');
    expect(typeText).to.include('export default LocationField;');

    expect(typeText).to.include('@salesforce/schema/Custom__c.PercentField');
    expect(typeText).to.include('const PercentField:number;');
    expect(typeText).to.include('export default PercentField;');

    expect(typeText).to.include('@salesforce/schema/Custom__c.PicklistField');
    expect(typeText).to.include('const PicklistField:string;');
    expect(typeText).to.include('export default PicklistField;');

    expect(typeText).to.include('@salesforce/schema/Custom__c.MultipicklistField');
    expect(typeText).to.include('const MultipicklistField:string;');
    expect(typeText).to.include('export default MultipicklistField;');

    expect(typeText).to.include('@salesforce/schema/Custom__c.TextareaField');
    expect(typeText).to.include('const TextareaField:string;');
    expect(typeText).to.include('export default TextareaField;');

    expect(typeText).to.include('@salesforce/schema/Custom__c.EncryptedField');
    expect(typeText).to.include('const EncryptedField:string;');
    expect(typeText).to.include('export default EncryptedField;');

    expect(typeText).to.include('@salesforce/schema/Custom__c.UrlField');
    expect(typeText).to.include('const UrlField:string;');
    expect(typeText).to.include('export default UrlField;');

    expect(typeText).to.include('@salesforce/schema/Custom__c.IdField');
    expect(typeText).to.include('const IdField:any;');
    expect(typeText).to.include('export default IdField;');
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
    const objDef = declGenerator.generateSObjectDefinition(JSON.parse(sobject1));

    const sobjectFolder = process.cwd();
    const gen = new TypingGenerator();
    typePath = gen.generateType(sobjectFolder, objDef);
    expect(fs.existsSync(typePath));
    const typeText = fs.readFileSync(typePath, 'utf8');
    expect(typeText).to.include('const BaseField:any;');
    expect(typeText).to.include('const AddressField:any;');
    expect(typeText).to.include('const IntField:number;');
    expect(typeText).to.include('const AnytypeField:any;');
    expect(typeText).to.include('const ComboboxField:string;');
  });

  it('Should create a declaration file with a field and relationship', async () => {
    const field1 = '{"name": "StringField", "type": "string", "referenceTo": []}';
    const relation1 = '{"name": "Account__c", "referenceTo": ["Account"], "relationshipName": "Account__r"}';
    const sobject1: string =
      '{ "name": "Custom__c", "fields": [ ' + field1 + ',' + relation1 + ' ], "childRelationships": [] }';
    const objDef = declGenerator.generateSObjectDefinition(JSON.parse(sobject1));

    const sobjectFolder = process.cwd();
    const gen = new TypingGenerator();
    typePath = gen.generateType(sobjectFolder, objDef);
    expect(fs.existsSync(typePath));
    const typeText = fs.readFileSync(typePath, 'utf8');
    expect(typeText).to.include('@salesforce/schema/Custom__c.StringField');
    expect(typeText).to.include('const StringField:string;');
    expect(typeText).to.include('export default StringField;');

    expect(typeText).to.include('@salesforce/schema/Custom__c.Account__r');
    expect(typeText).to.include('const Account__r:any;');
    expect(typeText).to.include('export default Account__r;');

    expect(typeText).to.include('@salesforce/schema/Custom__c.Account__c');
    expect(typeText).to.include('const Account__c:any;');
    expect(typeText).to.include('export default Account__c;');
  });

  it('Should create a String field type for an external lookup relationship', async () => {
    const field1 =
      '{"name": "ExtRef__c", "type": "reference", "referenceTo": [], "relationshipName": null, "extraTypeInfo": "externallookup"}';
    const header = '{ "name": "Custom__c",  "childRelationships": []';
    const fieldHeader = '"fields": [';
    const sobject1 = `${header},${fieldHeader}${field1}]}`;
    const objDef = declGenerator.generateSObjectDefinition(JSON.parse(sobject1));

    const sobjectFolder = process.cwd();
    const gen = new TypingGenerator();
    typePath = gen.generateType(sobjectFolder, objDef);
    expect(fs.existsSync(typePath));
    const typeText = fs.readFileSync(typePath, 'utf8');
    expect(typeText).to.include('@salesforce/schema/Custom__c.ExtRef__c"');
    expect(typeText).to.include('const ExtRef__c:string;');
    expect(typeText).to.include('export default ExtRef__c;');
  });

  it('Should create a valid declaration file for a metadata object with EntityDefinition relationship target', async () => {
    const header = '{ "name": "Custom__mdt",  "childRelationships": [], "fields": [';
    const field1 =
      '{"name": "MDRef__c", "type": "reference", "referenceTo": [], "relationshipName": null, "extraTypeInfo": "externallookup"}';
    const field2 = '{"name": "StringField", "type": "string", "referenceTo": []}';
    const sobject1 = `${header}${field1},${field2}]}`;
    const objDef = declGenerator.generateSObjectDefinition(JSON.parse(sobject1));
    const sobjectFolder = process.cwd();
    const gen = new TypingGenerator();
    typePath = gen.generateType(sobjectFolder, objDef);
    expect(fs.existsSync(typePath));
    const typeText = fs.readFileSync(typePath, 'utf8');
    expect(typeText).to.include('@salesforce/schema/Custom__mdt.MDRef__c"');
    expect(typeText).to.include('const MDRef__c:string;');
    expect(typeText).to.include('export default MDRef__c;');
  });

  it('Should create a valid declaration file for a metadata object with a __mdt target', async () => {
    const header = '{ "name": "Custom__mdt",  "childRelationships": [], "fields": [';
    const field1 = '{"name": "MDRef__r", "type": "reference", "referenceTo": ["XX_mdt"], "relationshipName": null}';
    const field2 = '{"name": "StringField", "type": "string", "referenceTo": []}';
    const sobject1 = `${header}${field1},${field2}]}`;
    const objDef = declGenerator.generateSObjectDefinition(JSON.parse(sobject1));
    const sobjectFolder = process.cwd();
    const gen = new TypingGenerator();
    typePath = gen.generateType(sobjectFolder, objDef);
    expect(fs.existsSync(typePath));
    const typeText = fs.readFileSync(typePath, 'utf8');
    expect(typeText).to.include('@salesforce/schema/Custom__mdt.MDRef__r');
    expect(typeText).to.include('const MDRef__r:any;');
    expect(typeText).to.include('export default MDRef__r;');
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
    const objDef = declGenerator.generateSObjectDefinition(JSON.parse(sobject1));

    const sobjectFolder = process.cwd();
    const gen = new TypingGenerator();
    typePath = gen.generateType(sobjectFolder, objDef);
    expect(fs.existsSync(typePath));
    const typeText = fs.readFileSync(typePath, 'utf8');
    expect(typeText).to.include('declare module "@salesforce/schema/PE1__e.StringField" ');
    expect(typeText).to.include('const StringField:string;');
    expect(typeText).to.include('export default StringField;');

    expect(typeText).to.include('declare module "@salesforce/schema/PE1__e.DoubleField"');
    expect(typeText).to.include('const DoubleField:number;');
    expect(typeText).to.include('export default DoubleField;');
  });
});
