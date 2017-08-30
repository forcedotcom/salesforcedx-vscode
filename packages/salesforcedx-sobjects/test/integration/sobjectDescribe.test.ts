/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { expect } from 'chai';
import * as fs from 'fs';
import * as sinon from 'sinon';
import { SObjectDescribe } from '../../src/describe/sObjectDescribe';
import { SObjectDescribeGlobal } from '../../src/describe/sObjectDescribeGlobal';
import childProcess = require('child_process');

describe('Fetch sObjects', () => {
  const sobjectdescribe = new SObjectDescribe();
  const describeGlobal = new SObjectDescribeGlobal();

  const scratchDefFilePath = 'config/sfdx-project.json';
  before(function(done) {
    console.log(process.cwd());

    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force:org:create')
        .withFlag('--definitionfile', scratchDefFilePath)
        .withArg('--json')
        .build(),
      { cwd: process.cwd() }
    ).execute();
  });

  after(() => {
    //
  });

  describe('Command line interaction', () => {
    it('Should be able to call describe global', async function() {
      const cmdOutput = await describeGlobal.describeGlobal(
        process.cwd(),
        'custom'
      );
      expect(cmdOutput.length).to.be.equal(0);

      // cmdOutput = await describeGlobal.describeGlobal(
      //   process.cwd(),
      //   'standard'
      // );
      // expect(cmdOutput.length).to.be.equal(396);
    });

    // it('Should be able to call describe global', done => {
    //   const cmdOutput: Promise<string[]> = describeGlobal.describeGlobal(
    //     process.cwd(),
    //     'all'
    //   );
    //   cmdOutput
    //     .then(result => {
    //       expect(result).to.equal('');
    //     })
    //     .then(done, done);

    //   //expect(cmdOutput.length).to.equal(2);
    // });
  });

  it('Should be able to call describe', async () => {
    const cmdOutput = await sobjectdescribe.describe(process.cwd(), 'Account');
    expect(cmdOutput.name).to.equal('Account');
  });
});
