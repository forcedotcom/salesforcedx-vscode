/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { EOL } from 'os';
import {
  CONFLICT_ERROR_NAME,
  ForceDeployResultParser,
  ForceSourceDeployErrorResponse,
  ForceSourceDeploySuccessResponse
} from '../../../src/cli';

// tslint:disable:no-unused-expression
describe('force:source:deploy parser', () => {
  let deployErrorResult: ForceSourceDeployErrorResponse;
  let deploySuccessResult: ForceSourceDeploySuccessResponse;

  beforeEach(() => {
    deployErrorResult = {
      message: 'Deploy failed.',
      name: 'DeployFailed',
      stack: '123',
      status: 1,
      warnings: [],
      result: []
    };
    deploySuccessResult = {
      status: 0,
      result: { deployedSource: [] }
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

    const parser = new ForceDeployResultParser(
      JSON.stringify(deployErrorResult)
    );
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
    const stdOut = {
      message:
        'The DocumentFolder named folder/image.png was not found in the workspace.',
      status: 1,
      stack:
        'SourceElementDoesNotExist: The DocumentFolder named folder/image.png was not found in the workspace.\n    at Function.create (some/internal/error.js:146:16)\n    at <anonymous>',
      name: 'SourceElementDoesNotExist',
      warnings: ['Some warning message from sfdx cli.']
    };

    const parser = new ForceDeployResultParser(JSON.stringify(stdOut));
    const errs = parser.getErrors();
    if (errs) {
      expect(errs.message).to.be.equals(stdOut.message);
      expect(errs.name).to.be.equals(stdOut.name);
      expect(errs).to.not.have.property('result');
      expect(errs.stack).to.be.equals(stdOut.stack);
      expect(errs.status).to.be.equals(stdOut.status);
      expect(errs.warnings).to.deep.equals(stdOut.warnings);
    } else {
      throw Error('Errors should be present but were not returned');
    }
  });

  it('Should properly parse stdOut amongst output that needs to be ignored', async () => {
    deployErrorResult.result.push({
      filePath: 'src/apexclasses/Testing.cls',
      error: 'Invalid dependency ...',
      lineNumber: '10',
      columnNumber: '23',
      type: 'ApexClass',
      fullName: 'Testing'
    });

    const parser = new ForceDeployResultParser(
      `sfdx force:source:deploy --json --loglevel fatal --manifest /Users/username/manifest/package.xml ${EOL} ${JSON.stringify(
        deployErrorResult
      )} ${EOL} sfdx force:source:deploy --json --loglevel fatal --manifest /Users/username/project/manifest/package.xml ended with exit code 1`
    );
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

    const parser = new ForceDeployResultParser(
      JSON.stringify(deployErrorResult)
    );
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

  it('Should parse success info successfully', () => {
    deploySuccessResult.result.deployedSource.push({
      state: 'Add',
      type: 'ApexClass',
      fullName: 'MyClass',
      filePath: 'src/classes/MyClass.cls'
    });

    const parser = new ForceDeployResultParser(
      JSON.stringify(deploySuccessResult)
    );
    const successes = parser.getSuccesses();
    if (successes) {
      const parsedDeployedSource = successes.result.deployedSource;
      const { deployedSource } = deploySuccessResult.result;
      expect(parsedDeployedSource[0].type).to.be.equals(deployedSource[0].type);
      expect(parsedDeployedSource[0].state).to.be.equals(
        deployedSource[0].state
      );
      expect(parsedDeployedSource[0].fullName).to.be.equals(
        deployedSource[0].fullName
      );
      expect(parsedDeployedSource[0].filePath).to.be.equals(
        deployedSource[0].filePath
      );
    } else {
      throw Error('Successes should be present but were not returned');
    }
  });

  it('Should parse partial success info successfully', () => {
    let response = {
      partialSuccess: [
        {
          state: 'Add',
          type: 'ApexClass',
          fullName: 'MyClass',
          filePath: 'src/classes/MyClass.cls'
        }
      ]
    };
    response = Object.assign(response, deployErrorResult);

    const parser = new ForceDeployResultParser(JSON.stringify(response));
    const successes = parser.getSuccesses();
    if (successes) {
      const parsedDeployedSource = successes.result.deployedSource;
      const { partialSuccess } = response;
      expect(successes.status).to.be.equal(1);
      expect(parsedDeployedSource[0].type).to.be.equals(partialSuccess[0].type);
      expect(parsedDeployedSource[0].state).to.be.equals(
        partialSuccess[0].state
      );
      expect(parsedDeployedSource[0].fullName).to.be.equals(
        partialSuccess[0].fullName
      );
      expect(parsedDeployedSource[0].filePath).to.be.equals(
        partialSuccess[0].filePath
      );
    } else {
      throw Error('Successes should be present but were not returned');
    }
  });

  it('Should parse source:push success successfully', () => {
    const response = {
      status: 0,
      result: {
        pushedSource: [
          {
            state: 'Add',
            type: 'ApexClass',
            fullName: 'MyClass',
            filePath: 'src/classes/MyClass.cls'
          }
        ]
      }
    };

    const parser = new ForceDeployResultParser(JSON.stringify(response));
    const successes = parser.getSuccesses();
    if (successes) {
      const parsedDeployedSource = successes.result.deployedSource;
      const pushedSource = response.result.pushedSource;
      expect(successes.status).to.be.equal(0);
      expect(parsedDeployedSource.length).to.be.equals(1);
      expect(parsedDeployedSource[0].type).to.be.equals(pushedSource[0].type);
      expect(parsedDeployedSource[0].state).to.be.equals(pushedSource[0].state);
      expect(parsedDeployedSource[0].fullName).to.be.equals(
        pushedSource[0].fullName
      );
      expect(parsedDeployedSource[0].filePath).to.be.equals(
        pushedSource[0].filePath
      );
    } else {
      throw Error('Successes should be present but were not returned');
    }
  });

  it('Should detect source conflicts', () => {
    deployErrorResult.name = CONFLICT_ERROR_NAME;
    deployErrorResult.result.push({
      filePath: 'src/apexclasses/Testing.cls',
      type: 'ApexClass',
      fullName: 'Testing',
      state: 'Conflict'
    });

    const parser = new ForceDeployResultParser(
      JSON.stringify(deployErrorResult)
    );
    expect(parser.hasConflicts()).to.be.true;
  });
});
