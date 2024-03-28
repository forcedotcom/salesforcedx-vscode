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
  describeMetadata,
  DescribeMetadataExecutor
} from '../../../src/commands';

// tslint:disable:no-unused-expression
describe('Describe Metadata', () => {
  it('Should build describe metadata command', async () => {
    const describeMetadataExec = new DescribeMetadataExecutor();
    const describeMetadataCmd = describeMetadataExec.build({});
    expect(describeMetadataCmd.toCommand()).to.equal(
      'sf org:list:metadata-types --json'
    );
  });

  it('Should write a file with metadata describe output', async () => {
    const execStub = sinon.stub(DescribeMetadataExecutor.prototype, 'execute');
    const writeFileStub = sinon.stub(fs, 'writeFileSync');

    const outputFolder = './test/folder/';
    const resultData = '{status: 0}';
    const cmdOutputStub = sinon
      .stub(CommandOutput.prototype, 'getCmdResult')
      .returns(resultData);

    const result = await describeMetadata(outputFolder);
    expect(writeFileStub.calledOnce).to.equal(true);
    expect(result).to.equal(resultData);

    writeFileStub.restore();
    cmdOutputStub.restore();
    execStub.restore();
  });
});
