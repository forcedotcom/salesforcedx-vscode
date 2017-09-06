import * as chai from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { FauxClassGenerator } from '../src/generator/fauxClassGenerator';

const expect = chai.expect;

describe('generate fields set', function() {
  it('generated faux class should contain the proper fields', function() {
    const sobject1 =
      '{ "name": "Sobject1", "fields": [ {"name": "Foo", "type": "string", "referenceTo": []} ], "childRelationships": [] }';
    const gen: FauxClassGenerator = new FauxClassGenerator();
    const classText = gen.generateFauxClassText(JSON.parse(sobject1));
    expect(classText).to.include('String Foo;');
  });

  it('generated faux class should create file with correct fields', async function(): Promise<
    void
  > {
    const field1 = '{"name": "Foo", "type": "string", "referenceTo": []}';
    const field2 = '{"name": "Foo2", "type" : "boolean", "referenceTo": []}';
    const sobject1 =
      '{ "name": "Custom__c", "fields": [ ' +
      field1 +
      ',' +
      field2 +
      ' ], "childRelationships": [] }';
    const sobjectFolder = './';
    const gen: FauxClassGenerator = new FauxClassGenerator();
    const classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include('String Foo;');
  });
});

describe('generate relationship tests', function() {
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
    const classPath = await gen.generateFauxClass(
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
    const classPath = await gen.generateFauxClass(
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
    const classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include('Case RelatedCase;');
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
    const classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include('List<Case> Reference;');
    expect(classText).to.not.include('Account Reference');
  });
});
