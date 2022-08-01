/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, ConfigAggregator, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { fail } from 'assert';
import { expect } from 'chai';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { TraceFlags } from '../../src/utils/traceFlags';
import { nls } from '../../src/i18n';

const $$ = testSetup();

describe('Trace Flags', () => {
  const testData = new MockTestOrgData();
  const USER_ID = 'abcd';
  let mockConnection: Connection;
  let sb: SinonSandbox;
  let flags: TraceFlags;
  let queryStub: SinonStub;
  let toolingCreateStub: SinonStub;
  let toolingQueryStub: SinonStub;
  let toolingUpdateStub: SinonStub;

  beforeEach(async () => {
    sb = createSandbox();
    await $$.stubAuths(testData);
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    sb.stub(ConfigAggregator.prototype, 'getPropertyValue')
      .withArgs('defaultusername')
      .returns(testData.username);
  });

  afterEach(() => {
    sb.restore();
  });

  it('should validate an existing trace flag', async () => {
    const currDate = Date.now();
    flags = new TraceFlags(mockConnection);
    queryStub = sb.stub(mockConnection, 'query');
    toolingCreateStub = sb.stub(mockConnection.tooling, 'create');
    toolingQueryStub = sb.stub(mockConnection.tooling, 'query');
    toolingUpdateStub = sb.stub(mockConnection.tooling, 'update');

    queryStub
      .onFirstCall()
      .resolves({ done: true, totalSize: 1, records: [{ Id: USER_ID }] });
    toolingQueryStub.onFirstCall().resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          Id: '1234',
          DebugLevelId: '00A123456',
          LogType: 'developer_log',
          StartDate: null,
          ExpirationDate: null,
          DebugLevel: { ApexCode: '', VisualForce: '' }
        }
      ]
    });
    toolingUpdateStub
      .onFirstCall()
      .resolves({ success: true })
      .onSecondCall()
      .resolves({ success: true });

    const ensure = await flags.ensureTraceFlags();

    expect(ensure).to.equal(true);
    expect(queryStub.callCount, 'Query stub called').to.equal(1);
    expect(toolingQueryStub.callCount, 'Tooling stub called').to.equal(1);
    const queryArgs = toolingQueryStub.getCall(0).args;
    expect(queryArgs[0]).to.contain(`TracedEntityId='${USER_ID}'`);

    expect(toolingUpdateStub.callCount, 'Tooling update').to.equal(2);

    let updateArgs = toolingUpdateStub.getCall(0).args;
    expect(updateArgs[0]).to.equal('DebugLevel');
    expect(updateArgs[1].Id).to.equal('00A123456');
    expect(updateArgs[1].ApexCode).to.equal('FINEST');
    expect(updateArgs[1].Visualforce).to.equal('FINER');

    updateArgs = toolingUpdateStub.getCall(1).args;
    expect(updateArgs[0]).to.equal('TraceFlag');
    expect(updateArgs[1].Id).to.equal('1234');
    expect(updateArgs[1].StartDate).to.not.equal('');
    const expDate = new Date(updateArgs[1].ExpirationDate);
    expect(expDate.getTime() - currDate).to.be.greaterThan(60000 * 29);

    expect(toolingCreateStub.called).to.equal(false);
  });

  it('should return false if updating the debug level fails', async () => {
    flags = new TraceFlags(mockConnection);
    queryStub = sb.stub(mockConnection, 'query');
    toolingQueryStub = sb.stub(mockConnection.tooling, 'query');
    toolingUpdateStub = sb.stub(mockConnection.tooling, 'update');

    queryStub
      .onFirstCall()
      .resolves({ done: true, totalSize: 1, records: [{ Id: USER_ID }] });
    toolingQueryStub.onFirstCall().resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          Id: '1234',
          DebugLevelId: '00A123456',
          LogType: 'developer_log',
          StartDate: null,
          ExpirationDate: null,
          DebugLevel: { ApexCode: '', VisualForce: '' }
        }
      ]
    });
    toolingUpdateStub.onFirstCall().resolves({ success: false });

    const ensure = await flags.ensureTraceFlags();

    expect(ensure).to.equal(false);
  });

  it('should create a new trace flag', async () => {
    const currDate = Date.now();
    flags = new TraceFlags(mockConnection);
    queryStub = sb.stub(mockConnection, 'query');
    toolingCreateStub = sb.stub(mockConnection.tooling, 'create');
    toolingQueryStub = sb.stub(mockConnection.tooling, 'query');
    toolingUpdateStub = sb.stub(mockConnection.tooling, 'update');

    queryStub
      .onFirstCall()
      .resolves({ done: true, totalSize: 1, records: [{ Id: USER_ID }] });
    toolingQueryStub.onFirstCall().resolves({
      done: true,
      totalSize: 0,
      records: []
    });

    toolingCreateStub
      .onFirstCall()
      .resolves({ success: true, id: 'aBcDeF' })
      .onSecondCall()
      .resolves({ success: true, id: '01020304' });

    const ensure = await flags.ensureTraceFlags();

    expect(ensure).to.equal(true);
    expect(queryStub.callCount, 'Query stub called').to.equal(1);
    expect(toolingQueryStub.callCount, 'Tooling stub called').to.equal(1);

    let createArgs = toolingCreateStub.getCall(0).args;
    expect(createArgs[0]).to.equal('DebugLevel');
    expect(createArgs[1].developerName).to.contain('SFDC_DevConsole');
    expect(createArgs[1].MasterLabel).to.contain('SFDC_DevConsole');
    expect(createArgs[1].ApexCode).to.equal('FINEST');
    expect(createArgs[1].Visualforce).to.equal('FINER');

    createArgs = toolingCreateStub.getCall(1).args;
    expect(createArgs[0]).to.equal('TraceFlag');
    expect(createArgs[1].tracedentityid).to.equal(USER_ID);
    expect(createArgs[1].logtype).to.equal('DEVELOPER_LOG');
    expect(createArgs[1].debuglevelid).to.equal('aBcDeF');
    expect(createArgs[1].StartDate).to.not.equal('');
    const expDate = new Date(createArgs[1].ExpirationDate);
    expect(expDate.getTime() - currDate).to.be.greaterThan(60000 * 29);
  });

  it('should return false if creating trace flag fails', async () => {
    flags = new TraceFlags(mockConnection);
    queryStub = sb.stub(mockConnection, 'query');
    toolingCreateStub = sb.stub(mockConnection.tooling, 'create');
    toolingQueryStub = sb.stub(mockConnection.tooling, 'query');

    queryStub
      .onFirstCall()
      .resolves({ done: true, totalSize: 1, records: [{ Id: USER_ID }] });
    toolingQueryStub.onFirstCall().resolves({
      done: true,
      totalSize: 0,
      records: []
    });

    toolingCreateStub
      .onFirstCall()
      .resolves({ success: true, id: 'debug123' })
      .onSecondCall()
      .resolves({ success: false });

    const ensure = await flags.ensureTraceFlags();

    expect(ensure).to.equal(false);
  });

  it('should raise error for missing username', async () => {
    flags = new TraceFlags(mockConnection);
    sb.stub(mockConnection, 'getUsername').returns(undefined);

    try {
      await flags.ensureTraceFlags();
      fail('Expected an error');
    } catch (err) {
      expect(err.message).to.equal(nls.localize('error_no_default_username'));
    }
  });

  it('should raise error for unknown user', async () => {
    flags = new TraceFlags(mockConnection);
    sb.stub(mockConnection, 'query')
      .onFirstCall()
      .resolves({ done: true, totalSize: 0, records: [] });

    try {
      await flags.ensureTraceFlags();
      fail('Expected an error');
    } catch (err) {
      expect(err.message).to.equal(nls.localize('trace_flags_unknown_user'));
    }
  });

  it('should raise error on failure to create debug level', async () => {
    flags = new TraceFlags(mockConnection);
    queryStub = sb.stub(mockConnection, 'query');
    toolingCreateStub = sb.stub(mockConnection.tooling, 'create');
    toolingQueryStub = sb.stub(mockConnection.tooling, 'query');

    queryStub
      .onFirstCall()
      .resolves({ done: true, totalSize: 1, records: [{ Id: USER_ID }] });
    toolingQueryStub.onFirstCall().resolves({
      done: true,
      totalSize: 0,
      records: []
    });
    toolingCreateStub.onFirstCall().resolves({ success: false, id: undefined });

    try {
      await flags.ensureTraceFlags();
      fail('Expected to raise an error');
    } catch (err) {
      expect(err.message).to.equal(
        nls.localize('trace_flags_failed_to_create_debug_level')
      );
    }
  });

  it('should raise error on failure to find debug level', async () => {
    flags = new TraceFlags(mockConnection);
    queryStub = sb.stub(mockConnection, 'query');
    toolingQueryStub = sb.stub(mockConnection.tooling, 'query');
    const debugLevelName = "'" + 'SFDC_Test';

    queryStub
      .onFirstCall()
      .resolves({ done: true, totalSize: 1, records: [{ Id: USER_ID }] });
    toolingQueryStub
      .onFirstCall()
      .resolves({ done: true, totalSize: 0, records: [] })
      .onSecondCall()
      .resolves({ done: true, totalSize: 0, records: [] });

    try {
      await flags.ensureTraceFlags(debugLevelName);
      fail('Expected to raise an error');
    } catch (err) {
      expect(err.message).to.equal(
        nls.localize('trace_flags_failed_to_find_debug_level', debugLevelName)
      );
    }
  });
});
