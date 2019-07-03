/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  CliCommandExecutor,
  CommandOutput
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { SinonStub, stub } from 'sinon';
import { isNullOrUndefined } from 'util';
import { TypeUtils } from '../../../src/orgBrowser';
import { getRootWorkspacePath, OrgAuthInfo } from '../../../src/util';

// tslint:disable:no-unused-expression
describe('get metadata types folder', () => {
  let getDefaultUsernameStub: SinonStub;
  let getUsernameStub: SinonStub;
  const rootWorkspacePath = getRootWorkspacePath();
  const typeUtil = new TypeUtils();
  beforeEach(() => {
    getDefaultUsernameStub = stub(OrgAuthInfo, 'getDefaultUsernameOrAlias');
    getUsernameStub = stub(OrgAuthInfo, 'getUsername');
  });
  afterEach(() => {
    getDefaultUsernameStub.restore();
    getUsernameStub.restore();
  });

  it('should return the path for a given username', async () => {
    getDefaultUsernameStub.returns('defaultAlias');
    getUsernameStub.returns('test-username1@example.com');
    const filePath = path.join(
      rootWorkspacePath,
      '.sfdx',
      'orgs',
      'test-username1@example.com',
      'metadata'
    );
    expect(
      await typeUtil.getTypesFolder('test-username1@example.com')
    ).to.equal(filePath);
  });
});

describe('build metadata types list', () => {
  let readFileStub: SinonStub;
  const typeUtil = new TypeUtils();
  const fileData = JSON.stringify({
    status: 0,
    result: {
      metadataObjects: [
        { suffix: 'fakeName2', xmlName: 'FakeName2' },
        { suffix: 'fakeName1', xmlName: 'FakeName1' }
      ]
    }
  });
  beforeEach(() => {
    readFileStub = stub(fs, 'readFileSync');
  });
  afterEach(() => {
    readFileStub.restore();
  });

  it('should return a sorted list of xmlNames when given a list of metadata types', async () => {
    readFileStub.returns(fileData);
    const xmlNames = typeUtil.buildTypesList(fileData, undefined);
    if (!isNullOrUndefined(xmlNames)) {
      expect(xmlNames[0]).to.equal('FakeName1');
      expect(xmlNames[1]).to.equal('FakeName2');
    }
  });

  it('should return a sorted list of xmlNames when given the metadata types result file path', async () => {
    const filePath = '/test/metadata/metadataTypes.json';
    readFileStub.returns(fileData);

    const xmlNames = typeUtil.buildTypesList(undefined, filePath);
    if (!isNullOrUndefined(xmlNames)) {
      expect(xmlNames[0]).to.equal('FakeName1');
      expect(xmlNames[1]).to.equal('FakeName2');
      expect(readFileStub.called).to.equal(true);
    }
  });
});

describe('load metadata types data', () => {
  let readFileStub: SinonStub;
  let getUsernameStub: SinonStub;
  let fileExistsStub: SinonStub;
  let buildTypesStub: SinonStub;
  let cliCommandStub: SinonStub;
  let cmdOutputStub: SinonStub;
  let writeFileStub: SinonStub;
  let getTypesFolderStub: SinonStub;
  const typeUtil = new TypeUtils();
  const defaultOrg = 'defaultOrg@test.com';
  let filePath = '/test/metadata/';
  beforeEach(() => {
    readFileStub = stub(fs, 'readFileSync');
    getUsernameStub = stub(OrgAuthInfo, 'getUsername').returns(undefined);
    fileExistsStub = stub(fs, 'existsSync');
    buildTypesStub = stub(TypeUtils.prototype, 'buildTypesList');
    cliCommandStub = stub(CliCommandExecutor.prototype, 'execute');
    cmdOutputStub = stub(CommandOutput.prototype, 'getCmdResult');
    writeFileStub = stub(fs, 'writeFileSync');
    getTypesFolderStub = stub(TypeUtils.prototype, 'getTypesFolder').returns(
      filePath
    );
  });
  afterEach(() => {
    readFileStub.restore();
    getUsernameStub.restore();
    fileExistsStub.restore();
    buildTypesStub.restore();
    cliCommandStub.restore();
    cmdOutputStub.restore();
    writeFileStub.restore();
    getTypesFolderStub.restore();
  });

  it('should load metadata types through cli command if file does not exist', async () => {
    fileExistsStub.returns(false);
    const fileData = JSON.stringify({
      status: 0,
      result: {
        metadataObjects: [
          { suffix: 'fakeName2', xmlName: 'FakeName2' },
          { suffix: 'fakeName1', xmlName: 'FakeName1' }
        ]
      }
    });
    cmdOutputStub.returns(fileData);
    const components = await typeUtil.loadTypes(defaultOrg);
    expect(cmdOutputStub.called).to.equal(true);
    expect(buildTypesStub.calledWith(fileData, undefined)).to.be.true;
  });

  it('should load metadata types from file if file exists', async () => {
    fileExistsStub.returns(true);
    filePath = path.join(filePath, 'metadataTypes.json');
    const components = await typeUtil.loadTypes(defaultOrg);
    expect(cmdOutputStub.called).to.equal(false);
    expect(buildTypesStub.calledWith(undefined, filePath)).to.be.true;
  });
});
