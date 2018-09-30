/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { ForceDeployErrorParser, ForceSourceDeployErrorResult } from '../../src/cli';

describe('force:source:deploy parser', () => {

  let deployErrorResult: ForceSourceDeployErrorResult;

  beforeEach(() => {
    deployErrorResult = {
      message: 'Deploy failed.',
      name: 'DeployFailed',
      stack: '123',
      status: 1,
      warnings: [],
      result: []
    };
  });

  it('Should parse error info successfully', async () => {
    const path = 'src/apexclasses/Testing.cls';
    deployErrorResult.result.push({
      filePath: path,
      error: 'asdf',
      lineNumber: '1',
      columnNumber: '1',
      type: '123',
      fullName: 'Testing'
    });

    const errParser = new ForceDeployErrorParser();
    const errs = errParser.parse(JSON.stringify(deployErrorResult));
    expect(Object.keys(errs).length).to.deep.equal(1);
    expect(errs[path]).to.not.be.null;
    expect(errs[path].length).to.deep.equal(1);
  });

  it('Should handle stderr junk', async () => {
    const path = 'src/apexclasses/Testing.cls';
    deployErrorResult.result.push({
      filePath: path,
      error: 'asdf',
      lineNumber: '1',
      columnNumber: '1',
      type: '123',
      fullName: 'Testing'
    });

    const errParser = new ForceDeployErrorParser();
    const errs = errParser.parse(`asdfghjkl; ${require('os').EOL} ${JSON.stringify(deployErrorResult)}`);

    expect(Object.keys(errs).length).to.deep.equal(1);
  });

  it('Should aggregate multiple errors on same path', async () => {
    const errParser = new ForceDeployErrorParser();

    const path = 'src/apexclasses/Testing.cls';
    deployErrorResult.result.push({
      filePath: path,
      error: 'asdf',
      lineNumber: '1',
      columnNumber: '1',
      type: '123',
      fullName: 'Testing'
    });

    deployErrorResult.result.push({
      filePath: path,
      error: 'asdf2',
      lineNumber: '2',
      columnNumber: '2',
      type: '123',
      fullName: 'Testing'
    });

    const errs = errParser.parse(JSON.stringify(deployErrorResult));
    expect(Object.keys(errs).length).to.deep.equal(1);
    expect(errs[path]).to.not.be.null;
    expect(errs[path].length).to.deep.equal(2);
  });
});
