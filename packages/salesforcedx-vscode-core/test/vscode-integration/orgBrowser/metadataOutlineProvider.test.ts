/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { fail } from 'assert';
import { expect } from 'chai';
import { SinonStub, stub } from 'sinon';
import { nls } from '../../../src/messages';
import {
  BrowserNode,
  ComponentUtils,
  MetadataOutlineProvider,
  NodeType,
  parseErrors,
  TypeUtils
} from '../../../src/orgBrowser';

/* tslint:disable:no-unused-expression */
describe('load org browser tree outline', () => {
  const username = 'test-username@test1234.com';
  let metadataProvider: MetadataOutlineProvider;
  let loadComponentsStub: SinonStub;
  let getTypesStub: SinonStub;

  beforeEach(() => {
    metadataProvider = new MetadataOutlineProvider(username);
    loadComponentsStub = stub(ComponentUtils.prototype, 'loadComponents');
    getTypesStub = stub(MetadataOutlineProvider.prototype, 'getTypes');
  });

  afterEach(() => {
    loadComponentsStub.restore();
    getTypesStub.restore();
  });

  it('should load the root node with default org', async () => {
    const expectedNode = new BrowserNode(username, NodeType.Org);
    const orgNode = await metadataProvider.getChildren();
    expect(orgNode).to.deep.equal([expectedNode]);
  });

  it('should display emptyNode with error message if default org is not set', async () => {
    metadataProvider = new MetadataOutlineProvider(undefined);
    const expectedNode = new BrowserNode(nls.localize('missing_default_org'), NodeType.EmptyNode);
    const orgNode = await metadataProvider.getChildren();
    expect(orgNode).to.deep.equal([expectedNode]);
  });

  it('should load metadata type nodes when tree is created', async () => {
    const metadataInfo = [
      {
        label: 'typeNode1',
        type: NodeType.MetadataType,
        xmlName: 'typeNode1'
      },
      {
        label: 'typeNode2',
        type: NodeType.MetadataType,
        xmlName: 'typeNode2'
      }
    ];
    const expected = getExpected('typeNode1', 'typeNode2', NodeType.MetadataType);
    const orgNode = new BrowserNode(username, NodeType.Org);
    getTypesStub.returns(metadataInfo);
    const typesNodes = await metadataProvider.getChildren(orgNode);
    compareNodes(typesNodes, expected);
  });

  it('should throw error if trouble fetching components', async () => {
    const metadataObject = getMetadataObject('typeNode1');
    const typeNode = new BrowserNode('ApexClass', NodeType.MetadataType, undefined, metadataObject);
    loadComponentsStub.returns(
      Promise.reject(
        JSON.stringify({
          name: 'Should throw an error'
        })
      )
    );

    try {
      await metadataProvider.getChildren(typeNode);
      fail('Should have thrown an error getting the children');
    } catch (e) {
      expect(e.message).to.equal(
        `${nls.localize('error_fetching_metadata')} ${nls.localize('error_org_browser_text')}`
      );
    }
  });

  it('should display emptyNode with error message if no components are present for a given type', async () => {
    const metadataObject = getMetadataObject('typeNode1');
    const typeNode = new BrowserNode('ApexClass', NodeType.MetadataType, undefined, metadataObject);

    const emptyNode = new BrowserNode(nls.localize('empty_components'), NodeType.EmptyNode);
    loadComponentsStub.returns([]);
    const cmpsNodes = await metadataProvider.getChildren(typeNode);
    expect(cmpsNodes).to.deep.equal([emptyNode]);
  });

  it('should display folders and components that live in them when a folder type node is selected', async () => {
    const folder1 = [
      {
        fullName: 'SampleFolder/Sample_Template',
        label: 'Sample_Template',
        type: NodeType.MetadataComponent
      },
      {
        fullName: 'SampleFolder/Sample_Template2',
        label: 'Sample_Template2',
        type: NodeType.MetadataComponent
      }
    ];
    const folder2 = [
      {
        fullName: 'SampleFolder2/Main',
        label: 'Main',
        type: NodeType.MetadataComponent
      }
    ];
    const folders = [
      {
        fullName: 'SampleFolder',
        label: 'SampleFolder',
        type: NodeType.Folder
      },
      {
        fullName: 'SampleFolder2',
        label: 'SampleFolder2',
        type: NodeType.Folder
      }
    ];

    loadComponentsStub.withArgs(username, 'EmailFolder').returns(folders.map(n => n.fullName));
    loadComponentsStub.withArgs(username, 'EmailTemplate', folders[0].fullName).returns(folder1.map(n => n.fullName));
    loadComponentsStub.withArgs(username, 'EmailTemplate', folders[1].fullName).returns(folder2.map(n => n.fullName));

    const metadataObject = getMetadataObject('typeNode1');

    const testNode = new BrowserNode('EmailTemplate', NodeType.MetadataType, undefined, metadataObject);

    const f = await metadataProvider.getChildren(testNode);
    compareNodes(f, folders);

    const f1 = await metadataProvider.getChildren(f[0]);
    compareNodes(f1, folder1);

    const f2 = await metadataProvider.getChildren(f[1]);
    compareNodes(f2, folder2);
  });

  it('should display fields when folder within Custom Objects type is selected', async () => {
    const customObjectBrowserNodes = [
      new BrowserNode('Account', NodeType.Folder, 'Account', undefined),
      new BrowserNode('Asset', NodeType.Folder, 'Asset', undefined),
      new BrowserNode('Book__c', NodeType.Folder, 'Book__c', undefined),
      new BrowserNode('Campaign', NodeType.Folder, 'Campaign', undefined),
      new BrowserNode('Customer Case', NodeType.Folder, 'Customer Case', undefined)
    ];
    const customObjectNames = ['Account', 'Asset', 'Book__c', 'Campaign', 'Customer Case'];
    loadComponentsStub.withArgs(username, 'CustomObject', undefined, false).returns(Promise.resolve(customObjectNames));

    const bookFieldBrowserNodes = [
      new BrowserNode('Id (id)', NodeType.MetadataField, 'Id (id)', undefined),
      new BrowserNode('Owner (reference)', NodeType.MetadataField, 'Owner (reference)', undefined),
      new BrowserNode('IsDeleted (boolean)', NodeType.MetadataField, 'IsDeleted (boolean)', undefined),
      new BrowserNode('Name (string(80))', NodeType.MetadataField, 'Name (string(80))', undefined),
      new BrowserNode('CreatedDate (datetime)', NodeType.MetadataField, 'CreatedDate (datetime)', undefined),
      new BrowserNode('CreatedBy (reference)', NodeType.MetadataField, 'CreatedBy (reference)', undefined),
      new BrowserNode('LastModifiedDate (datetime)', NodeType.MetadataField, 'LastModifiedDate (datetime)', undefined),
      new BrowserNode('LastModifiedBy (reference)', NodeType.MetadataField, 'LastModifiedBy (reference)', undefined),
      new BrowserNode('SystemModstamp (datetime)', NodeType.MetadataField, 'SystemModstamp (datetime)', undefined),
      new BrowserNode('Price__c (currency)', NodeType.MetadataField, 'Price__c (currency)', undefined)
    ];
    const bookFieldNames = [
      'Id (id)',
      'Owner (reference)',
      'IsDeleted (boolean)',
      'Name (string(80))',
      'CreatedDate (datetime)',
      'CreatedBy (reference)',
      'LastModifiedDate (datetime)',
      'LastModifiedBy (reference)',
      'SystemModstamp (datetime)',
      'Price__c (currency)'
    ];
    loadComponentsStub.withArgs(username, 'CustomObject', 'Book__c', false).returns(Promise.resolve(bookFieldNames));

    const customObjectMetadataObject = {
      directoryName: 'objects',
      inFolder: false,
      label: 'Custom Objects',
      metaFile: false,
      suffix: 'object',
      xmlName: 'CustomObject'
    };

    const customObjectNode = new BrowserNode(
      'Custom Objects',
      NodeType.MetadataType,
      'CustomObject',
      customObjectMetadataObject
    );

    const customObjects = await metadataProvider.getChildren(customObjectNode);
    compareNodes(customObjects, customObjectBrowserNodes);

    const fields = await metadataProvider.getChildren(customObjects[2]);
    compareNodes(fields, bookFieldBrowserNodes);
  });

  it('should call loadComponents with force refresh', async () => {
    loadComponentsStub.returns([]);
    const metadataObject = getMetadataObject('typeNode1');
    const node = new BrowserNode('ApexClass', NodeType.MetadataType, undefined, metadataObject);

    await metadataProvider.getChildren(node);
    expect(loadComponentsStub.getCall(0).args[3]).to.be.false;

    await metadataProvider.refresh(node);
    await metadataProvider.getChildren(node);
    expect(loadComponentsStub.getCall(1).args[3]).to.be.true;

    await metadataProvider.getChildren(node);
    expect(loadComponentsStub.getCall(2).args[3]).to.be.false;
  });
});

describe('fetch nodes when org browser (cloud icon) is selected', () => {
  const username = 'test-username@test1234.com';
  let metadataProvider: MetadataOutlineProvider;
  let loadTypesStub: SinonStub;

  beforeEach(() => {
    metadataProvider = new MetadataOutlineProvider(username);
    loadTypesStub = stub(TypeUtils.prototype, 'loadTypes');
  });

  afterEach(() => {
    loadTypesStub.restore();
  });

  it('should throw error if trouble fetching types', async () => {
    const orgNode = new BrowserNode(username, NodeType.Org);
    loadTypesStub.returns(
      Promise.reject(
        JSON.stringify({
          name: 'Should throw an error'
        })
      )
    );
    try {
      await metadataProvider.getChildren(orgNode);
      fail('Should have thrown an error getting the children');
    } catch (e) {
      expect(e.message).to.equal(
        `${nls.localize('error_fetching_metadata')} ${nls.localize('error_org_browser_text')}`
      );
    }
  });

  it('should call loadTypes with force refresh', async () => {
    loadTypesStub.returns([]);
    const usernameStub = stub(MetadataOutlineProvider.prototype, 'getTargetOrgOrAlias').returns(username);
    const node = new BrowserNode(username, NodeType.Org);

    await metadataProvider.getChildren(node);
    expect(loadTypesStub.getCall(0).args[0]).to.be.false;

    await metadataProvider.refresh();
    await metadataProvider.getChildren(node);
    expect(loadTypesStub.getCall(1).args[0]).to.be.true;

    await metadataProvider.getChildren(node);
    expect(loadTypesStub.getCall(2).args[0]).to.be.false;
    usernameStub.restore();
  });
});

describe('load fields or components when folder within metadata type is selected', () => {
  const username = 'test-username@test1234.com';
  let metadataProvider: MetadataOutlineProvider;
  let getComponentsStub: SinonStub;

  beforeEach(() => {
    metadataProvider = new MetadataOutlineProvider(username);
    getComponentsStub = stub(MetadataOutlineProvider.prototype, 'getComponents');
  });

  afterEach(() => {
    getComponentsStub.restore();
  });

  it('should load component nodes when folder within Dashboards type is selected', async () => {
    const expected = getExpected('DashboardA', 'DashboardB', NodeType.MetadataComponent);
    const metadataObject = getMetadataObject('Dashboard Folder');
    getComponentsStub.returns(expected.map(n => n.fullName));
    const dashboardFolderNode = new BrowserNode('Dashboard Folder', NodeType.Folder, 'DashboardFolder', metadataObject);
    const cmpsNodes = await metadataProvider.getChildren(dashboardFolderNode);
    compareNodes(cmpsNodes, expected);
  });

  it('should load component nodes when folder within Documents type is selected', async () => {
    const expected = getExpected('DocumentA', 'DocumentB', NodeType.MetadataComponent);
    const metadataObject = getMetadataObject('Document Folder');
    getComponentsStub.returns(expected.map(n => n.fullName));
    const documentFolderNode = new BrowserNode('Document folder', NodeType.Folder, 'DocumentFolder', metadataObject);
    const cmpsNodes = await metadataProvider.getChildren(documentFolderNode);
    compareNodes(cmpsNodes, expected);
  });

  it('should load component nodes when folder within Email Templates type is selected', async () => {
    const expected = getExpected('TemplateA', 'TemplateB', NodeType.MetadataComponent);
    const metadataObject = getMetadataObject('Email Template Folder');
    getComponentsStub.returns(expected.map(n => n.fullName));
    const emailFolderNode = new BrowserNode('Email Template Folder', NodeType.Folder, 'EmailFolder', metadataObject);
    const cmpsNodes = await metadataProvider.getChildren(emailFolderNode);
    compareNodes(cmpsNodes, expected);
  });

  it('should load component nodes when folder within Reports type is selected', async () => {
    const expected = getExpected('ReportA', 'ReportB', NodeType.MetadataComponent);
    const metadataObject = getMetadataObject('Report Folder');
    getComponentsStub.returns(expected.map(n => n.fullName));
    const reportFolderNode = new BrowserNode('Report folder', NodeType.Folder, 'ReportFolder', metadataObject);
    const cmpsNodes = await metadataProvider.getChildren(reportFolderNode);
    compareNodes(cmpsNodes, expected);
  });

  it('should load field nodes when folder within Custom Objects type is selected', async () => {
    const expected = getExpected('Id (id)', 'IsDeleted (boolean)', NodeType.MetadataField);
    const customObjectmetadataObject = getMetadataObject('Custom Objects');
    getComponentsStub.returns(expected.map(n => n.fullName));
    const parentNode = new BrowserNode(
      'Custom Objects',
      NodeType.MetadataType,
      'CustomObject',
      customObjectmetadataObject
    );

    parentNode.setComponents(['TestAccount', 'TestCleanInfo'], NodeType.Folder);
    const childNodes = parentNode.children || [];
    const childNode1 = childNodes[0];
    childNode1.setComponents(['Id (id)', 'IsDeleted (boolean)'], NodeType.MetadataField);

    const cmpsNodes = await metadataProvider.getChildren(childNode1);
    compareNodes(cmpsNodes, expected);
  });

  it('should load component nodes when a non-folder type node is selected', async () => {
    const expected = getExpected('cmpNode1', 'cmpNode2', NodeType.MetadataComponent);
    const metadataObject = getMetadataObject('Type Node 1');
    getComponentsStub.returns(expected.map(n => n.fullName));
    const typeNode = new BrowserNode('ApexClass', NodeType.MetadataType, undefined, metadataObject);
    const cmpsNodes = await metadataProvider.getChildren(typeNode);
    compareNodes(cmpsNodes, expected);
  });
});

describe('load folder node when folder-type metadata type is selected', () => {
  const username = 'test-username@test1234.com';
  let metadataProvider: MetadataOutlineProvider;
  let getComponentsStub: SinonStub;

  beforeEach(() => {
    metadataProvider = new MetadataOutlineProvider(username);
    getComponentsStub = stub(MetadataOutlineProvider.prototype, 'getComponents');
  });

  afterEach(() => {
    getComponentsStub.restore();
  });

  it('should load folder nodes when Custom Objects type node is selected', async () => {
    const expected = getExpected('Account', 'AccountCleanInfo', NodeType.Folder);
    const metadataObject = getMetadataObject('Custom Objects');
    getComponentsStub.returns(expected.map(n => n.fullName));
    const customObjectNode = new BrowserNode('Custom Objects', NodeType.MetadataType, 'CustomObject', metadataObject);
    const cmpsNodes = await metadataProvider.getChildren(customObjectNode);
    compareNodes(cmpsNodes, expected);
  });

  it('should load folder nodes when Dashboards type node is selected', async () => {
    const expected = getExpected('Dashboard1', 'Dashboard2', NodeType.Folder);
    const metadataObject = getMetadataObject('Dashboards');
    getComponentsStub.returns(expected.map(n => n.fullName));
    const dashboardNode = new BrowserNode('Dashboards', NodeType.MetadataType, 'Dashboard', metadataObject);
    const cmpsNodes = await metadataProvider.getChildren(dashboardNode);
    compareNodes(cmpsNodes, expected);
  });

  it('should load folder nodes when Documents type node is selected', async () => {
    const expected = getExpected('Document1', 'Document2', NodeType.Folder);
    const metadataObject = getMetadataObject('Documents');
    getComponentsStub.returns(expected.map(n => n.fullName));
    const documentNode = new BrowserNode('Documents', NodeType.MetadataType, 'Document', metadataObject);
    const cmpsNodes = await metadataProvider.getChildren(documentNode);
    compareNodes(cmpsNodes, expected);
  });

  it('should load folder nodes when EmailTemplates type node is selected', async () => {
    const expected = getExpected('Template1', 'Template2', NodeType.Folder);
    const metadataObject = getMetadataObject('Email Templates');
    getComponentsStub.returns(expected.map(n => n.fullName));
    const emailTemplateNode = new BrowserNode(
      'Email Templates',
      NodeType.MetadataType,
      'EmailTemplate',
      metadataObject
    );
    const cmpsNodes = await metadataProvider.getChildren(emailTemplateNode);
    compareNodes(cmpsNodes, expected);
  });

  it('should load folder nodes when Reports type node is selected', async () => {
    const expected = getExpected('Report1', 'Report2', NodeType.Folder);
    const metadataObject = getMetadataObject('Reports');
    getComponentsStub.returns(expected.map(n => n.fullName));
    const reportNode = new BrowserNode('Reports', NodeType.MetadataType, 'Report', metadataObject);
    const cmpsNodes = await metadataProvider.getChildren(reportNode);
    compareNodes(cmpsNodes, expected);
  });
});

// Can't compare nodes w/ deep.equal because of circular parent node reference
const compareNodes = (actual: BrowserNode[], expected: any[]) => {
  expected.forEach((node, index) => {
    Object.keys(node).forEach(key => {
      expect((actual[index] as any)[key]).to.equal(node[key]);
    });
  });
};

const getExpected = (label1: string, label2: string, nodetype: NodeType) => {
  return [
    {
      label: label1,
      fullName: label1,
      type: nodetype
    },
    {
      label: label2,
      fullName: label2,
      type: nodetype
    }
  ];
};

const getMetadataObject = (label1: string) => {
  return {
    xmlName: label1,
    directoryName: 'testDirectory',
    suffix: 'cls',
    inFolder: true,
    metaFile: false,
    label: label1
  };
};

describe('parse errors and throw with appropriate message', () => {
  it('should return default message when given a dirty json', async () => {
    const error = `< Warning: sfdx-cli update available +
      ${JSON.stringify({ status: 1, name: 'RetrievingError' })}`;
    const errorResponse = parseErrors(error);
    expect(errorResponse.message).to.equal(
      `${nls.localize('error_fetching_metadata')} ${nls.localize('error_org_browser_text')}`
    );
  });

  it('should return authorization token message when throwing RefreshTokenAuthError', async () => {
    const error = JSON.stringify({ status: 1, name: 'RefreshTokenAuthError' });
    const errorResponse = parseErrors(error);
    expect(errorResponse.message).to.equal(
      `${nls.localize('error_auth_token')} ${nls.localize('error_org_browser_text')}`
    );
  });

  it('should return no org found message when throwing NoOrgFound error', async () => {
    const error = JSON.stringify({ status: 1, name: 'NoOrgFound' });
    const errorResponse = parseErrors(error);
    expect(errorResponse.message).to.equal(
      `${nls.localize('error_no_org_found')} ${nls.localize('error_org_browser_text')}`
    );
  });
});
