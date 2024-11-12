/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core-bundle';
import { instantiateContext, MockTestOrgData, restoreContext, stubContext } from '@salesforce/core-bundle';
import { projectPaths, WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';
import { standardValueSet } from '@salesforce/source-deploy-retrieve-bundle/lib/src/registry';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { SinonStub, stub } from 'sinon';
import { isNullOrUndefined } from 'util';
import { WorkspaceContext } from '../../../src/context';
import { ComponentUtils } from '../../../src/orgBrowser';
import { OrgAuthInfo } from '../../../src/util';

const $$ = instantiateContext();
const sb = $$.SANDBOX;

const mockFieldData = {
  result: {
    fields: [
      {
        type: 'string',
        relationshipName: undefined,
        name: 'Name__c',
        length: 50
      },
      {
        type: 'email',
        relationshipName: undefined,
        name: 'Email__c',
        length: 100
      },
      {
        type: 'textarea',
        relationshipName: undefined,
        name: 'Notes__c',
        length: 500
      },
      {
        type: 'number',
        relationshipName: undefined,
        name: 'Age__c',
        length: undefined
      }
    ]
  }
};

const expectedfetchAndSaveSObjectFieldsPropertiesResult = {
  status: 0,
  result: [mockFieldData.result.fields]
};

const sObjectDescribeResult = {
  fields: [mockFieldData.result.fields]
};

const expectedFieldList = [
  'Name__c (string(50))',
  'Email__c (email(100))',
  'Notes__c (textarea(500))',
  'Age__c (number)'
];

// tslint:disable:no-unused-expression
describe('get metadata components path', () => {
  let getUsernameStub: SinonStub;
  let metadataFolderStub: SinonStub;
  const cmpUtil = new ComponentUtils();
  const username = 'test-username1@example.com';
  const metadataDirectoryPath = 'test/path/.sfdx';

  beforeEach(() => {
    getUsernameStub = stub(WorkspaceContextUtil.prototype, 'username').returns('test-username1@example.com');
    metadataFolderStub = stub(projectPaths, 'metadataFolder').returns(metadataDirectoryPath);
  });
  afterEach(() => {
    getUsernameStub.restore();
    metadataFolderStub.restore();
  });

  const expectedPath = (fileName: string) => path.join(metadataDirectoryPath, fileName + '.json');

  it('should return the path for a given username and metadata type', async () => {
    const metadataType = 'ApexClass';
    const expectedPathToApexClassFolder = expectedPath(metadataType);
    expect(await cmpUtil.getComponentsPath(metadataType)).to.equal(expectedPathToApexClassFolder);
    expect(metadataFolderStub.called).to.equal(true);
    expect(metadataFolderStub.calledWith(username)).to.equal(false);
  });

  it('should return the path for a given folder', async () => {
    const metadataType = 'Report';
    const folder = 'TestFolder';
    const compPath = await cmpUtil.getComponentsPath(metadataType, folder);

    const expectedPathToReportsFolder = expectedPath(metadataType + '_' + folder);

    expect(compPath).to.equal(expectedPathToReportsFolder);
    expect(metadataFolderStub.called).to.equal(true);
    expect(metadataFolderStub.calledWith(username)).to.equal(false);
  });
});

describe('build metadata components list', () => {
  let readFileStub: SinonStub;
  const cmpUtil = new ComponentUtils();
  beforeEach(() => {
    readFileStub = stub(fs, 'readFileSync');
  });
  afterEach(() => {
    readFileStub.restore();
  });

  it('should return a sorted list of fullNames when given a list of metadata components', async () => {
    const metadataType = 'ApexClass';
    const fileData = JSON.stringify({
      status: 0,
      result: [
        {
          fullName: 'fakeName2',
          type: 'ApexClass',
          manageableState: 'unmanaged'
        },
        {
          fullName: 'fakeName1',
          type: 'ApexClass',
          manageableState: 'unmanaged'
        },
        {
          fullName: 'fakeName3',
          type: 'ApexClass',
          manageableState: 'unmanaged',
          namespacePrefix: 'sf_namespace'
        }
      ]
    });
    const fullNames = cmpUtil.buildComponentsList(metadataType, fileData, undefined);
    if (!isNullOrUndefined(fullNames)) {
      expect(fullNames[0]).to.equal('fakeName1');
      expect(fullNames[1]).to.equal('fakeName2');
      expect(fullNames[2]).to.equal('sf_namespace__fakeName3');
      expect(readFileStub.called).to.equal(false);
    }
  });

  it('should return a sorted list of fullNames when given the metadata components result file path', async () => {
    const filePath = '/test/metadata/ApexClass.json';
    const metadataType = 'ApexClass';
    const fileData = JSON.stringify({
      status: 0,
      result: [
        {
          fullName: 'fakeName2',
          type: 'ApexClass',
          manageableState: 'unmanaged'
        },
        {
          fullName: 'fakeName1',
          type: 'ApexClass',
          manageableState: 'unmanaged'
        },
        {
          fullName: 'fakeName3',
          type: 'ApexClass',
          manageableState: 'unmanaged',
          namespacePrefix: 'sf_namespace'
        }
      ]
    });
    readFileStub.returns(fileData);

    const fullNames = cmpUtil.buildComponentsList(metadataType, undefined, filePath);
    if (!isNullOrUndefined(fullNames)) {
      expect(fullNames[0]).to.equal('fakeName1');
      expect(fullNames[1]).to.equal('fakeName2');
      expect(fullNames[2]).to.equal('sf_namespace__fakeName3');
      expect(readFileStub.called).to.equal(true);
    }
  });

  it('should not return components if they are uneditable', async () => {
    const type = 'ApexClass';
    const states = ['installed', 'released', 'deleted', 'deprecated', 'beta'];
    const fileData = {
      status: 0,
      result: states.map((s, i) => ({
        fullName: `fakeName${i}`,
        type,
        manageableState: s
      }))
    };

    const fullNames = cmpUtil.buildComponentsList(type, JSON.stringify(fileData), undefined);

    expect(fullNames.length).to.equal(0);
  });

  it('should return components that are editable', () => {
    const type = 'CustomObject';
    const validStates = [
      'unmanaged',
      'deprecatedEditable',
      'installedEditable',
      undefined // unpackaged component
    ];

    const fileData = {
      status: 0,
      result: validStates.map((s, i) => ({
        fullName: `fakeName${i}`,
        type,
        manageableState: s
      }))
    };
    const fullNames = cmpUtil.buildComponentsList(type, JSON.stringify(fileData), undefined);

    expect(fullNames).to.deep.equal(['fakeName0', 'fakeName1', 'fakeName2', 'fakeName3']);
  });
});

describe('load metadata components and custom objects fields list', () => {
  let mockConnection: Connection;
  let connectionStub: SinonStub;
  let getComponentsPathStub: SinonStub;
  let getUsernameStub: SinonStub;
  let fileExistsStub: SinonStub;
  let buildComponentsListStub: SinonStub;
  let buildCustomObjectFieldsListStub: SinonStub;
  let fetchAndSaveMetadataComponentPropertiesStub: SinonStub;
  let fetchAndSaveSObjectFieldsPropertiesStub: SinonStub;
  const cmpUtil = new ComponentUtils();
  const defaultOrg = 'defaultOrg@test.com';
  const metadataType = 'ApexClass';
  const metadataTypeCustomObject = 'CustomObject';
  const metadataTypeStandardValueSet = 'StandardValueSet';
  const sObjectName = 'DemoCustomObject';
  const folderName = 'DemoDashboard';
  const metadataTypeDashboard = 'Dashboard';
  const filePath = '/test/metadata/ApexClass.json';
  const fileData = JSON.stringify({
    status: 0,
    result: [
      { fullName: 'fakeName2', type: 'ApexClass' },
      { fullName: 'fakeName1', type: 'ApexClass' }
    ]
  });

  beforeEach(async () => {
    const testData = new MockTestOrgData();
    stubContext($$);
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    mockConnection = await testData.getConnection();
    getComponentsPathStub = sb.stub(ComponentUtils.prototype, 'getComponentsPath').returns(filePath);
    connectionStub = sb.stub(WorkspaceContext.prototype, 'getConnection').resolves(mockConnection);
    getUsernameStub = sb.stub(OrgAuthInfo, 'getUsername').returns('test-username1@example.com');
    fileExistsStub = sb.stub(fs, 'existsSync');
    buildComponentsListStub = sb.stub(ComponentUtils.prototype, 'buildComponentsList');
    buildCustomObjectFieldsListStub = sb.stub(ComponentUtils.prototype, 'buildCustomObjectFieldsList');
    fetchAndSaveMetadataComponentPropertiesStub = sb
      .stub(cmpUtil, 'fetchAndSaveMetadataComponentProperties')
      .resolves(fileData);
    fetchAndSaveSObjectFieldsPropertiesStub = sb
      .stub(cmpUtil, 'fetchAndSaveSObjectFieldsProperties')
      .resolves(mockFieldData);
  });

  afterEach(() => {
    restoreContext($$);
  });

  it('should load metadata components through sfdx-core library if file does not exist', async () => {
    fileExistsStub.returns(false);
    const components = await cmpUtil.loadComponents(defaultOrg, metadataType);
    expect(fetchAndSaveMetadataComponentPropertiesStub.calledOnce).to.equal(true);
    expect(fetchAndSaveMetadataComponentPropertiesStub.calledWith(metadataType, mockConnection, filePath)).to.be.true;
    expect(buildComponentsListStub.calledOnce).to.be.true;
    expect(buildComponentsListStub.calledWith(metadataType, fileData, undefined)).to.be.true;
  });

  it('should load metadata components from json file if the file exists', async () => {
    fileExistsStub.returns(true);
    const components = await cmpUtil.loadComponents(defaultOrg, metadataType);
    expect(fetchAndSaveMetadataComponentPropertiesStub.called).to.equal(false);
    expect(buildComponentsListStub.calledWith(metadataType, undefined, filePath)).to.be.true;
  });

  it('should load metadata components through sfdx-core library if forceRefresh is set to true and file exists', async () => {
    fileExistsStub.returns(true);
    await cmpUtil.loadComponents(defaultOrg, metadataType, undefined, true);
    expect(fetchAndSaveMetadataComponentPropertiesStub.calledOnce).to.be.true;
    expect(fetchAndSaveMetadataComponentPropertiesStub.calledWith(metadataType, mockConnection, filePath)).to.be.true;
    expect(buildComponentsListStub.calledOnce).to.be.true;
    expect(buildComponentsListStub.calledWith(metadataType, fileData, undefined)).to.be.true;
  });

  it('should load metadata components listed under folders of Dashboards through sfdx-core library if file does not exist', async () => {
    fileExistsStub.returns(false);
    const components = await cmpUtil.loadComponents(defaultOrg, metadataTypeDashboard, folderName, undefined);
    expect(fetchAndSaveMetadataComponentPropertiesStub.calledOnce).to.equal(true);
    expect(
      fetchAndSaveMetadataComponentPropertiesStub.calledWith(
        metadataTypeDashboard,
        mockConnection,
        filePath,
        folderName
      )
    ).to.be.true;
    expect(buildComponentsListStub.calledOnce).to.be.true;
    expect(buildComponentsListStub.calledWith(metadataTypeDashboard, fileData, undefined)).to.be.true;
  });

  it('should load metadata components listed under folders of Dashboards from json file if the file exists', async () => {
    fileExistsStub.returns(true);
    const components = await cmpUtil.loadComponents(defaultOrg, metadataTypeDashboard, folderName, undefined);
    expect(fetchAndSaveMetadataComponentPropertiesStub.called).to.equal(false);
    expect(buildComponentsListStub.calledWith(metadataTypeDashboard, undefined, filePath)).to.be.true;
  });

  it('should load sobject fields list through sfdx-core if file does not exist', async () => {
    fileExistsStub.returns(false);
    buildCustomObjectFieldsListStub.returns('');
    const components = await cmpUtil.loadComponents(defaultOrg, metadataTypeCustomObject, sObjectName, undefined);
    expect(fetchAndSaveSObjectFieldsPropertiesStub.called).to.equal(true);
    expect(fetchAndSaveSObjectFieldsPropertiesStub.calledWith(mockConnection, filePath, sObjectName)).to.be.true;
    expect(buildCustomObjectFieldsListStub.called).to.equal(true);
    expect(buildCustomObjectFieldsListStub.calledWith(mockFieldData, filePath)).to.be.true;
  });

  it('should load sobject fields list from json file if the file exists', async () => {
    fileExistsStub.returns(true);
    buildCustomObjectFieldsListStub.returns('');
    const components = await cmpUtil.loadComponents(defaultOrg, metadataTypeCustomObject, sObjectName, undefined);
    expect(fetchAndSaveSObjectFieldsPropertiesStub.called).to.equal(false);
    expect(buildCustomObjectFieldsListStub.called).to.equal(true);
    expect(buildCustomObjectFieldsListStub.calledWith(undefined, filePath)).to.be.true;
  });

  it('should load sobject fields list through sfdx-core if forceRefresh is set to true and file exists', async () => {
    fileExistsStub.returns(true);
    buildCustomObjectFieldsListStub.returns('');
    const components = await cmpUtil.loadComponents(defaultOrg, metadataTypeCustomObject, sObjectName, true);
    expect(fetchAndSaveSObjectFieldsPropertiesStub.called).to.equal(true);
    expect(fetchAndSaveSObjectFieldsPropertiesStub.calledWith(mockConnection, filePath, sObjectName)).to.be.true;
    expect(buildCustomObjectFieldsListStub.called).to.equal(true);
    expect(buildCustomObjectFieldsListStub.calledWith(mockFieldData, filePath)).to.be.true;
  });

  it('should validate that buildCustomObjectFieldsList() returns correctly formatted fields', async () => {
    // const fieldData = JSON.stringify(mockFieldData);
    const formattedFields = expectedFieldList;
    buildCustomObjectFieldsListStub.returns(formattedFields);
    const components = await cmpUtil.loadComponents(defaultOrg, metadataTypeCustomObject, sObjectName);
    expect(JSON.stringify(components)).to.equal(JSON.stringify(formattedFields));
  });

  it('should return hardcoded list of StandardValueSet fullNames', async () => {
    const components = await cmpUtil.loadComponents(defaultOrg, metadataTypeStandardValueSet);
    expect(JSON.stringify(components)).to.equal(JSON.stringify(standardValueSet.fullnames));
  });
});

describe('fetch metadata components and custom objects fields list', () => {
  let mockConnection: Connection;
  let connectionStub: SinonStub;
  let fileExistsStub: SinonStub;
  let fetchCustomObjectsFieldsStub: SinonStub;
  let fetchExistingCustomObjectsFieldsStub: SinonStub;
  let fetchMetadataComponentsStub: SinonStub;
  let fetchExistingMetadataComponentsStub: SinonStub;
  let getComponentsPathStub: SinonStub;
  const cmpUtil = new ComponentUtils();
  const defaultOrg = 'defaultOrg@test.com';
  const customObjectMetadataType = 'CustomObject';
  const metadataType = 'ApexClass';
  const sObject = 'DemoCustomObject';
  const filePath = '/test/metadata/CustomObject_DemoCustomObject.json';
  const fieldsList = expectedFieldList;

  beforeEach(async () => {
    const testData = new MockTestOrgData();
    stubContext($$);
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    mockConnection = await testData.getConnection();
    fileExistsStub = sb.stub(fs, 'existsSync');
    connectionStub = sb.stub(WorkspaceContext.prototype, 'getConnection').resolves(mockConnection);
    getComponentsPathStub = sb.stub(ComponentUtils.prototype, 'getComponentsPath').returns(filePath);
    fetchCustomObjectsFieldsStub = sb.stub(ComponentUtils.prototype, 'fetchCustomObjectsFields').resolves(fieldsList);
    fetchExistingCustomObjectsFieldsStub = sb
      .stub(ComponentUtils.prototype, 'fetchExistingCustomObjectsFields')
      .resolves(fieldsList);
    fetchMetadataComponentsStub = sb.stub(ComponentUtils.prototype, 'fetchMetadataComponents').resolves('');
    fetchExistingMetadataComponentsStub = sb
      .stub(ComponentUtils.prototype, 'fetchExistingMetadataComponents')
      .resolves('');
  });

  afterEach(() => {
    restoreContext($$);
  });

  it('should call fetchCustomObjectsFields() to fetch fields of a sobject if json file does not exist', async () => {
    fileExistsStub.returns(false);
    const components = await cmpUtil.loadComponents(defaultOrg, customObjectMetadataType, sObject);
    expect(fetchCustomObjectsFieldsStub.called).to.equal(true);
    expect(fetchCustomObjectsFieldsStub.calledWith(mockConnection, filePath, sObject)).to.be.true;
  });

  it('should call fetchExistingCustomObjectsFields() to fetch fields of a sobject if json file exists', async () => {
    fileExistsStub.returns(true);
    const components = await cmpUtil.loadComponents(defaultOrg, customObjectMetadataType, sObject);
    expect(fetchExistingCustomObjectsFieldsStub.called).to.equal(true);
    expect(fetchExistingCustomObjectsFieldsStub.calledWith(filePath)).to.be.true;
  });

  it('should call fetchCustomObjectsFields() to fetch fields of a sobject if json file exists and force is set to true', async () => {
    fileExistsStub.returns(true);
    const components = await cmpUtil.loadComponents(defaultOrg, customObjectMetadataType, sObject, true);
    expect(fetchCustomObjectsFieldsStub.called).to.be.true;
    expect(fetchCustomObjectsFieldsStub.calledWith(mockConnection, filePath, sObject)).to.be.true;
  });

  it('should call fetchMetadataComponents() to fetch metadata components if json file does not exist', async () => {
    fileExistsStub.returns(false);
    const components = await cmpUtil.loadComponents(defaultOrg, metadataType);
    expect(fetchMetadataComponentsStub.called).to.equal(true);
    expect(fetchMetadataComponentsStub.calledWith(metadataType, mockConnection, filePath, undefined)).to.be.true;
  });

  it('should call fetchExistingMetadataComponents() to fetch metadata components if json file exists', async () => {
    fileExistsStub.returns(true);
    const components = await cmpUtil.loadComponents(defaultOrg, metadataType);
    expect(fetchExistingMetadataComponentsStub.called).to.equal(true);
    expect(fetchExistingMetadataComponentsStub.calledWith(metadataType, filePath)).to.be.true;
  });

  it('should call fetchMetadataComponents() to fetch metadata components if json file exists and force is set to true', async () => {
    fileExistsStub.returns(true);
    const components = await cmpUtil.loadComponents(defaultOrg, metadataType, undefined, true);
    expect(fetchMetadataComponentsStub.called).to.be.true;
    expect(fetchMetadataComponentsStub.calledWith(metadataType, mockConnection, filePath, undefined)).to.be.true;
  });
});

describe('fetch fields of a standard or custom object', () => {
  let mockConnection: Connection;
  let connectionStub: SinonStub;
  let fetchAndSaveSObjectFieldsPropertiesStub: SinonStub;
  let buildCustomObjectFieldsListStub: SinonStub;
  const cmpUtil = new ComponentUtils();
  const metadataType = 'CustomObject';
  const sObject = 'DemoCustomObject';
  const filePath = '/test/metadata/CustomObject_DemoCustomObject.json';
  const fieldData = JSON.stringify(mockFieldData);
  const fieldsList = expectedFieldList;

  beforeEach(async () => {
    const testData = new MockTestOrgData();
    stubContext($$);
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    mockConnection = await testData.getConnection();
    fetchAndSaveSObjectFieldsPropertiesStub = sb
      .stub(cmpUtil, 'fetchAndSaveSObjectFieldsProperties')
      .resolves(fieldData);
    buildCustomObjectFieldsListStub = sb
      .stub(ComponentUtils.prototype, 'buildCustomObjectFieldsList')
      .returns(fieldsList);
    connectionStub = sb.stub(WorkspaceContext.prototype, 'getConnection').resolves(mockConnection);
  });

  afterEach(() => {
    restoreContext($$);
  });

  it('should call fetchAndSaveSObjectFieldsProperties() and buildCustomObjectFields() while fetching custom object fields if file does not exist or forceRefresh is set to true', async () => {
    const fieldList = await cmpUtil.fetchCustomObjectsFields(mockConnection, filePath, sObject);
    expect(fetchAndSaveSObjectFieldsPropertiesStub.called).to.equal(true);
    expect(fetchAndSaveSObjectFieldsPropertiesStub.calledWith(mockConnection, filePath, sObject)).to.be.true;
    expect(buildCustomObjectFieldsListStub.called).to.equal(true);
    expect(buildCustomObjectFieldsListStub.calledWith(fieldData, filePath)).to.be.true;
  });

  it('should validate that buildCustomObjectFields() is called while fetching custom object fields if file exists', async () => {
    const fieldList = await cmpUtil.fetchExistingCustomObjectsFields(filePath);
    expect(buildCustomObjectFieldsListStub.called).to.equal(true);
    expect(buildCustomObjectFieldsListStub.calledWith(undefined, filePath)).to.be.true;
  });

  it('should validate that fetchAndSaveSObjectFieldsProperties() is not called while fetching custom object fields if file exists', async () => {
    const fieldList = await cmpUtil.fetchExistingCustomObjectsFields(filePath);
    expect(fetchAndSaveSObjectFieldsPropertiesStub.called).to.equal(false);
  });
});

describe('retrieve fields data of a sobject to write in a json file designated for the sobject', () => {
  let mockConnection: Connection;
  let connectionStub: SinonStub;
  let describeSObjectFieldsStub: SinonStub;
  let writeFileStub: SinonStub;
  const cmpUtil = new ComponentUtils();
  const sObjectName = 'DemoAccount';
  const filePath = '/test/metadata/CustomObject_DemoAccount.json';

  beforeEach(async () => {
    const testData = new MockTestOrgData();
    stubContext($$);
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    mockConnection = await testData.getConnection();
    connectionStub = sb.stub(WorkspaceContext.prototype, 'getConnection').resolves(mockConnection);
    describeSObjectFieldsStub = sb.stub(mockConnection, 'describe').resolves(sObjectDescribeResult);
    writeFileStub = sb.stub(fs, 'writeFileSync').returns({});
  });

  afterEach(() => {
    restoreContext($$);
  });

  it('should validate that fetchAndSaveSObjectFieldsProperties() writes a json file at sobject components path', async () => {
    const sObjectFields = await cmpUtil.fetchAndSaveSObjectFieldsProperties(mockConnection, filePath, sObjectName);
    expect(writeFileStub.called).to.equal(true);
    expect(writeFileStub.calledWith(filePath)).to.be.true;
  });

  it('should validate that fetchAndSaveSObjectFieldsProperties() returns the correctly formatted result file', async () => {
    const sObjectFields = await cmpUtil.fetchAndSaveSObjectFieldsProperties(mockConnection, filePath, sObjectName);
    expect(sObjectFields).to.equal(JSON.stringify(expectedfetchAndSaveSObjectFieldsPropertiesResult, null, 2));
    expect(JSON.parse(sObjectFields).result.length).to.equal(
      expectedfetchAndSaveSObjectFieldsPropertiesResult.result.length
    );
  });
});
