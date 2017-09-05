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
import * as jsforce from 'jsforce';
import * as path from 'path';
import {
  SObjectCategory,
  SObjectDescribe
} from '../../src/describe/sObjectDescribe';

describe('Fetch sObjects', function() {
  // tslint:disable-next-line:no-invalid-this
  this.timeout(10000);
  let username: string;
  const sobjectdescribe = new SObjectDescribe();
  const scratchDefFilePath = path.join(
    __dirname,
    'test',
    'integration',
    'config',
    'project-scratch-def.json'
  );

  before(async function() {
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force:org:create')
        .withFlag('--definitionfile', scratchDefFilePath)
        .withArg('--json')
        .build(),
      { cwd: process.cwd() }
    ).execute();
    const cmdOutput = new CommandOutput();

    const result = await cmdOutput.getCmdResult(execution);
    username = JSON.parse(result).result.username;
    await createCustomObject(username);
  });

  it('Should be able to call describe global', async function() {
    const cmdOutput = await sobjectdescribe.describeGlobal(
      process.cwd(),
      SObjectCategory.CUSTOM,
      username
    );
    expect(cmdOutput.length).to.be.equal(1);
    expect(cmdOutput[0]).to.be.equal('SampleObject__c');
  });
});

async function createCustomObject(username: string) {
  let orgInfo: any;
  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder()
      .withArg('force:org:display')
      .withFlag('--targetusername', username)
      .withArg('--json')
      .build(),
    { cwd: process.cwd() }
  ).execute();
  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  orgInfo = JSON.parse(result).result;
  const token = orgInfo.accessToken;
  const url = orgInfo.instanceUrl;

  const conn = new jsforce.Connection({
    accessToken: token,
    instanceUrl: url
  });
  const customObject = {
    fullName: 'SampleObject__c',
    label: 'Sample Object',
    pluralLabel: 'Sample Object',
    nameField: {
      type: 'Text',
      label: 'Sample Object'
    },
    deploymentStatus: 'Deployed',
    sharingModel: 'ReadWrite'
  };
  const mdapi = (conn as any).metadata;
  await mdapi.create('CustomObject', customObject, function(
    err: any,
    metadata: any
  ) {
    if (err) {
      Promise.reject(err);
    }
  });
}
