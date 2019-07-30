/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { EOL } from 'os';
import {
  OrgOpenContainerResultParser,
  OrgOpenErrorResult,
  OrgOpenSuccessResult
} from '../../../src/cli';

// tslint:disable:no-unused-expression
describe.only('force:org:open container parser', () => {
  it('should parse success info successfully', () => {
    const orgOpenSuccessResult: OrgOpenSuccessResult = {
      status: 0,
      result: {
        orgId: '00Dxx0000000123',
        url: 'www.openMeUpScotty.com',
        username: 'krirk@enterprise.com'
      }
    };

    const parser = new OrgOpenContainerResultParser(
      JSON.stringify(orgOpenSuccessResult)
    );

    expect(parser.openIsSuccessful()).to.be.true;

    const cliRes = parser.getResult() as OrgOpenSuccessResult;
    expect(cliRes.status).to.equal(0);
    expect(cliRes.result).to.be.an('object');
    expect(cliRes.result.orgId).to.equal(orgOpenSuccessResult.result.orgId);
    expect(cliRes.result.url).to.equal(orgOpenSuccessResult.result.url);
    expect(cliRes.result.username).to.equal(
      orgOpenSuccessResult.result.username
    );
  });
  it('should parse error info successfully', () => {
    const orgOpenErrorResult: OrgOpenErrorResult = {
      status: 1,
      name: 'AuthDecryptError',
      message:
        'Failed to decipher the auth data. reason: Unssupported state or unable to authenticate data.',
      exitCode: 1,
      commandName: 'OrgOpenCommand',
      stack: 'Pancakes',
      warnings: []
    };

    const parser = new OrgOpenContainerResultParser(
      JSON.stringify(orgOpenErrorResult)
    );

    expect(parser.openIsSuccessful()).to.be.false;

    const cliRes: OrgOpenErrorResult = parser.getResult() as OrgOpenErrorResult;
    expect(cliRes.status).to.equal(1);
    expect(cliRes).to.be.an('object');
    expect(cliRes.name).to.equal(orgOpenErrorResult.name);
    expect(cliRes.message).to.equal(orgOpenErrorResult.message);
    expect(cliRes.exitCode).to.equal(orgOpenErrorResult.exitCode);
    expect(cliRes.commandName).to.equal(orgOpenErrorResult.commandName);
    expect(cliRes.stack).to.equal(orgOpenErrorResult.stack);
    expect(cliRes.warnings).to.be.an('array');
  });
});
