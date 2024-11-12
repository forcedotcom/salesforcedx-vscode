/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CommandOutput, projectPaths } from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { SinonStub, stub } from 'sinon';
import { isNullOrUndefined } from 'util';
import { DescribeMetadataExecutor } from '../../../src/commands';
import { TypeUtils } from '../../../src/orgBrowser';
import { OrgAuthInfo, workspaceUtils } from '../../../src/util';

// tslint:disable:no-unused-expression
describe('get metadata types folder', () => {
  let getTargetOrgStub: SinonStub;
  let getUsernameStub: SinonStub;
  let metadataFolderStub: SinonStub;
  const rootWorkspacePath = workspaceUtils.getRootWorkspacePath();
  const metadataDirectoryPath = 'test/path/.sfdx/orgs/test-username1@example.com/metadata';
  const typeUtil = new TypeUtils();
  beforeEach(() => {
    getTargetOrgStub = stub(OrgAuthInfo, 'getTargetOrgOrAlias');
    getUsernameStub = stub(OrgAuthInfo, 'getUsername');
    metadataFolderStub = stub(projectPaths, 'metadataFolder').returns(metadataDirectoryPath);
  });
  afterEach(() => {
    getTargetOrgStub.restore();
    getUsernameStub.restore();
  });

  it('should return the path for a given username', async () => {
    expect(await typeUtil.getTypesFolder()).to.equal(metadataDirectoryPath);
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
    const types = typeUtil.buildTypesList(fileData, undefined);
    if (!isNullOrUndefined(types)) {
      expect(types[0].xmlName).to.equal('FakeName1');
      expect(types[1].xmlName).to.equal('FakeName2');
    }
  });

  it('should return a sorted list of xmlNames when given the metadata types result file path', async () => {
    const filePath = '/test/metadata/metadataTypes.json';
    readFileStub.returns(fileData);

    const types = typeUtil.buildTypesList(undefined, filePath);
    if (!isNullOrUndefined(types)) {
      expect(types[0].xmlName).to.equal('FakeName1');
      expect(types[1].xmlName).to.equal('FakeName2');
      expect(readFileStub.called).to.equal(true);
    }
  });

  it('should filter out blocklisted metadata types', async () => {
    const data = JSON.stringify({
      status: 0,
      result: {
        metadataObjects: Array.from(TypeUtils.UNSUPPORTED_TYPES).map(xmlName => ({ xmlName }))
      }
    });
    const types = await typeUtil.buildTypesList(data, undefined);
    expect(types).to.be.empty;
  });
});

describe('load metadata types data', () => {
  let readFileStub: SinonStub;
  let getUsernameStub: SinonStub;
  let fileExistsStub: SinonStub;
  let buildTypesStub: SinonStub;
  let execStub: SinonStub;
  let cmdOutputStub: SinonStub;
  let writeFileStub: SinonStub;
  let getTypesFolderStub: SinonStub;
  const typeUtil = new TypeUtils();
  let filePath = '/test/metadata/';
  beforeEach(() => {
    readFileStub = stub(fs, 'readFileSync');
    getUsernameStub = stub(OrgAuthInfo, 'getUsername').returns(undefined);
    fileExistsStub = stub(fs, 'existsSync');
    buildTypesStub = stub(TypeUtils.prototype, 'buildTypesList');
    execStub = stub(DescribeMetadataExecutor.prototype, 'execute');
    cmdOutputStub = stub(CommandOutput.prototype, 'getCmdResult');
    writeFileStub = stub(fs, 'writeFileSync');
    getTypesFolderStub = stub(TypeUtils.prototype, 'getTypesFolder').returns(filePath);
  });
  afterEach(() => {
    readFileStub.restore();
    getUsernameStub.restore();
    fileExistsStub.restore();
    buildTypesStub.restore();
    execStub.restore();
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
    const components = await typeUtil.loadTypes();
    expect(cmdOutputStub.called).to.equal(true);
    expect(buildTypesStub.calledWith(fileData, undefined)).to.be.true;
  });

  it('should load metadata types from file if file exists', async () => {
    fileExistsStub.returns(true);
    filePath = path.join(filePath, 'metadataTypes.json');
    const components = await typeUtil.loadTypes();
    expect(cmdOutputStub.called).to.equal(false);
    expect(buildTypesStub.calledWith(undefined, filePath)).to.be.true;
  });

  it('should load metadata types through cli if file exists and force is set to true', async () => {
    fileExistsStub.returns(true);
    await typeUtil.loadTypes(true);
    expect(cmdOutputStub.calledOnce).to.be.true;
  });
});
