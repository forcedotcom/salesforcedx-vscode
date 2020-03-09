/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { expect } from 'chai';
import { createSandbox, SinonSandbox } from 'sinon';
import { ToolingDeploy } from '../../../src/deploys';

const $$ = testSetup();

describe('Tooling Deploys', () => {
  const testData = new MockTestOrgData();
  let mockConnection: Connection;
  let sandboxStub: SinonSandbox;

  beforeEach(async () => {
    sandboxStub = createSandbox();
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should create a metadata field', () => {
    const deployLibrary = new ToolingDeploy(mockConnection);
    const testMetadataField = {
      apiVersion: '32.0',
      status: 'Active'
    };
    let metaXMLString = '<?xml version="1.0" encoding="UTF-8"?>';
    metaXMLString +=
      '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">';
    metaXMLString += '    <apiVersion>32.0</apiVersion>';
    metaXMLString += '    <status>Active</status>';
    metaXMLString += '</ApexClass>';

    const metadataField = deployLibrary.buildMetadataField(metaXMLString);
    expect(metadataField).to.deep.equals(testMetadataField);
  });

  // Looks like we do not process more than one package version in -meta.xml
  it('should create a metadata field with package versions', () => {
    const deployLibrary = new ToolingDeploy(mockConnection);
    const testMetadataField = {
      apiVersion: '47.0',
      status: 'Active',
      packageVersions: '      1      0      packageA    '
    };
    let metaXMLString = '<?xml version="1.0" encoding="UTF-8"?>';
    metaXMLString +=
      '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">';
    metaXMLString += '    <apiVersion>47.0</apiVersion>';
    metaXMLString += '    <packageVersions>';
    metaXMLString += '      <majorNumber>1</majorNumber>';
    metaXMLString += '      <minorNumber>0</minorNumber>';
    metaXMLString += '      <namespace>packageA</namespace>';
    metaXMLString += '    </packageVersions>';
    metaXMLString += '    <packageVersions>';
    metaXMLString += '      <majorNumber>8</majorNumber>';
    metaXMLString += '      <minorNumber>21</minorNumber>';
    metaXMLString += '      <namespace>packageB</namespace>';
    metaXMLString += '    </packageVersions>';
    metaXMLString += '    <status>Active</status>';
    metaXMLString += '</ApexClass>';

    const metadataField = deployLibrary.buildMetadataField(metaXMLString);
    expect(metadataField).to.deep.equals(testMetadataField);
  });

  it('should create a metadata container', async () => {
    sandboxStub.stub(mockConnection.tooling, 'create').returns({
      success: testRunner,
      id: '1dcxxx000000034',
      errors: []
    });
    const deployLibrary = new ToolingDeploy(mockConnection);
    const container = await deployLibrary.createMetadataContainer();
    expect(container.id).to.equal('1dcxxx000000034');
    expect(container.success).to.be.equal(true);
    // tslint:disable-next-line:no-unused-expression
    expect(container.errors).to.be.an('array').that.is.empty;
  });
});
