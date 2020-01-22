import * as chai from 'chai';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import { join } from 'path';
import { rm } from 'shelljs';
import { SOBJECTS_DIR } from '../../src';
import { CUSTOMOBJECTS_DIR, STANDARDOBJECTS_DIR } from '../../src/constants';
import { SObjectCategory } from '../../src/describe';
import { FauxClassGenerator } from '../../src/generator/fauxClassGenerator';
import { nls } from '../../src/messages';

const expect = chai.expect;

describe('SObject faux class generator', () => {
  let classPath = '';

  function getGenerator(): FauxClassGenerator {
    const emitter: EventEmitter = new EventEmitter();
    return new FauxClassGenerator(emitter);
  }

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

  it('Should generate a faux class with a proper header comment', async () => {
    const fieldsHeader = '{ "name": "Custom__c", "fields": [ ';
    const closeHeader = ' ], "childRelationships": [] }';

    const sobject1 = `${fieldsHeader}${closeHeader}`;

    const sobjectFolder = process.cwd();
    const gen = getGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include(
      nls.localize('class_header_generated_comment')
    );
  });

  it('Should generate a faux class as read-only', async () => {
    const fieldsHeader = '{ "name": "Custom__c", "fields": [ ';
    const closeHeader = ' ], "childRelationships": [] }';

    const sobject1 = `${fieldsHeader}${closeHeader}`;

    const sobjectFolder = process.cwd();
    const gen = getGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const stat = fs.lstatSync(classPath);
    const expectedMode = parseInt('100444', 8);
    expect(stat.mode).to.equal(expectedMode);
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

    const sobjectFolder = process.cwd();
    const gen = getGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include('String StringField;');
    expect(classText).to.include('Double DoubleField;');
    expect(classText).to.include('Boolean BooleanField;');
    expect(classText).to.include('Decimal CurrencyField;');
    expect(classText).to.include('Date DateField;');
    expect(classText).to.include('Datetime DatetimeField;');
    expect(classText).to.include('String EmailField;');
    expect(classText).to.include('Location LocationField;');
    expect(classText).to.include('Double PercentField;');
    expect(classText).to.include('String PicklistField;');
    expect(classText).to.include('String MultipicklistField;');
    expect(classText).to.include('String TextareaField;');
    expect(classText).to.include('String EncryptedField;');
    expect(classText).to.include('String UrlField;');
    expect(classText).to.include('Id IdField;');
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

    const sobjectFolder = process.cwd();
    const gen = getGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include('Blob BaseField;');
    expect(classText).to.include('Address AddressField;');
    expect(classText).to.include('Integer IntField;');
    expect(classText).to.include('Object AnytypeField;');
    expect(classText).to.include('String ComboboxField;');
  });

  it('Should create a a valid class with a field and relationship', async () => {
    const field1 =
      '{"name": "StringField", "type": "string", "referenceTo": []}';
    const relation1 =
      '{"name": "Account__c", "referenceTo": ["Account"], "relationshipName": "Account__r"}';
    const sobject1: string =
      '{ "name": "Custom__c", "fields": [ ' +
      field1 +
      ',' +
      relation1 +
      ' ], "childRelationships": [] }';
    const sobjectFolder = process.cwd();
    const gen = getGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include('String StringField;');
    expect(classText).to.include('Account Account__r');
    expect(classText).to.include('Id Account__c');
  });

  it('Should create a valid class with child relationship', async () => {
    const field1 =
      '{"name": "StringField", "type": "string", "referenceTo": []}';
    const childRelation1 =
      '{"childSObject": "Case", "relationshipName": "Case__r"}';
    const sobject1: string =
      '{ "name": "Custom__c", "fields": [ ' +
      field1 +
      ' ], "childRelationships": [' +
      childRelation1 +
      '] }';
    const sobjectFolder = process.cwd();
    const gen = getGenerator();
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
    const gen = getGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include('List<Case> RelatedCase;');
  });

  // seems odd, but this can happen due to the childRelationships that don't have a relationshipName

  /* it('Should create a class that has no duplicate field names', async () => {
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
    const gen = getGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include('List<Case> Reference;');
    expect(classText).to.not.include('Account Reference');
  }); */

  it('Should create a valid field reference to another SObject when missing the relationshipName', async () => {
    const childRelation1 =
      '{"childSObject": "Account", "field": "ReferenceId", "relationshipName": null}';
    const field1 =
      '{"name": "AccountFieldId", "type": "string", "referenceTo": ["Account"], "relationshipName": null}';
    const header = '{ "name": "Custom__c",  "childRelationships": [';
    const fieldHeader = '"fields": [';
    const sobject1 = `${header}${childRelation1}],${fieldHeader}${field1}]}`;
    const sobjectFolder = process.cwd();
    const gen = getGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.not.include('null');
    expect(classText).to.include('Account AccountField');
    expect(classText).to.include('List<Account> Reference');
  });

  it('Should create a String field type for an external lookup relationship', async () => {
    const field1 =
      '{"name": "ExtRef__c", "type": "reference", "referenceTo": [], "relationshipName": null, "extraTypeInfo": "externallookup"}';
    const header = '{ "name": "Custom__c",  "childRelationships": []';
    const fieldHeader = '"fields": [';
    const sobject1 = `${header},${fieldHeader}${field1}]}`;
    const sobjectFolder = process.cwd();
    const gen = getGenerator();
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
    const field2 =
      '{"name": "StringField", "type": "string", "referenceTo": []}';
    const sobject1 = `${header}${field1},${field2}]}`;
    const sobjectFolder = process.cwd();
    const gen = getGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include('String MDRef__c');
  });

  /* it('Should create a valid class for a metadata object with a __mdt target', async () => {
    const header =
      '{ "name": "Custom__mdt",  "childRelationships": [], "fields": [';
    const field1 =
      '{"name": "MDRef__r", "type": "reference", "referenceTo": ["XX_mdt"], "relationshipName": null}';
    const field2 =
      '{"name": "StringField", "type": "string", "referenceTo": []}';
    const sobject1 = `${header}${field1},${field2}]}`;
    const sobjectFolder = process.cwd();
    const gen = getGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include('XX_mdt MDRef__r');
  }); */

  it('Should create a valid class for a platform event object', async () => {
    const fieldsHeader = '{ "name": "PE1__e", "fields": [ ';
    const closeHeader = ' ], "childRelationships": [] }';

    const fields: string[] = [
      '{"name": "StringField", "type": "string", "referenceTo": []}',
      '{"name": "DoubleField", "type" : "double", "referenceTo": []}'
    ];

    const fieldsString = fields.join(',');
    const sobject1 = `${fieldsHeader}${fieldsString}${closeHeader}`;

    const sobjectFolder = process.cwd();
    const gen = getGenerator();
    classPath = await gen.generateFauxClass(
      sobjectFolder,
      JSON.parse(sobject1)
    );
    expect(fs.existsSync(classPath));
    const classText = fs.readFileSync(classPath, 'utf8');
    expect(classText).to.include('String StringField;');
    expect(classText).to.include('Double DoubleField;');
  });

  describe('Clean SObject Folders', () => {
    const gen = getGenerator();
    const sobjectsFolder = join(process.cwd(), SOBJECTS_DIR);
    const standardFolder = join(sobjectsFolder, STANDARDOBJECTS_DIR);
    const customFolder = join(sobjectsFolder, CUSTOMOBJECTS_DIR);

    beforeEach(() => {
      fs.mkdirSync(sobjectsFolder);
      fs.mkdirSync(standardFolder);
      fs.mkdirSync(customFolder);
    });

    afterEach(() => {
      if (fs.existsSync(sobjectsFolder)) {
        rm('-rf', sobjectsFolder);
      }
    });

    it('Should remove standardObjects folder when category is STANDARD', () => {
      gen.cleanupSObjectFolders(sobjectsFolder, SObjectCategory.STANDARD);
      expect(fs.existsSync(customFolder));
      expect(!fs.existsSync(standardFolder));
    });

    it('Should remove customObjects folder when category is CUSTOM', () => {
      gen.cleanupSObjectFolders(sobjectsFolder, SObjectCategory.CUSTOM);
      expect(!fs.existsSync(customFolder));
      expect(fs.existsSync(standardFolder));
    });

    it('Should remove base sobjects folder when category is ALL', () => {
      gen.cleanupSObjectFolders(sobjectsFolder, SObjectCategory.STANDARD);
      expect(!fs.existsSync(customFolder));
      expect(!fs.existsSync(standardFolder));
    });
  });
});
