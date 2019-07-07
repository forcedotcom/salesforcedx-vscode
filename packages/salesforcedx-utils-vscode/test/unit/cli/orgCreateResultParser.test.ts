/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { EOL } from 'os';
import {
  OrgCreateErrorResult,
  OrgCreateResultParser,
  OrgCreateSuccessResult
} from '../../../src/cli';

// tslint:disable:no-unused-expression
describe('force:org:create parser', () => {
  it('Should parse error info successfully', () => {
    const orgCreateErrorResult = {
      status: 1,
      name: 'OrgDataNotAvailableError',
      message:
        "An attempt to refresh the authentication token failed with a 'Data Not Found Error'. The org identified by username test-cayqlq5p5eek@example.com does not appear to exist. Likely cause is that the org was deleted by another user or has expired.",
      exitCode: 1,
      commandName: 'OrgCreateCommand',
      stack:
        "OrgDataNotAvailableError: An attempt to refresh the authentication token failed with a 'Data Not Found Error'.",
      warnings: []
    };

    const parser = new OrgCreateResultParser(
      JSON.stringify(orgCreateErrorResult)
    );

    expect(parser.createIsSuccessful()).to.be.false;

    const errs = parser.getResult() as OrgCreateErrorResult;
    expect(errs.status).to.be.equals(1);
    expect(errs.name).to.be.equals(orgCreateErrorResult.name);
    expect(errs.message).to.be.equals(orgCreateErrorResult.message);
    expect(errs.exitCode).to.be.equals(1);
    expect(errs.commandName).to.be.equals(orgCreateErrorResult.commandName);
    expect(errs.stack).to.be.equals(orgCreateErrorResult.stack);
    expect(errs.warnings).to.deep.equals(orgCreateErrorResult.warnings);
  });

  it('Should parse success info successfully', () => {
    const orgCreateSuccessResult = {
      status: 0,
      result: {
        orgId: '00Dxx0000000123',
        username: 'test-657890876@example.com'
      }
    };

    const parser = new OrgCreateResultParser(
      JSON.stringify(orgCreateSuccessResult)
    );

    expect(parser.createIsSuccessful()).to.be.true;

    const res = parser.getResult() as OrgCreateSuccessResult;
    expect(res.status).to.be.equals(0);
    expect(res.result).to.be.an('object');
    expect(res.result.orgId).to.be.equals(orgCreateSuccessResult.result.orgId);
    expect(res.result.username).to.be.equals(
      orgCreateSuccessResult.result.username
    );
  });

  it('Should parse success info successfully when provided along other info', () => {
    const orgCreateSuccessResult = {
      status: 0,
      result: {
        orgId: '00Dxx0000000123',
        username: 'test-657890876@example.com'
      }
    };

    const parser = new OrgCreateResultParser(
      `sfdx force:org:create --json --loglevel fatal ${EOL} ${JSON.stringify(
        orgCreateSuccessResult
      )} ${EOL} sfdx force:org:create --json --loglevel fatal ended with exit code 0`
    );

    expect(parser.createIsSuccessful()).to.be.true;

    const res = parser.getResult() as OrgCreateSuccessResult;
    expect(res.status).to.be.equals(0);
    expect(res.result).to.be.an('object');
    expect(res.result.orgId).to.be.equals(orgCreateSuccessResult.result.orgId);
    expect(res.result.username).to.be.equals(
      orgCreateSuccessResult.result.username
    );
  });

  it('Should throw an error if provided with a message that does not have result info', () => {
    try {
      new OrgCreateResultParser(
        `sfdx force:org:create --json --loglevel fatal ${EOL} sfdx force:org:create --json --loglevel fatal ended with exit code 0`
      );
    } catch (err) {
      expect(err.name).to.be.equals('OrgCreateParserFail');
      expect(err.message).to.be.equals('Error parsing org create result');
    }
  });
});
