/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
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
    const orgNode = new BrowserNode(username, NodeType.Org);
    const typesList = [
      new BrowserNode('typeNode1', NodeType.MetadataType),
      new BrowserNode('typeNode2', NodeType.MetadataType)
    ];
    const getTypesStub = stub(
      MetadataOutlineProvider.prototype,
      'getTypes'
    ).returns(typesList);
    const typesNodes = await metadataProvider.getChildren(orgNode);
    expect(typesNodes).to.deep.equal(typesList);
    getTypesStub.restore();
  });

  it('should display emptyNode with error message if there is an error retrieving metadata types', async () => {
    const orgNode = new BrowserNode(username, NodeType.Org);
    const emptyNode = new BrowserNode(
      nls.localize('error_fetching_metadata') +
        nls.localize('error_org_browser_text'),
      NodeType.EmptyNode
    );
    const loadTypesStub = stub(TypeUtils.prototype, 'loadTypes').throws(
      JSON.stringify('error')
    );
    const typesNodes = await metadataProvider.getChildren(orgNode);
    expect(typesNodes).to.deep.equal([emptyNode]);
    loadTypesStub.restore();
  });

  it('should load metadata component nodes when a type node is selected', async () => {
    const typeNode = new BrowserNode('ApexClass', NodeType.MetadataType);
    const cmpsList = [
      new BrowserNode('cmpNode1', NodeType.MetadataCmp),
      new BrowserNode('cmpNode2', NodeType.MetadataCmp)
    ];
    const getCmpsStub = stub(
      MetadataOutlineProvider.prototype,
      'getComponents'
    ).returns(cmpsList);
    const cmpsNodes = await metadataProvider.getChildren(typeNode);
    expect(cmpsNodes).to.deep.equal(cmpsList);
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
    const loadCmpStub = stub(ComponentUtils.prototype, 'loadComponents');
    const typeNode = new BrowserNode('EmailTemplate', NodeType.MetadataType);

    const folders = [
      new BrowserNode('SampleFolder', NodeType.Folder),
      new BrowserNode('SampleFolder2', NodeType.Folder)
    ];
    const s1Components = [
      new BrowserNode(
        'My_Email_Template',
        NodeType.MetadataCmp,
        `${folders[0].label}/My_Email_Template`
      ),
      new BrowserNode(
        'Other_Template',
        NodeType.MetadataCmp,
        `${folders[0].label}/Other_Template`
      )
    ];
    const s2Components = [
      new BrowserNode('Main', NodeType.MetadataCmp, `${folders[1].label}/Main`)
    ];
    loadCmpStub
      .withArgs(username, 'EmailFolder') // Also testing EmailTemplate queries EmailFolder
      .returns(folders.map(n => n.label));
    loadCmpStub
      .withArgs(username, 'EmailTemplate', `${folders[0].label}`)
      .returns(s1Components.map(n => n.fullName));
    loadCmpStub
      .withArgs(username, 'EmailTemplate', `${folders[1].label}`)
      .returns(s2Components.map(n => n.fullName));

    const cmpsNodes = await metadataProvider.getChildren(typeNode);
    folders[0].children = s1Components;
    folders[1].children = s2Components;

    expect(cmpsNodes).to.deep.equal(folders);

    loadCmpStub.restore();
  });
});
