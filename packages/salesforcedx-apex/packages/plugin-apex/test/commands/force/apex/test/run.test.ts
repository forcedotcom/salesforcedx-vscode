/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TestService } from '@salesforce/apex-node';
import { expect, test } from '@salesforce/command/lib/test';
import { SfdxProject } from '@salesforce/core';
import * as path from 'path';
import { createSandbox, SinonSandbox } from 'sinon';
import { testRunSimple } from './testData';

const SFDX_PROJECT_PATH = 'test-sfdx-project';
const TEST_USERNAME = 'test@example.com';
const projectPath = path.resolve(SFDX_PROJECT_PATH);
const sfdxProjectJson = {
  packageDirectories: [{ path: 'force-app', default: true }],
  namespace: '',
  sfdcLoginUrl: 'https://login.salesforce.com',
  sourceApiVersion: '49.0'
};

describe('force:apex:test:run', () => {
  let sandboxStub: SinonSandbox;

  beforeEach(async () => {
    sandboxStub = createSandbox();
    sandboxStub.stub(SfdxProject, 'resolve').returns(
      Promise.resolve(({
        getPath: () => projectPath,
        resolveProjectConfig: () => sfdxProjectJson
      } as unknown) as SfdxProject)
    );
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .stub(TestService.prototype, 'runTestAsynchronous', () => testRunSimple)
    .stdout()
    .command([
      'force:apex:test:run',
      '--tests',
      'MyApexTests',
      '--resultformat',
      'human'
    ])
    .it('should return a success human format message', ctx => {
      const result = ctx.stdout;
      expect(result).to.not.be.empty;
      expect(result).to.contain('Test Summary');
      expect(result).to.contain('Test Results');
      expect(result).to.not.contain('Apex Code Coverage by Class');
    });
});
