/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { fail } from 'assert';
import { expect } from 'chai';
import { stub } from 'sinon';
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

  beforeEach(() => {
    metadataProvider = new MetadataOutlineProvider(username);
  });

  it('should load the root node with default org', async () => {
    const expectedNode = new BrowserNode(username, NodeType.Org);
    const orgNode = await metadataProvider.getChildren();
    expect(orgNode).to.deep.equal([expectedNode]);
  });

  it('should display emptyNode with error message if default org is not set', async () => {
    metadataProvider = new MetadataOutlineProvider(undefined);
    const expectedNode = new BrowserNode(
      nls.localize('missing_default_org'),
      NodeType.EmptyNode
    );
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
    const expected = [
      {
        label: 'typeNode1',
        type: NodeType.MetadataType,
        fullName: 'typeNode1'
      },
      {
        label: 'typeNode2',
        type: NodeType.MetadataType,
        fullName: 'typeNode2'
      }
    ];
    const orgNode = new BrowserNode(username, NodeType.Org);
    const getTypesStub = stub(
      MetadataOutlineProvider.prototype,
      'getTypes'
    ).returns(metadataInfo);
    const typesNodes = await metadataProvider.getChildren(orgNode);
    compareNodes(typesNodes, expected);
    getTypesStub.restore();
  });

  it('should throw error if trouble fetching types', async () => {
    const orgNode = new BrowserNode(username, NodeType.Org);
    const loadTypesStub = stub(TypeUtils.prototype, 'loadTypes').returns(
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
        `${nls.localize('error_fetching_metadata')} ${nls.localize(
          'error_org_browser_text'
        )}`
      );
    }
    loadTypesStub.restore();
  });

  it('should throw error if trouble fetching components', async () => {
    const metadataObject = {
      xmlName: 'typeNode1',
      directoryName: 'testDirectory',
      suffix: 'cls',
      inFolder: false,
      metaFile: false,
      label: 'Type Node 1'
    };
    const typeNode = new BrowserNode(
      'ApexClass',
      NodeType.MetadataType,
      undefined,
      metadataObject
    );
    const loadCmpsStub = stub(
      ComponentUtils.prototype,
      'loadComponents'
    ).returns(
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
        `${nls.localize('error_fetching_metadata')} ${nls.localize(
          'error_org_browser_text'
        )}`
      );
    }
    loadCmpsStub.restore();
  });

  it('should load component nodes when a non-folder type node is selected', async () => {
    const expected = [
      {
        label: 'cmpNode1',
        fullName: 'cmpNode1',
        type: NodeType.MetadataComponent
      },
      {
        label: 'cmpNode2',
        fullName: 'cmpNode2',
        type: NodeType.MetadataComponent
      }
    ];
    const getCmpsStub = stub(
      MetadataOutlineProvider.prototype,
      'getComponents'
    ).returns(expected.map(n => n.fullName));

    const metadataObject = {
      xmlName: 'typeNode1',
      directoryName: 'testDirectory',
      suffix: 'cls',
      inFolder: false,
      metaFile: false,
      label: 'Type Node 1'
    };
    const typeNode = new BrowserNode(
      'ApexClass',
      NodeType.MetadataType,
      undefined,
      metadataObject
    );
    const cmpsNodes = await metadataProvider.getChildren(typeNode);
    compareNodes(cmpsNodes, expected);

    getCmpsStub.restore();
  });

  it('should load folder nodes when Custom Objects type node is selected', async () => {
    const expected = [
      {
        label: 'Account',
        fullName: 'Account',
        type: NodeType.Folder
      },
      {
        label: 'AccountCleanInfo',
        fullName: 'AccountCleanInfo',
        type: NodeType.Folder
      }
    ];
    const getCmpsStub = stub(
      MetadataOutlineProvider.prototype,
      'getComponents'
      ).returns(expected.map(n => n.fullName));

    const metadataObject = {
      xmlName: 'CustomObject',
      directoryName: 'testDirectory',
      suffix: 'cls',
      inFolder: false,
      metaFile: false,
      label: 'Custom Objects'
    };
    const customObjectNode = new BrowserNode(
      'Custom Objects',
      NodeType.MetadataType,
      'CustomObject',
      metadataObject
    );
    const cmpsNodes = await metadataProvider.getChildren(customObjectNode);
    compareNodes(cmpsNodes, expected);

    getCmpsStub.restore();
  });

  it('should load folder nodes when Dashboards type node is selected', async () => {
    const expected = [
      {
        label: 'Dashboard1',
        fullName: 'Dashboard1',
        type: NodeType.Folder
      },
      {
        label: 'Dashboard2',
        fullName: 'Dashboard2',
        type: NodeType.Folder
      }
    ];
    const getCmpsStub = stub(
      MetadataOutlineProvider.prototype,
      'getComponents'
      ).returns(expected.map(n => n.fullName));

    const metadataObject = {
      xmlName: 'Dashboards',
      directoryName: 'testDirectory',
      suffix: 'cls',
      inFolder: false,
      metaFile: false,
      label: 'Dashboards'
    };
    const dashboardNode = new BrowserNode(
      'Dashboards',
      NodeType.MetadataType,
      'Dashboard',
      metadataObject
    );
    const cmpsNodes = await metadataProvider.getChildren(dashboardNode);
    compareNodes(cmpsNodes, expected);
    getCmpsStub.restore();
  });

  it('should load folder nodes when Documents type node is selected', async () => {
    const expected = [
      {
        label: 'Document1',
        fullName: 'Document1',
        type: NodeType.Folder
      },
      {
        label: 'Document2',
        fullName: 'Document2',
        type: NodeType.Folder
      }
    ];
    const getCmpsStub = stub(
      MetadataOutlineProvider.prototype,
      'getComponents'
      ).returns(expected.map(n => n.fullName));

    const metadataObject = {
      xmlName: 'Documents',
      directoryName: 'testDirectory',
      suffix: 'cls',
      inFolder: false,
      metaFile: false,
      label: 'Documents'
    };
    const documentNode = new BrowserNode(
      'Documents',
      NodeType.MetadataType,
      'Document',
      metadataObject
    );
    const cmpsNodes = await metadataProvider.getChildren(documentNode);
    compareNodes(cmpsNodes, expected);
    getCmpsStub.restore();
  });

  it('should load folder nodes when EmailTemplates type node is selected', async () => {
    const expected = [
      {
        label: 'Template1',
        fullName: 'Template1',
        type: NodeType.Folder
      },
      {
        label: 'Template2',
        fullName: 'Template2',
        type: NodeType.Folder
      }
    ];
    const getCmpsStub = stub(
      MetadataOutlineProvider.prototype,
      'getComponents'
      ).returns(expected.map(n => n.fullName));

    const metadataObject = {
      xmlName: 'Email Templates',
      directoryName: 'testDirectory',
      suffix: 'cls',
      inFolder: false,
      metaFile: false,
      label: 'Email Templates'
    };
    const emailTemplateNode = new BrowserNode(
      'Email Templates',
      NodeType.MetadataType,
      'EmailTemplate',
      metadataObject
    );
    const cmpsNodes = await metadataProvider.getChildren(emailTemplateNode);
    compareNodes(cmpsNodes, expected);
    getCmpsStub.restore();
  });

  it('should load folder nodes when Reports type node is selected', async () => {
    const expected = [
      {
        label: 'Report1',
        fullName: 'Report1',
        type: NodeType.Folder
      },
      {
        label: 'Report2',
        fullName: 'Report2',
        type: NodeType.Folder
      }
    ];
    const getCmpsStub = stub(
      MetadataOutlineProvider.prototype,
      'getComponents'
      ).returns(expected.map(n => n.fullName));

    const metadataObject = {
      xmlName: 'Reports',
      directoryName: 'testDirectory',
      suffix: 'cls',
      inFolder: false,
      metaFile: false,
      label: 'Reports'
    };
    const reportNode = new BrowserNode(
      'Reports',
      NodeType.MetadataType,
      'Report',
      metadataObject
    );
    const cmpsNodes = await metadataProvider.getChildren(reportNode);
    compareNodes(cmpsNodes, expected);
    getCmpsStub.restore();
  });

  it('should display emptyNode with error message if no components are present for a given type', async () => {
    const metadataObject = {
      xmlName: 'typeNode1',
      directoryName: 'classes',
      suffix: 'cls',
      inFolder: false,
      metaFile: false,
      label: 'Type Node 1'
    };
    const typeNode = new BrowserNode(
      'ApexClass',
      NodeType.MetadataType,
      undefined,
      metadataObject
    );

    const emptyNode = new BrowserNode(
      nls.localize('empty_components'),
      NodeType.EmptyNode
    );
    const loadCmpsStub = stub(
      ComponentUtils.prototype,
      'loadComponents'
    ).returns([]);
    const cmpsNodes = await metadataProvider.getChildren(typeNode);
    expect(cmpsNodes).to.deep.equal([emptyNode]);
    loadCmpsStub.restore();
  });

  it('should check for parent node when a folder node is selected', async () => {
    const expected = [
      {
        label: 'Id (id)',
        fullName: 'Id (id)',
        type: NodeType.MetadataField
      },
      {
        label: 'IsDeleted (boolean)',
        fullName: 'IsDeleted (boolean)',
        type: NodeType.MetadataField
      }
    ];
    const getCmpsStub = stub(
      MetadataOutlineProvider.prototype,
      'getComponents'
      ).returns(expected.map(n => n.fullName));
    const customObjectmetadataObject = {
      xmlName: 'customObject',
      directoryName: 'testDirectory',
      suffix: 'cls',
      inFolder: false,
      metaFile: false,
      label: 'Custom Objects'
    };
    const parentNode = new BrowserNode(
    'Custom Objects',
    NodeType.MetadataType,
    'CustomObject',
    customObjectmetadataObject
    );
    parentNode.setComponents(['TestAccount', 'TestCleanInfo'], NodeType.Folder);
    const childNodes = parentNode.children;
    //@ts-ignore
    const childNode1 = childNodes[0];
    childNode1.setComponents(['Id (id)', 'IsDeleted (boolean)'], NodeType.MetadataField);
    const cmpsNodes = await metadataProvider.getChildren(childNode1);
    compareNodes(cmpsNodes, expected);
    getCmpsStub.restore();
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

    const loadCmpStub = stub(ComponentUtils.prototype, 'loadComponents');
    loadCmpStub
      .withArgs(username, 'EmailFolder')
      .returns(folders.map(n => n.fullName));
    loadCmpStub
      .withArgs(username, 'EmailTemplate', folders[0].fullName)
      .returns(folder1.map(n => n.fullName));
    loadCmpStub
      .withArgs(username, 'EmailTemplate', folders[1].fullName)
      .returns(folder2.map(n => n.fullName));

    const metadataObject = {
      xmlName: 'typeNode1',
      directoryName: 'testDirectory',
      suffix: 'cls',
      inFolder: true,
      metaFile: false,
      label: 'Type Node 1'
    };

    const testNode = new BrowserNode(
      'EmailTemplate',
      NodeType.MetadataType,
      undefined,
      metadataObject
    );

    const f = await metadataProvider.getChildren(testNode);
    compareNodes(f, folders);

    const f1 = await metadataProvider.getChildren(f[0]);
    compareNodes(f1, folder1);

    const f2 = await metadataProvider.getChildren(f[1]);
    compareNodes(f2, folder2);

    loadCmpStub.restore();
  });

  it('should load field nodes when folder within Custom Objects type is selected', async () => {
    const loadComponentsStub = stub(ComponentUtils.prototype, 'loadComponents');

    const customObjectBrowserNodes = [
      new BrowserNode('Account', NodeType.Folder, 'Account', undefined),
      new BrowserNode('Asset', NodeType.Folder, 'Asset', undefined),
      new BrowserNode('Book__c', NodeType.Folder, 'Book__c', undefined),
      new BrowserNode('Campaign', NodeType.Folder, 'Campaign', undefined),
      new BrowserNode('Customer Case', NodeType.Folder, 'Customer Case', undefined)
    ];
    const customObjectNames = [
      'Account',
      'Asset',
      'Book__c',
      'Campaign',
      'Customer Case'
    ];
    loadComponentsStub
      .withArgs(username, 'CustomObject', undefined, false)
      .returns(Promise.resolve(customObjectNames));

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
    loadComponentsStub
      .withArgs(username, 'CustomObject', 'Book__c', false)
      .returns(Promise.resolve(bookFieldNames));

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

    loadComponentsStub.restore();
  });

  it('should load component nodes when folder within Dashboards type is selected', async () => {
    const expected = [
      {
        label: 'DashboardA',
        fullName: 'DashboardA',
        type: NodeType.MetadataComponent
      },
      {
        label: 'DashboardB',
        fullName: 'DashboardB',
        type: NodeType.MetadataComponent
      }
    ];
    const getCmpsStub = stub(
      MetadataOutlineProvider.prototype,
      'getComponents'
      ).returns(expected.map(n => n.fullName));

    const metadataObject = {
      xmlName: 'Dashboard Folder',
      directoryName: 'testDirectory',
      suffix: 'cls',
      inFolder: false,
      metaFile: false,
      label: 'Dashboard Folder'
    };
    const dashboardFolderNode = new BrowserNode(
      'Dashboard Folder',
      NodeType.Folder,
      'DashboardFolder',
      metadataObject
    );
    const cmpsNodes = await metadataProvider.getChildren(dashboardFolderNode);
    compareNodes(cmpsNodes, expected);
    getCmpsStub.restore();
  });

  it('should load component nodes when folder within Documents type is selected', async () => {
    const expected = [
      {
        label: 'DocumentA',
        fullName: 'DocumentA',
        type: NodeType.MetadataComponent
      },
      {
        label: 'DocumentB',
        fullName: 'DocumentB',
        type: NodeType.MetadataComponent
      }
    ];
    const getCmpsStub = stub(
      MetadataOutlineProvider.prototype,
      'getComponents'
      ).returns(expected.map(n => n.fullName));

    const metadataObject = {
      xmlName: 'Document Folder',
      directoryName: 'testDirectory',
      suffix: 'cls',
      inFolder: true,
      metaFile: false,
      label: 'Document Folder'
    };
    const documentFolderNode = new BrowserNode(
      'Document folder',
      NodeType.Folder,
      'DocumentFolder',
      metadataObject
    );
    const cmpsNodes = await metadataProvider.getChildren(documentFolderNode);
    compareNodes(cmpsNodes, expected);
    getCmpsStub.restore();
  });

  it('should load component nodes when folder within Email Templates type is selected', async () => {
    const expected = [
      {
        label: 'TemplateA',
        fullName: 'TemplateA',
        type: NodeType.MetadataComponent
      },
      {
        label: 'TemplateB',
        fullName: 'TemplateB',
        type: NodeType.MetadataComponent
      }
    ];
    const getCmpsStub = stub(
      MetadataOutlineProvider.prototype,
      'getComponents'
      ).returns(expected.map(n => n.fullName));

    const metadataObject = {
      xmlName: 'Email Template Folder',
      directoryName: 'testDirectory',
      suffix: 'cls',
      inFolder: true,
      metaFile: false,
      label: 'Email Template Folder'
    };
    const emailFolderNode = new BrowserNode(
      'Email Template Folder',
      NodeType.Folder,
      'EmailFolder',
      metadataObject
    );
    const cmpsNodes = await metadataProvider.getChildren(emailFolderNode);
    compareNodes(cmpsNodes, expected);
    getCmpsStub.restore();
  });

  it('should load component nodes when folder within Reports type is selected', async () => {
    const expected = [
      {
        label: 'ReportA',
        fullName: 'ReportA',
        type: NodeType.MetadataComponent
      },
      {
        label: 'ReportB',
        fullName: 'ReportB',
        type: NodeType.MetadataComponent
      }
    ];
    const getCmpsStub = stub(
      MetadataOutlineProvider.prototype,
      'getComponents'
      ).returns(expected.map(n => n.fullName));

    const metadataObject = {
      xmlName: 'Report Folder',
      directoryName: 'testDirectory',
      suffix: 'cls',
      inFolder: true,
      metaFile: false,
      label: 'Report Folder'
    };
    const reportFolderNode = new BrowserNode(
      'Report folder',
      NodeType.Folder,
      'ReportFolder',
      metadataObject
    );
    const cmpsNodes = await metadataProvider.getChildren(reportFolderNode);
    compareNodes(cmpsNodes, expected);
    getCmpsStub.restore();
  });

  it('should call loadComponents with force refresh', async () => {
    const loadCmpStub = stub(
      ComponentUtils.prototype,
      'loadComponents'
    ).returns([]);
    const metadataObject = {
      xmlName: 'typeNode1',
      directoryName: 'testDirectory',
      suffix: 'cls',
      inFolder: false,
      metaFile: false,
      label: 'Type Node 1'
    };
    const node = new BrowserNode(
      'ApexClass',
      NodeType.MetadataType,
      undefined,
      metadataObject
    );

    await metadataProvider.getChildren(node);
    expect(loadCmpStub.getCall(0).args[3]).to.be.false;

    await metadataProvider.refresh(node);
    await metadataProvider.getChildren(node);
    expect(loadCmpStub.getCall(1).args[3]).to.be.true;

    await metadataProvider.getChildren(node);
    expect(loadCmpStub.getCall(2).args[3]).to.be.false;

    loadCmpStub.restore();
  });

  it('should call loadTypes with force refresh', async () => {
    const loadTypesStub = stub(TypeUtils.prototype, 'loadTypes').returns([]);
    const usernameStub = stub(
      MetadataOutlineProvider.prototype,
      'getDefaultUsernameOrAlias'
    ).returns(username);
    const node = new BrowserNode(username, NodeType.Org);

    await metadataProvider.getChildren(node);
    expect(loadTypesStub.getCall(0).args[1]).to.be.false;

    await metadataProvider.refresh();
    await metadataProvider.getChildren(node);
    expect(loadTypesStub.getCall(1).args[1]).to.be.true;

    await metadataProvider.getChildren(node);
    expect(loadTypesStub.getCall(2).args[1]).to.be.false;

    loadTypesStub.restore();
    usernameStub.restore();
  });
});

// Can't compare nodes w/ deep.equal because of circular parent node reference
function compareNodes(actual: BrowserNode[], expected: any[]) {
  expected.forEach((node, index) => {
    Object.keys(node).forEach(key => {
      expect((actual[index] as any)[key]).to.equal((node as any)[key]);
    });
  });
}

describe('parse errors and throw with appropriate message', () => {
  it('should return default message when given a dirty json', async () => {
    const error = `< Warning: sfdx-cli update available +
      ${JSON.stringify({ status: 1, name: 'RetrievingError' })}`;
    const errorResponse = parseErrors(error);
    expect(errorResponse.message).to.equal(
      `${nls.localize('error_fetching_metadata')} ${nls.localize(
        'error_org_browser_text'
      )}`
    );
  });

  it('should return authorization token message when throwing RefreshTokenAuthError', async () => {
    const error = JSON.stringify({ status: 1, name: 'RefreshTokenAuthError' });
    const errorResponse = parseErrors(error);
    expect(errorResponse.message).to.equal(
      `${nls.localize('error_auth_token')} ${nls.localize(
        'error_org_browser_text'
      )}`
    );
  });

  it('should return no org found message when throwing NoOrgFound error', async () => {
    const error = JSON.stringify({ status: 1, name: 'NoOrgFound' });
    const errorResponse = parseErrors(error);
    expect(errorResponse.message).to.equal(
      `${nls.localize('error_no_org_found')} ${nls.localize(
        'error_org_browser_text'
      )}`
    );
  });
});
