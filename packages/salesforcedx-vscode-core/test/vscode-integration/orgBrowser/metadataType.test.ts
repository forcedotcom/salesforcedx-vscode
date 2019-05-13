/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { SinonStub, stub } from 'sinon';
import { isNullOrUndefined } from 'util';
import { nls } from '../../../src/messages';
import {
  buildTypesList,
  ForceDescribeMetadataExecutor,
  getTypesPath
} from '../../../src/orgBrowser';
import { getRootWorkspacePath, OrgAuthInfo } from '../../../src/util';

describe('Force Describe Metadata', () => {
  it('Should build describe metadata command', async () => {
    const outputPath = 'outputPath';
    const forceDescribeMetadataExec = new ForceDescribeMetadataExecutor(
      outputPath
    );
    const forceDescribeMetadataCmd = forceDescribeMetadataExec.build({});
    expect(forceDescribeMetadataCmd.toCommand()).to.equal(
      `sfdx force:mdapi:describemetadata --json --loglevel fatal -f ${outputPath}`
    );
  });
});

// tslint:disable:no-unused-expression
describe('get metadata types path', () => {
  let getDefaultUsernameStub: SinonStub;
  let getUsernameStub: SinonStub;
  const rootWorkspacePath = getRootWorkspacePath();
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
      'metadata',
      'metadataTypes.json'
    );
    expect(await getTypesPath()).to.equal(filePath);
  });

  it('should throw an error if default username is not set', async () => {
    getDefaultUsernameStub.returns(undefined);
    let errorWasThrown = false;
    try {
      await getTypesPath();
    } catch (e) {
      errorWasThrown = true;
      expect(e.message).to.equal(nls.localize('error_no_default_username'));
    } finally {
      expect(getUsernameStub.called).to.be.false;
      expect(errorWasThrown).to.be.true;
    }
  });
});

describe('build metadata types list', () => {
  let readFileStub: SinonStub;
  let fileExistStub: SinonStub;
  beforeEach(() => {
    readFileStub = stub(fs, 'readFileSync');
    fileExistStub = stub(fs, 'existsSync');
  });
  afterEach(() => {
    readFileStub.restore();
    fileExistStub.restore();
  });
  it('should return a list of xmlNames when given a list of metadata objects', async () => {
    const metadataTypesPath = 'metadataTypesPath';
    fileExistStub.returns(true);
    const fileData = JSON.stringify({
      metadataObjects: [
        { xmlName: 'fakeName1', suffix: 'fakeSuffix1' },
        { xmlName: 'fakeName2', suffix: 'fakeSuffix2' }
      ],
      extraField1: 'extraData1',
      extraField2: 'extraData2'
    });
    readFileStub.returns(fileData);
    const xmlNames = buildTypesList(metadataTypesPath);
    if (!isNullOrUndefined(xmlNames)) {
      expect(xmlNames[0]).to.equal('fakeName1');
      expect(xmlNames[1]).to.equal('fakeName2');
    }
  });
  it('should throw an error if the file does not exist yet', async () => {
    const metadataTypesPath = 'invalidPath';
    fileExistStub.returns(false);
    let errorWasThrown = false;
    try {
      buildTypesList(metadataTypesPath);
    } catch (e) {
      errorWasThrown = true;
    } finally {
      expect(errorWasThrown).to.be.true;
    }
  });
});
