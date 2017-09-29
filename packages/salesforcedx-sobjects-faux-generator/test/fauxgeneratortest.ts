import * as chai from 'chai';
import * as fs from 'fs';
import { FauxClassGenerator } from '../src/generator/fauxClassGenerator';

const expect = chai.expect;

describe('generate fields set', function() {
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

  it('generated faux class should contain the proper fields', function() {
    const sobject1 =
      '{ "name": "Sobject1", "fields": [ {"name": "Foo", "type": "string", "referenceTo": []} ], "childRelationships": [] }';
    const gen: FauxClassGenerator = new FauxClassGenerator();
    const classText = gen.generateFauxClassText(JSON.parse(sobject1));
    expect(classText).to.include('String Foo;');
  });

  it('generated faux class should create file with variousfields', async function(): Promise<
    void
  > {
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
      '{"name": "Foo14", "type" : "url", "referenceTo": []}'
    ];

    const fieldsString = fields.join(',');
    const sobject1 = `${fieldsHeader}${fieldsString}${closeHeader}`;

    const sobjectFolder = './';
    const gen: FauxClassGenerator = new FauxClassGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include('String Foo1;');
    expect(classText).to.include('Decimal Foo2;');
    expect(classText).to.include('Boolean Foo3;');
    expect(classText).to.include('Currency Foo4;');
    expect(classText).to.include('Date Foo5;');
    expect(classText).to.include('Datetime Foo6;');
    expect(classText).to.include('Email Foo7;');
    expect(classText).to.include('Location Foo8;');
    expect(classText).to.include('Decimal Foo9;');
    expect(classText).to.include('String Foo10;');
    expect(classText).to.include('String Foo11;');
    expect(classText).to.include('String Foo12;');
    expect(classText).to.include('String Foo13;');
    expect(classText).to.include('String Foo14;');
  });
});

describe('generate relationship tests', function() {
  let classPath = '';
  afterEach(() => {
    if (classPath) {
      fs.unlinkSync(classPath);
      classPath = '';
    }
  });

  it('generated faux class should create file with relationship', async function(): Promise<
    void
  > {
    const field1 = '{"name": "Foo", "type": "string", "referenceTo": []}';
    const relation1 =
      '{"name": "Account__c", "referenceTo": ["Account"], "relationshipName": "Account__r"}';
    const sobject1: string =
      '{ "name": "Custom__c", "fields": [ ' +
      field1 +
      ',' +
      relation1 +
      ' ], "childRelationships": [] }';
    const sobjectFolder = './';
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

  it('generated faux class should create file with child relationship', async function(): Promise<
    void
  > {
    const field1 = '{"name": "Foo", "type": "string", "referenceTo": []}';
    const childRelation1 =
      '{"childSObject": "Case", "relationshipName": "Case__r"}';
    const sobject1: string =
      '{ "name": "Custom__c", "fields": [ ' +
      field1 +
      ' ], "childRelationships": [' +
      childRelation1 +
      '] }';
    const sobjectFolder = './';
    const gen: FauxClassGenerator = new FauxClassGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include('List<Case> Case__r');
  });

  it('generated faux class with odd no name relationship should work', async function(): Promise<
    void
  > {
    const childRelation1 =
      '{"childSObject": "Case", "field": "RelatedCaseId", "relationshipName": null}';
    const sobject1: string =
      '{ "name": "Custom__c",  "childRelationships": [' +
      childRelation1 +
      '] }';
    const sobjectFolder = './';
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

  it('generated faux class should not generate duplicate names', async function(): Promise<
    void
  > {
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
    const sobjectFolder = './';
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

  it('faux class generator should handle relationships missing the relationshipName', async function(): Promise<
    void
  > {
    const childRelation1 =
      '{"childSObject": "Account", "field": "ReferenceId", "relationshipName": null}';
    const field1 =
      '{"name": "FooId", "type": "string", "referenceTo": ["Account"], "relationshipName": null}';
    const header = '{ "name": "Custom__c",  "childRelationships": [';
    const fieldHeader = '"fields": [';
    const sobject1 = `${header}${childRelation1}],${fieldHeader}${field1}]}`;
    const sobjectFolder = './';
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
});
