/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { CommandOutput } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { createSandbox, SinonStub, stub } from 'sinon';
import { isNullOrUndefined } from 'util';
import { ForceListMetadataExecutor } from '../../../src/commands';
import { workspaceContext } from '../../../src/context';
import { ComponentUtils } from '../../../src/orgBrowser';
import { getRootWorkspacePath, OrgAuthInfo } from '../../../src/util';

const sb = createSandbox();
const $$ = testSetup();

// tslint:disable:no-unused-expression
describe('get metadata components path', () => {
  let getUsernameStub: SinonStub;
  const rootWorkspacePath = getRootWorkspacePath();
  const cmpUtil = new ComponentUtils();
  const alias = 'test user 1';
  const username = 'test-username1@example.com';

  beforeEach(() => {
    getUsernameStub = stub(OrgAuthInfo, 'getUsername').returns(
      'test-username1@example.com'
    );
  });
  afterEach(() => {
    getUsernameStub.restore();
  });

  function expectedPath(fileName: string) {
    return path.join(
      rootWorkspacePath,
      '.sfdx',
      'orgs',
      username,
      'metadata',
      fileName + '.json'
    );
  }

  it('should return the path for a given username and metadata type', async () => {
    const metadataType = 'ApexClass';
    expect(await cmpUtil.getComponentsPath(metadataType, alias)).to.equal(
      expectedPath(metadataType)
    );
  });

  it('should return the path for a given folder', async () => {
    const metadataType = 'Report';
    const folder = 'TestFolder';
    expect(
      await cmpUtil.getComponentsPath(metadataType, alias, folder)
    ).to.equal(expectedPath(metadataType + '_' + folder));
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
        }
      ]
    });
    const fullNames = cmpUtil.buildComponentsList(
      metadataType,
      fileData,
      undefined
    );
    if (!isNullOrUndefined(fullNames)) {
      expect(fullNames[0]).to.equal('fakeName1');
      expect(fullNames[1]).to.equal('fakeName2');
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
        }
      ]
    });
    readFileStub.returns(fileData);

    const fullNames = cmpUtil.buildComponentsList(
      metadataType,
      undefined,
      filePath
    );
    if (!isNullOrUndefined(fullNames)) {
      expect(fullNames[0]).to.equal('fakeName1');
      expect(fullNames[1]).to.equal('fakeName2');
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

    const fullNames = cmpUtil.buildComponentsList(
      type,
      JSON.stringify(fileData),
      undefined
    );

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
    const fullNames = cmpUtil.buildComponentsList(
      type,
      JSON.stringify(fileData),
      undefined
    );

    expect(fullNames).to.deep.equal([
      'fakeName0',
      'fakeName1',
      'fakeName2',
      'fakeName3'
    ]);
  });
});

describe('load metadata component data', () => {
  let mockConnection: Connection;
  let connectionStub: SinonStub;

  let readFileStub: SinonStub;
  let getUsernameStub: SinonStub;
  let fileExistsStub: SinonStub;
  let buildComponentsStub: SinonStub;
  let buildCustomObjectFieldsListStub: SinonStub;
  let listMetadataTypesStub: SinonStub;
  let writeFileStub: SinonStub;
  let getComponentsPathStub: SinonStub;
  const cmpUtil = new ComponentUtils();
  const defaultOrg = 'defaultOrg@test.com';
  const metadataType = 'ApexClass';
  const filePath = '/test/metadata/ApexClass.json';

  beforeEach(async () => {
    const testData = new MockTestOrgData();
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    readFileStub = sb.stub(fs, 'readFileSync');
    getUsernameStub = sb.stub(OrgAuthInfo, 'getUsername').returns('test-username1@example.com');
    fileExistsStub = sb.stub(fs, 'existsSync');
    buildComponentsStub = sb.stub(ComponentUtils.prototype, 'buildComponentsList');
    buildCustomObjectFieldsListStub = sb.stub(ComponentUtils.prototype, 'buildCustomObjectFieldsList');
    writeFileStub = sb.stub(fs, 'writeFileSync');
    getComponentsPathStub = sb.stub(
      ComponentUtils.prototype,
      'getComponentsPath'
    ).returns(filePath);
    connectionStub = sb.stub(workspaceContext, 'getConnection').resolves(mockConnection);
    listMetadataTypesStub = sb.stub(cmpUtil, 'listMetadataTypes');
  });

  afterEach(() => {
    sb.restore();
  });

  it('should load metadata components through jsforce library if file does not exist', async () => {
    fileExistsStub.returns(false);
    const fileData = JSON.stringify({
      status: 0,
      result: [
        { fullName: 'fakeName2', type: 'ApexClass' },
        { fullName: 'fakeName1', type: 'ApexClass' }
      ]
    });
    listMetadataTypesStub.resolves(fileData);
    const components = await cmpUtil.loadComponents(defaultOrg, metadataType);
    expect(listMetadataTypesStub.called).to.equal(true);
    expect(buildComponentsStub.calledWith(metadataType, fileData, undefined)).to
      .be.true;
  });

  it('should load metadata components from file if file exists', async () => {
    fileExistsStub.returns(true);
    const components = await cmpUtil.loadComponents(defaultOrg, metadataType);
    expect(listMetadataTypesStub.called).to.equal(false);
    expect(buildComponentsStub.calledWith(metadataType, undefined, filePath)).to
      .be.true;
  });

  it('should load components through jsforce if file exists and force is set to true', async () => {
    fileExistsStub.returns(true);
    await cmpUtil.loadComponents(defaultOrg, metadataType, undefined, true);
    expect(listMetadataTypesStub.calledOnce).to.be.true;
  });

  it('should validate that buildCustomObjectFieldsList() is called when file exists', async () => {
    fileExistsStub.returns(true);
    buildCustomObjectFieldsListStub.returns('');

    const components = await cmpUtil.loadComponents(defaultOrg, 'CustomObject', 'DemoCustomObject', undefined);
    expect(buildCustomObjectFieldsListStub.called).to.equal(true);
    // expect(buildCustomObjectFieldsListStub.calledWith('DemoCustomObject', defaultOrg, filePath)).to.be.true;
    expect(buildCustomObjectFieldsListStub.calledWith(undefined, filePath)).to.be.true;
  });

  it('should validate that buildCustomObjectFieldsList() returns correctly formatted fields', async () => {
    const fieldData = JSON.stringify({
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
    });
    const formattedFields = [
      'Name__c (string(50))',
      'Email__c (email(100))',
      'Notes__c (textarea(500))',
      'Age__c (number)'
    ];
    buildCustomObjectFieldsListStub.returns(formattedFields);

    const components = await cmpUtil.loadComponents(defaultOrg, 'CustomObject', 'DemoCustomObject', undefined);
    expect(JSON.stringify(components)).to.equal(JSON.stringify(formattedFields));
  });
});
