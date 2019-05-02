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
import {
  buildComponentsList,
  ForceListMetadataExecutor,
  getComponentsPath
} from '../../../src/orgBrowser';
import { getRootWorkspacePath, OrgAuthInfo } from '../../../src/util';

describe('Force List Metadata', () => {
  it('Should build list metadata command', async () => {
    const outputPath = 'outputPath';
    const metadataType = 'ApexClass';
    const defaultUsername = 'test-username1@example.com';
    const forceListMetadataExec = new ForceListMetadataExecutor(
      metadataType,
      outputPath,
      defaultUsername
    );
    const forceDescribeMetadataCmd = forceListMetadataExec.build({});
    expect(forceDescribeMetadataCmd.toCommand()).to.equal(
      `sfdx force:mdapi:listmetadata -m ${metadataType} -u ${defaultUsername} -f ${outputPath} --json --loglevel fatal`
    );
  });
});

// tslint:disable:no-unused-expression
describe('get metadata components path', () => {
  let getUsernameStub: SinonStub;
  const rootWorkspacePath = getRootWorkspacePath();
  beforeEach(() => {
    getUsernameStub = stub(OrgAuthInfo, 'getUsername');
  });
  afterEach(() => {
    getUsernameStub.restore();
  });

  it('should return the path for a given username and metadata type', async () => {
    getUsernameStub.returns('test-username1@example.com');
    const metadataType = 'Apex Class';
    const alias = 'test user 1';
    const filePath = path.join(
      rootWorkspacePath,
      '.sfdx',
      'orgs',
      'test-username1@example.com',
      'metadata',
      metadataType + '.json'
    );
    expect(await getComponentsPath(metadataType, alias)).to.equal(filePath);
  });
});

describe('build metadata components list', () => {
  let readFileStub: SinonStub;
  beforeEach(() => {
    readFileStub = stub(fs, 'readFileSync');
  });
  afterEach(() => {
    readFileStub.restore();
  });
  it('should return a list of fullNames when given a list of metadata components', async () => {
    const componentsPath = 'metadataComponentsPath';
    const metadataType = 'ApexClass';
    const fileData = JSON.stringify([
      { fullName: 'fakeName1', suffix: 'fakeSuffix1' },
      { fullName: 'fakeName2', suffix: 'fakeSuffix2' }
    ]);
    readFileStub.returns(fileData);
    const fullNames = buildComponentsList(componentsPath, metadataType);
    if (!isNullOrUndefined(fullNames)) {
      expect(fullNames[0]).to.equal('fakeName1');
      expect(fullNames[1]).to.equal('fakeName2');
    }
  });
  it('should throw an error if the file does not exist yet', async () => {
    const metadataTypesPath = 'invalidPath';
    const metadataType = 'ApexClass';
    let errorWasThrown = false;
    try {
      buildComponentsList(metadataTypesPath, metadataType);
    } catch (e) {
      errorWasThrown = true;
    } finally {
      expect(errorWasThrown).to.be.true;
    }
  });
});
