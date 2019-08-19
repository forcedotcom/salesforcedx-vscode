/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fail } from 'assert';
import { expect } from 'chai';
import { EOL } from 'os';
import {
  DiffErrorResponse,
  DiffResultParser,
  DiffSuccessResponse
} from '../../../src/cli';

// tslint:disable:no-unused-expression
describe('force:source:diff parser', () => {
  it('Should parse error info successfully', () => {
    const errorResult = {
      status: 1,
      name: 'Error',
      message:
        'The path could not be found in the project. Specify a path that exists in the file system.',
      exitCode: 1,
      commandName: 'Diff',
      stack:
        'Error: The path could not be found in the project. Specify a path that exists in the file system.',
      warnings: {}
    };
    const parser = new DiffResultParser(JSON.stringify(errorResult));

    expect(parser.isSuccessful()).to.be.false;
    const errs = parser.getErrorResponse() as DiffErrorResponse;
    expect(errs.status).to.be.equals(1);
    expect(errs.name).to.be.equals(errorResult.name);
    expect(errs.message).to.be.equals(errorResult.message);
    expect(errs.exitCode).to.be.equals(1);
    expect(errs.commandName).to.be.equals(errorResult.commandName);
    expect(errs.stack).to.be.equals(errorResult.stack);
    expect(errs.warnings).to.deep.equals(errorResult.warnings);
  });

  it('Should parse success info successfully', () => {
    const successResult = {
      status: 0,
      result: {
        remote:
          '/Users/myuser/project/.sfdx/orgs/user@example.dev/diffCache/classes/currentClass.cls',
        local:
          '/Users/myuser/project/force-app/main/default/classes/currentClass.cls',
        fileName: 'currentClass.cls'
      }
    };

    const parser = new DiffResultParser(JSON.stringify(successResult));

    expect(parser.isSuccessful()).to.be.true;

    const res = parser.getSuccessResponse() as DiffSuccessResponse;
    expect(res.status).to.be.equals(0);
    expect(res.result).to.be.an('object');
    expect(res.result.remote).to.be.equals(successResult.result.remote);
    expect(res.result.local).to.be.equals(successResult.result.local);
    expect(res.result.fileName).to.be.equals(successResult.result.fileName);
  });

  it('Should parse success info successfully when provided along other info', () => {
    const successResult = {
      status: 0,
      result: {
        remote:
          '/Users/myuser/project/.sfdx/orgs/user@example.dev/diffCache/classes/currentClass.cls',
        local:
          '/Users/myuser/project/force-app/main/default/classes/currentClass.cls',
        fileName: 'currentClass.cls'
      }
    };

    const parser = new DiffResultParser(
      `sfdx force:source:diff --json --loglevel fatal ${EOL} ${JSON.stringify(
        successResult
      )} ${EOL} sfdx force:source:diff --json --loglevel fatal ended with exit code 0`
    );

    expect(parser.isSuccessful()).to.be.true;

    const res = parser.getSuccessResponse() as DiffSuccessResponse;
    expect(res.status).to.be.equals(0);
    expect(res.result).to.be.an('object');
    expect(res.result.remote).to.be.equals(successResult.result.remote);
    expect(res.result.local).to.be.equals(successResult.result.local);
    expect(res.result.fileName).to.be.equals(successResult.result.fileName);
  });

  it('Should throw an error if provided with a message that does not have result info', () => {
    try {
      new DiffResultParser(
        `sfdx force:source:diff --json --loglevel fatal ${EOL} sfdx force:source:diff --json --loglevel fatal ended with exit code 0`
      );
      fail('DiffResultParser should have failed');
    } catch (err) {
      expect(err.name).to.be.equals('DiffResultParserFail');
      expect(err.message).to.be.equals('Error parsing diff result');
    }
  });
});
