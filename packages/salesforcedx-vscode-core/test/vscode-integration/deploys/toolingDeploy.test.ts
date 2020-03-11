/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { expect } from 'chai';
import * as fs from 'fs';
import { createSandbox, SinonSandbox } from 'sinon';
import { ToolingCreateResult, ToolingDeploy } from '../../../src/deploys';
import { nls } from '../../../src/messages';

const $$ = testSetup();

describe('Tooling Deploys', () => {
  let simpleMetaXMLString = '<?xml version="1.0" encoding="UTF-8"?>';
  simpleMetaXMLString +=
    '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">';
  simpleMetaXMLString += '    <apiVersion>32.0</apiVersion>';
  simpleMetaXMLString += '    <status>Active</status>';
  simpleMetaXMLString += '</ApexClass>';
  const successfulContainerResult: ToolingCreateResult = {
    success: true,
    id: '1dcxxx000000034',
    errors: [],
    name: 'VSCode_MDC_',
    message: ''
  };
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
    const mockFS = sandboxStub.stub(fs, 'readFileSync');
    mockFS
      .withArgs('file/path/one.cls', 'utf8')
      .returns('public with sharing class TestAPI {}');

    mockFS
      .withArgs('file/path/one.cls-meta.xml', 'utf8')
      .returns(simpleMetaXMLString);
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
    const metadataField = deployLibrary.buildMetadataField(simpleMetaXMLString);
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
    const mockToolingCreate = sandboxStub.stub(
      mockConnection.tooling,
      'create'
    );
    mockToolingCreate.returns({
      success: true,
      id: '1dcxxx000000034',
      errors: []
    });
    const deployLibrary = new ToolingDeploy(mockConnection);
    const container = await deployLibrary.createMetadataContainer();
    expect(container.id).to.equal('1dcxxx000000034');
    expect(container.success).to.be.equal(true);
    // tslint:disable-next-line:no-unused-expression
    expect(container.errors).to.be.an('array').that.is.empty;
    expect(mockToolingCreate.getCall(0).args[0]).to.equal('MetadataContainer');
    expect(mockToolingCreate.getCall(0).args[1]).to.be.an('object');
    expect(mockToolingCreate.getCall(0).args[1].Name).to.contain('VSCode_MDC_');
  });

  it('should throw an error when creating a metadata container fails', async () => {
    sandboxStub.stub(mockConnection.tooling, 'create').returns({
      success: false,
      id: '',
      errors: ['Unexpected error while creating record']
    });
    const deployLibrary = new ToolingDeploy(mockConnection);
    try {
      await deployLibrary.createMetadataContainer();
      expect.fail('Should have failed');
    } catch (e) {
      expect(e.message).to.equal(nls.localize('beta_tapi_mdcontainer_error'));
      expect(e.name).to.be.equal('MetadataContainerCreationFailed');
    }
  });

  it('should throw an error when creating a duplicate metadata container', async () => {
    const errorObj = {
      errorCode: 'DUPLICATE_VALUE',
      message:
        'duplicate value found: Name duplicates value on record with id : 1dcxxx000000034',
      name: 'DUPLICATE_VALUE',
      stack:
        'DUPLICATE_VALUE: duplicate value found: Name duplicates value on record with id : 1dcxxx000000034'
    };
    sandboxStub.stub(mockConnection.tooling, 'create').throws(errorObj);
    const deployLibrary = new ToolingDeploy(mockConnection);
    try {
      await deployLibrary.createMetadataContainer();
      expect.fail('Should have failed');
    } catch (e) {
      expect(e.message).to.equal(
        'duplicate value found: Name duplicates value on record with id : 1dcxxx000000034'
      );
      expect(e.name).to.be.equal('DUPLICATE_VALUE');
    }
  });

  it('should create a metadata member type', async () => {
    sandboxStub.stub(mockConnection.tooling, 'sobject').returns({
      find() {
        return [];
      }
    });
    sandboxStub.stub(mockConnection.tooling, 'create').returns({
      success: true,
      id: '400xxx000000034',
      errors: []
    });

    const deployLibrary = new ToolingDeploy(mockConnection);
    deployLibrary.metadataType = 'Apexclass';
    const containerMember = await deployLibrary.createContainerMember(
      ['file/path/one.cls', 'file/path/one.cls-meta.xml'],
      successfulContainerResult
    );
    expect(containerMember.id).to.equal('400xxx000000034');
    expect(containerMember.success).to.be.equal(true);
    // tslint:disable-next-line:no-unused-expression
    expect(containerMember.errors).to.be.an('array').that.is.empty;
  });

  it('should call tooling api with the correct params when creating a metadata member type for new type', async () => {
    sandboxStub.stub(mockConnection.tooling, 'sobject').returns({
      find() {
        return [];
      }
    });
    const mockToolingCreate = sandboxStub.stub(
      mockConnection.tooling,
      'create'
    );
    mockToolingCreate.returns({
      success: true,
      id: '400xxx000000034',
      errors: []
    });

    const deployLibrary = new ToolingDeploy(mockConnection);
    deployLibrary.metadataType = 'Apexclass';
    await deployLibrary.createContainerMember(
      ['file/path/one.cls', 'file/path/one.cls-meta.xml'],
      successfulContainerResult
    );
    expect(mockToolingCreate.getCall(0).args[0]).to.be.equal('ApexClassMember');
    const secondParam = mockToolingCreate.getCall(0).args[1];
    expect(secondParam).to.be.an('object');
    expect(secondParam.MetadataContainerId).to.equal(
      successfulContainerResult.id
    );
    expect(secondParam.FullName).to.equal('one');
    expect(secondParam.Body).to.equal('public with sharing class TestAPI {}');
    expect(secondParam.Metadata).to.deep.equal({
      apiVersion: '32.0',
      status: 'Active'
    });
    expect(secondParam.hasOwnProperty('contentEntityId')).to.equal(false);
  });

  it('should call tooling api with the correct params when creating a metadata member type for existing type', async () => {
    sandboxStub.stub(mockConnection.tooling, 'sobject').returns({
      find() {
        return [{ Id: 'a00xxx000000034' }];
      }
    });
    const mockToolingCreate = sandboxStub.stub(
      mockConnection.tooling,
      'create'
    );
    mockToolingCreate.returns({
      success: true,
      id: '400xxx000000034',
      errors: []
    });

    const deployLibrary = new ToolingDeploy(mockConnection);
    deployLibrary.metadataType = 'Apexclass';
    await deployLibrary.createContainerMember(
      ['file/path/one.cls', 'file/path/one.cls-meta.xml'],
      successfulContainerResult
    );
    expect(mockToolingCreate.getCall(0).args[0]).to.be.equal('ApexClassMember');
    const secondParam = mockToolingCreate.getCall(0).args[1];
    expect(secondParam).to.be.an('object');
    expect(secondParam.MetadataContainerId).to.equal(
      successfulContainerResult.id
    );
    expect(secondParam.FullName).to.equal('one');
    expect(secondParam.Body).to.equal('public with sharing class TestAPI {}');
    expect(secondParam.Metadata).to.deep.equal({
      apiVersion: '32.0',
      status: 'Active'
    });
    expect(secondParam.hasOwnProperty('contentEntityId')).to.equal(true);
    expect(secondParam.contentEntityId).to.equal('a00xxx000000034');
  });

  it('should throw error when failing to create a metadata member type', async () => {
    sandboxStub.stub(mockConnection.tooling, 'sobject').returns({
      find() {
        return [];
      }
    });
    sandboxStub.stub(mockConnection.tooling, 'create').returns({
      success: false,
      id: '',
      errors: ['Unexpected error while creating record']
    });

    const deployLibrary = new ToolingDeploy(mockConnection);
    deployLibrary.metadataType = 'Apexclass';
    try {
      await deployLibrary.createContainerMember(
        ['file/path/one.cls', 'file/path/one.cls-meta.xml'],
        successfulContainerResult
      );
      expect.fail('Should have failed');
    } catch (e) {
      expect(e.message).to.equal(
        nls.localize('beta_tapi_membertype_error', 'apex class')
      );
      expect(e.name).to.be.equal('ApexClassMemberCreationFailed');
    }
  });

  it('should create a container async request', async () => {
    const mockToolingCreate = sandboxStub.stub(
      mockConnection.tooling,
      'create'
    );
    mockToolingCreate.returns({
      success: true,
      id: '1drxxx000000034',
      errors: []
    });
    const deployLibrary = new ToolingDeploy(mockConnection);
    const car = await deployLibrary.createContainerAsyncRequest(
      successfulContainerResult
    );
    expect(car.id).to.equal('1drxxx000000034');
    expect(car.success).to.be.equal(true);
    // tslint:disable-next-line:no-unused-expression
    expect(car.errors).to.be.an('array').that.is.empty;
    expect(mockToolingCreate.getCall(0).args[0]).to.equal(
      'ContainerAsyncRequest'
    );
    expect(mockToolingCreate.getCall(0).args[1]).to.deep.equal({
      MetadataContainerId: successfulContainerResult.id
    });
  });

  it('should throw an error when creating a container async request fails', async () => {
    sandboxStub.stub(mockConnection.tooling, 'create').returns({
      success: false,
      id: '',
      errors: ['Unexpected error while creating record']
    });
    const deployLibrary = new ToolingDeploy(mockConnection);
    try {
      await deployLibrary.createContainerAsyncRequest(
        successfulContainerResult
      );
      expect.fail('Should have failed');
    } catch (e) {
      expect(e.message).to.equal(nls.localize('beta_tapi_car_error'));
      expect(e.name).to.be.equal('ContainerAsyncRequestFailed');
    }
  });

  it('should throw an error when creating a container async request', async () => {
    const errorObj = {
      message:
        'insufficient access rights on cross-reference id: 1drxx000000xUHs',
      errorCode: 'INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY',
      fields: [],
      name: 'INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY'
    };

    sandboxStub.stub(mockConnection.tooling, 'create').throws(errorObj);
    const deployLibrary = new ToolingDeploy(mockConnection);
    try {
      await deployLibrary.createContainerAsyncRequest(
        successfulContainerResult
      );
      expect.fail('Should have failed');
    } catch (e) {
      expect(e.message).to.equal(
        'insufficient access rights on cross-reference id: 1drxx000000xUHs'
      );
      expect(e.name).to.be.equal(
        'INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY'
      );
    }
  });

  it('should poll for a container async request', async () => {
    const mockToolingRetrieve = sandboxStub.stub(
      mockConnection.tooling,
      'retrieve'
    );
    mockToolingRetrieve.onCall(0).returns({
      State: 'Queued',
      isDeleted: false,
      DeployDetails: null
    });
    mockToolingRetrieve.onCall(1).returns({
      State: 'Completed',
      isDeleted: false,
      DeployDetails: {
        componentFailures: [],
        componentSuccesses: []
      }
    });
    const asyncRequestMock: ToolingCreateResult = {
      success: true,
      id: '1drxxx000000034',
      errors: [],
      name: 'TestCAR',
      message: ''
    };
    const deployLibrary = new ToolingDeploy(mockConnection);
    const pollCAR = await deployLibrary.toolingRetrieve(asyncRequestMock);
    expect(pollCAR.State).to.equal('Completed');
  });
});
