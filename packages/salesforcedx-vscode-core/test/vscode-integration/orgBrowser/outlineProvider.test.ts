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
    ).returns(expected.map(n => n.fullName));
    const typesNodes = await metadataProvider.getChildren(orgNode);

    compareNodes(typesNodes, expected);
    getTypesStub.restore();
  });

  it('should throw error if trouble fetching types', async () => {
    const orgNode = new BrowserNode(username, NodeType.Org);
    const loadTypesStub = stub(TypeUtils.prototype, 'loadTypes').throws(
      JSON.stringify('error')
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
    const typeNode = new BrowserNode('ApexClass', NodeType.MetadataType);
    const loadTypesStub = stub(
      ComponentUtils.prototype,
      'loadComponents'
    ).throws(JSON.stringify('error'));
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
    loadTypesStub.restore();
  });

  it('should load metadata component nodes when a type node is selected', async () => {
    const expected = [
      {
        label: 'cmpNode1',
        fullName: 'cmpNode1',
        type: NodeType.MetadataCmp
      },
      {
        label: 'cmpNode2',
        fullName: 'cmpNode2',
        type: NodeType.MetadataCmp
      }
    ];
    const getCmpsStub = stub(
      MetadataOutlineProvider.prototype,
      'getComponents'
    ).returns(expected.map(n => n.fullName));
    const typeNode = new BrowserNode('ApexClass', NodeType.MetadataType);

    const cmpsNodes = await metadataProvider.getChildren(typeNode);
    compareNodes(cmpsNodes, expected);

    getCmpsStub.restore();
  });

  it('should display emptyNode with error message if no components are present for a given type', async () => {
    const typeNode = new BrowserNode('ApexClass', NodeType.MetadataType);
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

  it('should display folders and components that live in them when a folder type node is selected', async () => {
    const folder1 = [
      {
        label: 'Sample_Template',
        type: NodeType.MetadataCmp,
        fullName: 'SampleFolder/Sample_Template'
      },
      {
        label: 'Sample_Template2',
        type: NodeType.MetadataCmp,
        fullName: 'SampleFolder/Sample_Template2'
      }
    ];
    const folder2 = [
      {
        label: 'Main',
        type: NodeType.MetadataCmp,
        fullName: 'SampleFolder2/Main'
      }
    ];
    const folders = [
      {
        label: 'SampleFolder',
        type: NodeType.Folder,
        fullName: 'SampleFolder'
      },
      {
        label: 'SampleFolder2',
        type: NodeType.Folder,
        fullName: 'SampleFolder2'
      }
    ];
    const loadCmpStub = stub(ComponentUtils.prototype, 'loadComponents');
    loadCmpStub
      .withArgs(username, 'EmailFolder') // Also testing EmailTemplate queries EmailFolder
      .returns(folders.map(n => n.fullName));
    loadCmpStub
      .withArgs(username, 'EmailTemplate', folders[0].fullName)
      .returns(folder1.map(n => n.fullName));
    loadCmpStub
      .withArgs(username, 'EmailTemplate', folders[1].fullName)
      .returns(folder2.map(n => n.fullName));

    const testNode = new BrowserNode('EmailTemplate', NodeType.MetadataType);
    const f = await metadataProvider.getChildren(testNode);
    compareNodes(f, folders);
    const f1 = await metadataProvider.getChildren(f[0]);
    compareNodes(f1, folder1);
    const f2 = await metadataProvider.getChildren(f[1]);
    compareNodes(f2, folder2);

    loadCmpStub.restore();
  });

  it('should set contextValue for nodes correctly', () => {
    const keys = Object.keys(NodeType).filter(
      k => typeof NodeType[k as any] === 'number'
    );
    keys
      .map(k => Number(NodeType[k as any]))
      .forEach(val => {
        let expected;
        const node = new BrowserNode('Test', val);
        if (val === NodeType.Folder || val === NodeType.MetadataType) {
          expected = 'refreshable';
        } else if (val === NodeType.MetadataCmp) {
          expected = 'component';
        }
        expect(node.contextValue).to.equal(expected);
      });
  });

  it('should call loadComponents with force refresh', async () => {
    const loadCmpStub = stub(
      ComponentUtils.prototype,
      'loadComponents'
    ).returns([]);
    const node = new BrowserNode('ApexClass', NodeType.MetadataType);

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
