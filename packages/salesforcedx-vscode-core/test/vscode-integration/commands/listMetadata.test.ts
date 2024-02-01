/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CommandOutput } from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import * as fs from 'fs';
import * as sinon from 'sinon';
import {
  listMetadata,
  ListMetadataExecutor
} from '../../../src/commands';

describe('List Metadata', () => {
  it('Should build list metadata command', async () => {
    const metadataType = 'ApexClass';
    const defaultUsername = 'test-username1@example.com';
    const listMetadataExec = new ListMetadataExecutor(
      metadataType,
      defaultUsername
    );
    const listMetadataCmd = listMetadataExec.build({});
    expect(listMetadataCmd.toCommand()).to.equal(
      `sfdx org:list:metadata -m ${metadataType} -o ${defaultUsername} --json`
    );
  });

  it('Should build list metadata command with folder arg', async () => {
    const metadataType = 'Report';
    const defaultUsername = 'test-username1@example.com';
    const folder = 'SampleFolder';
    const listMetadataExec = new ListMetadataExecutor(
      metadataType,
      defaultUsername,
      folder
    );
    const describeMetadataCmd = listMetadataExec.build({});
    expect(describeMetadataCmd.toCommand()).to.equal(
      `sfdx org:list:metadata -m ${metadataType} -o ${defaultUsername} --json --folder ${folder}`
    );
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
    const execStub = sinon.stub(ListMetadataExecutor.prototype, 'execute');
    const result = await listMetadata(
      metadataType,
      defaultUsername,
      outputFolder
    );
    expect(writeFileStub.calledOnce).to.equal(true);
    expect(result).to.equal(resultData);
    writeFileStub.restore();
    cmdOutputStub.restore();
    execStub.restore();
  });
});
