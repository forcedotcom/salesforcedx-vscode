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
  ForcePushResultParser,
  ForceSourcePushErrorResponse,
  ForceSourcePushSuccessResponse
} from '../../../../src/cli';

describe('force:source:push parser', () => {
  let pushErrorResult: ForceSourcePushErrorResponse;
  let pushSuccessResult: ForceSourcePushSuccessResponse;

  beforeEach(() => {
    pushErrorResult = {
      message: 'Push failed.',
      name: 'PushFailed',
      stack: '123',
      status: 1,
      warnings: [],
      data: []
    };
    pushSuccessResult = {
      status: 0,
      result: { pushedSource: [] }
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

    pushErrorResult.data.push(resultItem);

    const parser = new ForcePushResultParser(JSON.stringify(pushErrorResult));
    const errs = parser.getErrors();
    if (errs) {
      expect(errs.message).to.be.equals(pushErrorResult.message);
      expect(errs.name).to.be.equals(pushErrorResult.name);
      expect(errs.data)
        .to.be.an('array')
        .to.have.lengthOf(1);
      expect(errs.data[0]).to.deep.equals(resultItem);
      expect(errs.stack).to.be.equals(pushErrorResult.stack);
      expect(errs.status).to.be.equals(pushErrorResult.status);
      expect(errs.warnings).to.deep.equals(pushErrorResult.warnings);
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

    const parser = new ForcePushResultParser(JSON.stringify(stdOut));
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
    pushErrorResult.data.push({
      filePath: 'src/apexclasses/Testing.cls',
      error: 'Invalid dependency ...',
      lineNumber: '10',
      columnNumber: '23',
      type: 'ApexClass',
      fullName: 'Testing'
    });

    const parser = new ForcePushResultParser(
      `sfdx force:source:deploy --json --loglevel fatal --manifest /Users/username/manifest/package.xml ${EOL} ${JSON.stringify(
        pushErrorResult
      )} ${EOL} sfdx force:source:deploy --json --loglevel fatal --manifest /Users/username/project/manifest/package.xml ended with exit code 1`
    );
    const errs = parser.getErrors();

    if (errs) {
      expect(errs.message).to.be.equals(pushErrorResult.message);
      expect(errs.name).to.be.equals(pushErrorResult.name);
      expect(errs.data)
        .to.be.an('array')
        .to.have.lengthOf(1);
      expect(errs.data[0]).to.deep.equals(pushErrorResult.data[0]);
      expect(errs.stack).to.be.equals(pushErrorResult.stack);
      expect(errs.status).to.be.equals(pushErrorResult.status);
      expect(errs.warnings).to.deep.equals(pushErrorResult.warnings);
    } else {
      throw Error('Errors should be present but were not returned');
    }
  });

  it('Should aggregate multiple errors on same path', async () => {
    const path = 'src/apexclasses/Testing.cls';
    pushErrorResult.data.push({
      filePath: path,
      error: 'asdf',
      lineNumber: '1',
      columnNumber: '1',
      type: '123',
      fullName: 'Testing'
    });

    pushErrorResult.data.push({
      filePath: path,
      error: 'asdf2',
      lineNumber: '2',
      columnNumber: '2',
      type: '123',
      fullName: 'Testing'
    });

    const parser = new ForcePushResultParser(JSON.stringify(pushErrorResult));
    const errs = parser.getErrors();
    if (errs) {
      expect(errs.message).to.be.equals(pushErrorResult.message);
      expect(errs.name).to.be.equals(pushErrorResult.name);
      expect(errs.data)
        .to.be.an('array')
        .to.have.lengthOf(2);
      expect(errs.data[0]).to.deep.equals(pushErrorResult.data[0]);
      expect(errs.data[1]).to.deep.equals(pushErrorResult.data[1]);
      expect(errs.stack).to.be.equals(pushErrorResult.stack);
      expect(errs.status).to.be.equals(pushErrorResult.status);
      expect(errs.warnings).to.deep.equals(pushErrorResult.warnings);
    } else {
      throw Error('Errors should be present but were not returned');
    }
  });

  it('Should parse success info successfully', () => {
    pushSuccessResult.result.pushedSource.push({
      state: 'Add',
      type: 'ApexClass',
      fullName: 'MyClass',
      filePath: 'src/classes/MyClass.cls'
    });

    const parser = new ForcePushResultParser(JSON.stringify(pushSuccessResult));
    const successes = parser.getSuccesses();
    if (successes) {
      const parsedPushedSource = successes.result.pushedSource;
      const { pushedSource } = pushSuccessResult.result;
      expect(parsedPushedSource[0].type).to.be.equals(pushedSource[0].type);
      expect(parsedPushedSource[0].state).to.be.equals(pushedSource[0].state);
      expect(parsedPushedSource[0].fullName).to.be.equals(
        pushedSource[0].fullName
      );
      expect(parsedPushedSource[0].filePath).to.be.equals(
        pushedSource[0].filePath
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
    response = Object.assign(response, pushErrorResult);

    const parser = new ForcePushResultParser(JSON.stringify(response));
    const successes = parser.getSuccesses();
    if (successes) {
      const parsedPushedSource = successes.result.pushedSource;
      const { partialSuccess } = response;
      expect(successes.status).to.be.equal(1);
      expect(parsedPushedSource[0].type).to.be.equals(partialSuccess[0].type);
      expect(parsedPushedSource[0].state).to.be.equals(partialSuccess[0].state);
      expect(parsedPushedSource[0].fullName).to.be.equals(
        partialSuccess[0].fullName
      );
      expect(parsedPushedSource[0].filePath).to.be.equals(
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

    const parser = new ForcePushResultParser(JSON.stringify(response));
    const successes = parser.getSuccesses();
    if (successes) {
      const parsedPushedSource = successes.result.pushedSource;
      const pushedSource = response.result.pushedSource;
      expect(successes.status).to.be.equal(0);
      expect(parsedPushedSource.length).to.be.equals(1);
      expect(parsedPushedSource[0].type).to.be.equals(pushedSource[0].type);
      expect(parsedPushedSource[0].state).to.be.equals(pushedSource[0].state);
      expect(parsedPushedSource[0].fullName).to.be.equals(
        pushedSource[0].fullName
      );
      expect(parsedPushedSource[0].filePath).to.be.equals(
        pushedSource[0].filePath
      );
    } else {
      throw Error('Successes should be present but were not returned');
    }
  });

  it('Should detect source conflicts', () => {
    pushErrorResult.name = CONFLICT_ERROR_NAME;
    pushErrorResult.data.push({
      filePath: 'src/apexclasses/Testing.cls',
      type: 'ApexClass',
      fullName: 'Testing',
      state: 'Conflict'
    });

    const parser = new ForcePushResultParser(JSON.stringify(pushErrorResult));
    expect(parser.hasConflicts()).to.be.equals(true);
  });
});
