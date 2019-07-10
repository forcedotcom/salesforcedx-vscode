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
import { fail } from 'assert';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { SinonStub, stub } from 'sinon';
import { isNullOrUndefined } from 'util';
import { ComponentUtils, TypeUtils } from '../../../src/orgBrowser';
import { getRootWorkspacePath, OrgAuthInfo } from '../../../src/util';

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

  it('should throw an error if a metadata type with folders is called without one', async () => {
    for (const type of TypeUtils.FOLDER_TYPES) {
      try {
        await cmpUtil.getComponentsPath(type, alias);
        fail('Should not have finished getComponentsPath call');
      } catch (e) {
        expect(e.message).to.equal(`${type} requires a folder to be specified`);
      }
    }
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
        { fullName: 'fakeName2', type: 'ApexClass' },
        { fullName: 'fakeName1', type: 'ApexClass' }
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
        { fullName: 'fakeName2', type: 'ApexClass' },
        { fullName: 'fakeName1', type: 'ApexClass' }
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
});

describe('load metadata component data', () => {
  let readFileStub: SinonStub;
  let getUsernameStub: SinonStub;
  let fileExistsStub: SinonStub;
  let buildComponentsStub: SinonStub;
  let cliCommandStub: SinonStub;
  let cmdOutputStub: SinonStub;
  let writeFileStub: SinonStub;
  let getComponentsPathStub: SinonStub;
  const cmpUtil = new ComponentUtils();
  const defaultOrg = 'defaultOrg@test.com';
  const metadataType = 'ApexClass';
  const filePath = '/test/metadata/ApexClass.json';
  beforeEach(() => {
    readFileStub = stub(fs, 'readFileSync');
    getUsernameStub = stub(OrgAuthInfo, 'getUsername').returns(undefined);
    fileExistsStub = stub(fs, 'existsSync');
    buildComponentsStub = stub(ComponentUtils.prototype, 'buildComponentsList');
    cliCommandStub = stub(CliCommandExecutor.prototype, 'execute');
    cmdOutputStub = stub(CommandOutput.prototype, 'getCmdResult');
    writeFileStub = stub(fs, 'writeFileSync');
    getComponentsPathStub = stub(
      ComponentUtils.prototype,
      'getComponentsPath'
    ).returns(filePath);
  });
  afterEach(() => {
    readFileStub.restore();
    getUsernameStub.restore();
    fileExistsStub.restore();
    buildComponentsStub.restore();
    cliCommandStub.restore();
    cmdOutputStub.restore();
    writeFileStub.restore();
    getComponentsPathStub.restore();
  });

  it('should load metadata components through cli command if file does not exist', async () => {
    fileExistsStub.returns(false);
    const fileData = JSON.stringify({
      status: 0,
      result: [
        { fullName: 'fakeName2', type: 'ApexClass' },
        { fullName: 'fakeName1', type: 'ApexClass' }
      ]
    });
    cmdOutputStub.returns(fileData);
    const components = await cmpUtil.loadComponents(defaultOrg, metadataType);
    expect(cmdOutputStub.called).to.equal(true);
    expect(buildComponentsStub.calledWith(metadataType, fileData, undefined)).to
      .be.true;
  });

  it('should load metadata components from file if file exists', async () => {
    fileExistsStub.returns(true);
    const components = await cmpUtil.loadComponents(defaultOrg, metadataType);
    expect(cmdOutputStub.called).to.equal(false);
    expect(buildComponentsStub.calledWith(metadataType, undefined, filePath)).to
      .be.true;
  });
});
