/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  CliCommandExecutor,
  CommandOutput
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { expect } from 'chai';
import * as fs from 'fs';
import * as sinon from 'sinon';
import {
  folderTypes,
  forceListMetadata,
  ForceListMetadataExecutor
} from '../../../src/commands';

describe('Force List Metadata', () => {
  it('Should build list metadata command', async () => {
    const metadataType = 'ApexClass';
    const defaultUsername = 'test-username1@example.com';
    const forceListMetadataExec = new ForceListMetadataExecutor(
      metadataType,
      defaultUsername
    );
    const forceDescribeMetadataCmd = forceListMetadataExec.build({});
    expect(forceDescribeMetadataCmd.toCommand()).to.equal(
      `sfdx force:mdapi:listmetadata -m ${metadataType} -u ${defaultUsername} --json --loglevel fatal`
    );
  });

  it('Should build list metadata command with folder arg', async () => {
    const defaultUsername = 'test-username1@example.com';
    for (const type of folderTypes) {
      const forceListMetadataExec = new ForceListMetadataExecutor(
        type,
        defaultUsername
      );
      const forceDescribeMetadataCmd = forceListMetadataExec.build({});
      expect(forceDescribeMetadataCmd.toCommand()).to.equal(
        `sfdx force:mdapi:listmetadata -m ${type} -u ${defaultUsername} --json --loglevel fatal --folder unfiled$public`
      );
    }
  });

  it('Should write a file with metadata list output', async () => {
    const outputFolder = '/test/folder/';
    const metadataType = 'ApexClass';
    const defaultUsername = 'test-username1@example.com';
    const writeFileStub = sinon.stub(fs, 'writeFileSync');
    const resultData = '{status: 0}';
    const cmdOutputStub = sinon
      .stub(CommandOutput.prototype, 'getCmdResult')
      .returns(resultData);
    const cliExecStub = sinon.stub(CliCommandExecutor.prototype, 'execute');
    const result = await forceListMetadata(
      metadataType,
      defaultUsername,
      outputFolder
    );
    expect(writeFileStub.calledOnce).to.equal(true);
    expect(result).to.equal(resultData);
    writeFileStub.restore();
    cmdOutputStub.restore();
    cliExecStub.restore();
  });
});
