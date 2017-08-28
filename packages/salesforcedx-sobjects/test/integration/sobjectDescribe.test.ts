/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { expect } from 'chai';
import * as fs from 'fs';
import * as sinon from 'sinon';
import { SObjectDescribeGlobal } from '../../src/describe/sObjectDescribeGlobal';
import { CommandOutput } from '../../src/utils/commandOutput';
import childProcess = require('child_process');

describe('Fetch sObjects', () => {
  const describeGlobal = new SObjectDescribeGlobal();

  const scratchDefFileName = 'sfdx-project.json';
  const scratchFileContent = '{}';
  before(() => {
    console.log(process.cwd());
    fs.writeFileSync(scratchDefFileName, scratchFileContent);

    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force:org:create')
        .withFlag('--definitionfile', scratchDefFileName)
        .build(),
      { cwd: process.cwd() }
    ).execute();
  });

  after(() => {
    //
    fs.unlinkSync(scratchDefFileName);
  });

  describe('Command line interaction', () => {
    it('Should have the sfdx command by default', async () => {
      const cmdOutput: string[] = await describeGlobal.describeGlobal(
        'anyPath',
        'custom'
      );

      expect(cmdOutput.length).to.equal(2);
    });
  });
});
