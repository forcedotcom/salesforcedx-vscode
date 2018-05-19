/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { ForceOrgDisplay, OrgInfo, SfdxCommandBuilder } from '../../src/cli';
import childProcess = require('child_process');

describe('force:org:display', () => {
  const mockSpawn = require('mock-spawn');
  let command: ForceOrgDisplay;
  let origSpawn: any;
  let mySpawn: any;
  let cmdWithArgSpy: sinon.SinonSpy;
  let cmdWithJsonSpy: sinon.SinonSpy;
  let cmdBuildSpy: sinon.SinonSpy;

  beforeEach(() => {
    command = new ForceOrgDisplay();
    origSpawn = childProcess.spawn;
    mySpawn = mockSpawn();
    childProcess.spawn = mySpawn;
    cmdWithArgSpy = sinon.spy(SfdxCommandBuilder.prototype, 'withArg');
    cmdWithJsonSpy = sinon.spy(SfdxCommandBuilder.prototype, 'withJson');
    cmdBuildSpy = sinon.spy(SfdxCommandBuilder.prototype, 'build');
  });

  afterEach(() => {
    childProcess.spawn = origSpawn;
    cmdWithArgSpy.restore();
    cmdWithJsonSpy.restore();
    cmdBuildSpy.restore();
  });

  it('Should return org info successfully', async () => {
    const orgInfo: OrgInfo = {
      username: 'name',
      devHubId: 'devHubId',
      id: 'id',
      createdBy: 'someone',
      createdDate: new Date().toDateString(),
      expirationDate: new Date().toDateString(),
      status: 'active',
      edition: 'Enterprise',
      orgName: 'My org',
      accessToken: '123',
      instanceUrl: 'https://wwww.salesforce.com',
      clientId: 'foo'
    };
    mySpawn.setDefault(
      mySpawn.simple(0, `{ "status": 0, "result": ${JSON.stringify(orgInfo)}}`)
    );

    const cmdOutput: OrgInfo = await command.getOrgInfo('foo');

    expect(cmdOutput).to.deep.equal(orgInfo);
    expect(cmdWithArgSpy.calledOnce).to.equal(true);
    expect(cmdWithArgSpy.getCall(0).args).to.have.same.members([
      'force:org:display'
    ]);
    expect(cmdWithJsonSpy.calledOnce).to.equal(true);
    expect(cmdBuildSpy.calledOnce).to.equal(true);
  });

  it('Should reject with command error', async () => {
    mySpawn.setDefault(mySpawn.simple(1, '', 'There was an error'));

    try {
      await command.getOrgInfo('foo');
    } catch (error) {
      expect(error).to.equal('There was an error');
    }
  });

  it('Should reject with unparseable command output', async () => {
    mySpawn.setDefault(mySpawn.simple(0, '{ not valid JSON'));

    try {
      await command.getOrgInfo('foo');
    } catch (error) {
      expect(error).to.equal('{ not valid JSON');
    }
  });
});
