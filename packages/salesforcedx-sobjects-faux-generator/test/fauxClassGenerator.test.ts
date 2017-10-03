import * as chai from 'chai';
import * as fs from 'fs';
import { FauxClassGenerator } from '../src/generator/fauxClassGenerator';

const expect = chai.expect;

describe('SObject faux class generator', function() {
  let classPath = '';

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

  it('Should generate a faux class with all types of fields that can be in custom SObjects', async () => {
    const fieldsHeader = '{ "name": "Custom__c", "fields": [ ';
    const closeHeader = ' ], "childRelationships": [] }';

    const fields: string[] = [
      '{"name": "Foo1", "type": "string", "referenceTo": []}',
      '{"name": "Foo2", "type" : "double", "referenceTo": []}',
      '{"name": "Foo3", "type" : "boolean", "referenceTo": []}',
      '{"name": "Foo4", "type" : "currency", "referenceTo": []}',
      '{"name": "Foo5", "type" : "date", "referenceTo": []}',
      '{"name": "Foo6", "type" : "datetime", "referenceTo": []}',
      '{"name": "Foo7", "type" : "email", "referenceTo": []}',
      '{"name": "Foo8", "type" : "location", "referenceTo": []}',
      '{"name": "Foo9", "type" : "percent", "referenceTo": []}',
      '{"name": "Foo10", "type" : "picklist", "referenceTo": []}',
      '{"name": "Foo11", "type" : "multipicklist", "referenceTo": []}',
      '{"name": "Foo12", "type" : "textarea", "referenceTo": []}',
      '{"name": "Foo13", "type" : "encryptedstring", "referenceTo": []}',
      '{"name": "Foo14", "type" : "url", "referenceTo": []}',
      '{"name": "Foo15", "type" : "id", "referenceTo": []}'
    ];

    const fieldsString = fields.join(',');
    const sobject1 = `${fieldsHeader}${fieldsString}${closeHeader}`;

    const sobjectFolder = process.cwd();
    const gen: FauxClassGenerator = new FauxClassGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include('String Foo1;');
    expect(classText).to.include('Double Foo2;');
    expect(classText).to.include('Boolean Foo3;');
    expect(classText).to.include('Decimal Foo4;');
    expect(classText).to.include('Date Foo5;');
    expect(classText).to.include('Datetime Foo6;');
    expect(classText).to.include('String Foo7;');
    expect(classText).to.include('Location Foo8;');
    expect(classText).to.include('Double Foo9;');
    expect(classText).to.include('String Foo10;');
    expect(classText).to.include('String Foo11;');
    expect(classText).to.include('String Foo12;');
    expect(classText).to.include('String Foo13;');
    expect(classText).to.include('String Foo14;');
    expect(classText).to.include('Id Foo15;');
  });

  it('Should generate a faux class with all types of fields that show only in standard SObjects', async () => {
    const fieldsHeader = '{ "name": "Custom__c", "fields": [ ';
    const closeHeader = ' ], "childRelationships": [] }';

    const fields: string[] = [
      '{"name": "Foo1", "type": "base64", "referenceTo": []}',
      '{"name": "Foo2", "type" : "address", "referenceTo": []}',
      '{"name": "Foo3", "type" : "int", "referenceTo": []}',
      '{"name": "Foo4", "type" : "anyType", "referenceTo": []}',
      '{"name": "Foo5", "type" : "combobox", "referenceTo": []}'
    ];

    const fieldsString = fields.join(',');
    const sobject1 = `${fieldsHeader}${fieldsString}${closeHeader}`;

    const sobjectFolder = process.cwd();
    const gen: FauxClassGenerator = new FauxClassGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include('Blob Foo1;');
    expect(classText).to.include('Address Foo2;');
    expect(classText).to.include('Integer Foo3;');
    expect(classText).to.include('Object Foo4;');
    expect(classText).to.include('String Foo5;');
  });

  it('Should create a a valid class with a field and relationship', async () => {
    const field1 = '{"name": "Foo", "type": "string", "referenceTo": []}';
    const relation1 =
      '{"name": "Account__c", "referenceTo": ["Account"], "relationshipName": "Account__r"}';
    const sobject1: string =
      '{ "name": "Custom__c", "fields": [ ' +
      field1 +
      ',' +
      relation1 +
      ' ], "childRelationships": [] }';
    const sobjectFolder = process.cwd();
    const gen: FauxClassGenerator = new FauxClassGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include('String Foo;');
    expect(classText).to.include('Account Account__r');
    expect(classText).to.include('Id Account__c');
  });

  it('Should create a valid class with child relationship', async () => {
    const field1 = '{"name": "Foo", "type": "string", "referenceTo": []}';
    const childRelation1 =
      '{"childSObject": "Case", "relationshipName": "Case__r"}';
    const sobject1: string =
      '{ "name": "Custom__c", "fields": [ ' +
      field1 +
      ' ], "childRelationships": [' +
      childRelation1 +
      '] }';
    const sobjectFolder = process.cwd();
    const gen: FauxClassGenerator = new FauxClassGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include('List<Case> Case__r');
  });

  it('Should create a valid field name for a child relationship that is missing the relationshipName', async () => {
    const childRelation1 =
      '{"childSObject": "Case", "field": "RelatedCaseId", "relationshipName": null}';
    const sobject1: string =
      '{ "name": "Custom__c",  "childRelationships": [' +
      childRelation1 +
      '] }';
    const sobjectFolder = process.cwd();
    const gen: FauxClassGenerator = new FauxClassGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include('List<Case> RelatedCase;');
  });

  // seems odd, but this can happen due to the childRelationships that don't have a relationshipName

  it('Should create a class that has no duplicate field names', async () => {
    const childRelation1 =
      '{"childSObject": "Case", "relationshipName": "Reference"}';
    const childRelation2 =
      '{"childSObject": "Account", "field": "ReferenceId", "relationshipName": null}';

    const sobject1: string =
      '{ "name": "Custom__c",  "childRelationships": [' +
      childRelation2 +
      ',' +
      childRelation1 +
      '] }';
    const sobjectFolder = process.cwd();
    const gen: FauxClassGenerator = new FauxClassGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include('List<Case> Reference;');
    expect(classText).to.not.include('Account Reference');
  });

  it('Should create a valid field reference to another SObject when missing the relationshipName', async () => {
    const childRelation1 =
      '{"childSObject": "Account", "field": "ReferenceId", "relationshipName": null}';
    const field1 =
      '{"name": "FooId", "type": "string", "referenceTo": ["Account"], "relationshipName": null}';
    const header = '{ "name": "Custom__c",  "childRelationships": [';
    const fieldHeader = '"fields": [';
    const sobject1 = `${header}${childRelation1}],${fieldHeader}${field1}]}`;
    const sobjectFolder = process.cwd();
    const gen: FauxClassGenerator = new FauxClassGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.not.include('null');
    expect(classText).to.include('Account Foo');
    expect(classText).to.include('List<Account> Reference');
  });

  it('Should create a String field type for an external lookup relationship', async () => {
    const field1 =
      '{"name": "ExtRef__c", "type": "reference", "referenceTo": [], "relationshipName": null, "extraTypeInfo": "externallookup"}';
    const header = '{ "name": "Custom__c",  "childRelationships": []';
    const fieldHeader = '"fields": [';
    const sobject1 = `${header},${fieldHeader}${field1}]}`;
    const sobjectFolder = process.cwd();
    const gen: FauxClassGenerator = new FauxClassGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include('String ExtRef__c');
  });

  // Note - hierarchical relationship, many-to-many, and master-detail all look like lookup relationships in terms of
  //  the relevant parts of describe
  // For some of these, can create another test with extra info that is present, but it isn't paid attention to
  // Might be good for completeness in case this other info eventually is relevant, but will  not be addressed currently

  // Note, currently __x (ExternalObject) is not handled by describe (REST or Cli), but is handled by SDD

  it('Should create a valid class for a metadata object with EntityDefinition relationship target', async () => {
    const header =
      '{ "name": "Custom__mdt",  "childRelationships": [], "fields": [';
    const field1 =
      '{"name": "MDRef__c", "type": "reference", "referenceTo": [], "relationshipName": null, "extraTypeInfo": "externallookup"}';
    const field2 = '{"name": "Foo1", "type": "string", "referenceTo": []}';
    const sobject1 = `${header}${field1},${field2}]}`;
    const sobjectFolder = process.cwd();
    const gen: FauxClassGenerator = new FauxClassGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include('String MDRef__c');
  });

  it('Should create a valid class for a metadata object with a __mdt target', async () => {
    const header =
      '{ "name": "Custom__mdt",  "childRelationships": [], "fields": [';
    const field1 =
      '{"name": "MDRef__r", "type": "reference", "referenceTo": ["XX_mdt"], "relationshipName": null}';
    const field2 = '{"name": "Foo1", "type": "string", "referenceTo": []}';
    const sobject1 = `${header}${field1},${field2}]}`;
    const sobjectFolder = process.cwd();
    const gen: FauxClassGenerator = new FauxClassGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include('XX_mdt MDRef__r');
  });

  it('Should create a valid class for a platform event object', async () => {
    const fieldsHeader = '{ "name": "PE1__e", "fields": [ ';
    const closeHeader = ' ], "childRelationships": [] }';

    const fields: string[] = [
      '{"name": "Foo1", "type": "string", "referenceTo": []}',
      '{"name": "Foo2", "type" : "double", "referenceTo": []}'
    ];

    const fieldsString = fields.join(',');
    const sobject1 = `${fieldsHeader}${fieldsString}${closeHeader}`;

    const sobjectFolder = process.cwd();
    const gen: FauxClassGenerator = new FauxClassGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include('String Foo1;');
    expect(classText).to.include('Double Foo2;');
  });
});
