/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import {
  ForceDeployResultParser,
  ForceSourceDeployErrorResult
} from '../../../src/cli';

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
    const resultItem = {
      filePath: 'src/apexclasses/Testing.cls',
      error: 'asdf',
      lineNumber: '1',
      columnNumber: '1',
      type: 'ApexClass',
      fullName: 'Testing'
    };

    deployErrorResult.result.push(resultItem);

    const parser = new ForceDeployResultParser(JSON.stringify(deployErrorResult));
    const errs = parser.getErrors();
    if (errs) {
      expect(errs.message).to.be.equals(deployErrorResult.message);
      expect(errs.name).to.be.equals(deployErrorResult.name);
      expect(errs.result)
        .to.be.an('array')
        .to.have.lengthOf(1);
      expect(errs.result[0]).to.deep.equals(resultItem);
      expect(errs.stack).to.be.equals(deployErrorResult.stack);
      expect(errs.status).to.be.equals(deployErrorResult.status);
      expect(errs.warnings).to.deep.equals(deployErrorResult.warnings);
    } else {
      throw Error('Errors should be present but were not returned');
    }
  });

  it('Should parse incomplete error info successfully', async () => {
    const stdErr = {
      message:
        'The DocumentFolder named folder/image.png was not found in the workspace.',
      status: 1,
      stack:
        'SourceElementDoesNotExist: The DocumentFolder named folder/image.png was not found in the workspace.\n    at Function.create (some/internal/error.js:146:16)\n    at <anonymous>',
      name: 'SourceElementDoesNotExist',
      warnings: ['Some warning message from sfdx cli.']
    };

    const parser = new ForceDeployResultParser(JSON.stringify(stdErr));
    const errs = parser.getErrors();
    if (errs) {
      expect(errs.message).to.be.equals(stdErr.message);
      expect(errs.name).to.be.equals(stdErr.name);
      expect(errs).to.not.have.property('result');
      expect(errs.stack).to.be.equals(stdErr.stack);
      expect(errs.status).to.be.equals(stdErr.status);
      expect(errs.warnings).to.deep.equals(stdErr.warnings);
    } else {
      throw Error('Errors should be present but were not returned');
    }
  });

  it('Should properly parse stderr amongst output that needs to be ignored', async () => {
    deployErrorResult.result.push({
      filePath: 'src/apexclasses/Testing.cls',
      error: 'Invalid dependency ...',
      lineNumber: '10',
      columnNumber: '23',
      type: 'ApexClass',
      fullName: 'Testing'
    });

    const parser = new ForceDeployResultParser(
      `sfdx force:source:deploy --json --loglevel fatal --manifest /Users/username/manifest/package.xml ${
      require('os').EOL
    } ${JSON.stringify(deployErrorResult)} ${
      require('os').EOL
    } sfdx force:source:deploy --json --loglevel fatal --manifest /Users/username/project/manifest/package.xml ended with exit code 1`);
    const errs = parser.getErrors();

    if (errs) {
      expect(errs.message).to.be.equals(deployErrorResult.message);
      expect(errs.name).to.be.equals(deployErrorResult.name);
      expect(errs.result)
        .to.be.an('array')
        .to.have.lengthOf(1);
      expect(errs.result[0]).to.deep.equals(deployErrorResult.result[0]);
      expect(errs.stack).to.be.equals(deployErrorResult.stack);
      expect(errs.status).to.be.equals(deployErrorResult.status);
      expect(errs.warnings).to.deep.equals(deployErrorResult.warnings);
    } else {
      throw Error('Errors should be present but were not returned');
    }
  });

  it('Should aggregate multiple errors on same path', async () => {
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

    const parser = new ForceDeployResultParser(JSON.stringify(deployErrorResult));
    const errs = parser.getErrors();
    if (errs) {
      expect(errs.message).to.be.equals(deployErrorResult.message);
      expect(errs.name).to.be.equals(deployErrorResult.name);
      expect(errs.result)
        .to.be.an('array')
        .to.have.lengthOf(2);
      expect(errs.result[0]).to.deep.equals(deployErrorResult.result[0]);
      expect(errs.result[1]).to.deep.equals(deployErrorResult.result[1]);
      expect(errs.stack).to.be.equals(deployErrorResult.stack);
      expect(errs.status).to.be.equals(deployErrorResult.status);
      expect(errs.warnings).to.deep.equals(deployErrorResult.warnings);
    } else {
      throw Error('Errors should be present but were not returned');
    }
  });
});
