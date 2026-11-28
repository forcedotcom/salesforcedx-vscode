/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SinonStub } from 'sinon';
import { AuthInfo, ConfigAggregator, Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { fail } from 'node:assert';
import { TraceFlags } from '../../src/utils/traceFlags';
import { nls } from '../../src/i18n';

describe('Trace Flags', () => {
  const $$ = new TestContext();
  const testData = new MockTestOrgData();
  const USER_ID = 'abcd';
  let mockConnection: Connection;
  let flags: TraceFlags;
  let queryStub: SinonStub;
  let toolingCreateStub: SinonStub;
  let toolingQueryStub: SinonStub;
  let toolingUpdateStub: SinonStub;

  beforeEach(async () => {
    await $$.stubAuths(testData);
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    $$.SANDBOX.stub(ConfigAggregator.prototype, 'getPropertyValue')
      .withArgs('defaultusername')
      .returns(testData.username);
  });

  it('should validate an existing trace flag', async () => {
    const currDate = Date.now();
    flags = new TraceFlags(mockConnection);
    queryStub = $$.SANDBOX.stub(mockConnection, 'query');
    toolingCreateStub = $$.SANDBOX.stub(mockConnection.tooling, 'create');
    toolingQueryStub = $$.SANDBOX.stub(mockConnection.tooling, 'query');
    toolingUpdateStub = $$.SANDBOX.stub(mockConnection.tooling, 'update');

    queryStub.onFirstCall().resolves({ done: true, totalSize: 1, records: [{ Id: USER_ID }] });
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
    toolingUpdateStub.onFirstCall().resolves({ success: true }).onSecondCall().resolves({ success: true });

    const ensure = await flags.ensureTraceFlags();

    expect(ensure).toBe(true);
    expect(queryStub.callCount).toBe(1);
    expect(toolingQueryStub.callCount).toBe(1);
    const queryArgs = toolingQueryStub.getCall(0).args;
    expect(queryArgs[0]).toContain(`TracedEntityId='${USER_ID}'`);

    expect(toolingUpdateStub.callCount).toBe(2);

    let updateArgs = toolingUpdateStub.getCall(0).args;
    expect(updateArgs[0]).toBe('DebugLevel');
    expect(updateArgs[1].Id).toBe('00A123456');
    expect(updateArgs[1].ApexCode).toBe('FINEST');
    expect(updateArgs[1].Visualforce).toBe('FINER');

    updateArgs = toolingUpdateStub.getCall(1).args;
    expect(updateArgs[0]).toBe('TraceFlag');
    expect(updateArgs[1].Id).toBe('1234');
    expect(updateArgs[1].StartDate).not.toBe('');
    const expDate = new Date(updateArgs[1].ExpirationDate);
    expect(expDate.getTime() - currDate).toBeGreaterThan(60_000 * 29);

    expect(toolingCreateStub.called).toBe(false);
  });

  it('should return false if updating the debug level fails', async () => {
    flags = new TraceFlags(mockConnection);
    queryStub = $$.SANDBOX.stub(mockConnection, 'query');
    toolingQueryStub = $$.SANDBOX.stub(mockConnection.tooling, 'query');
    toolingUpdateStub = $$.SANDBOX.stub(mockConnection.tooling, 'update');

    queryStub.onFirstCall().resolves({ done: true, totalSize: 1, records: [{ Id: USER_ID }] });
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

    expect(ensure).toBe(false);
  });

  it('should create a new trace flag', async () => {
    const currDate = Date.now();
    flags = new TraceFlags(mockConnection);
    queryStub = $$.SANDBOX.stub(mockConnection, 'query');
    toolingCreateStub = $$.SANDBOX.stub(mockConnection.tooling, 'create');
    toolingQueryStub = $$.SANDBOX.stub(mockConnection.tooling, 'query');
    toolingUpdateStub = $$.SANDBOX.stub(mockConnection.tooling, 'update');

    queryStub.onFirstCall().resolves({ done: true, totalSize: 1, records: [{ Id: USER_ID }] });
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

    expect(ensure).toBe(true);
    expect(queryStub.callCount).toBe(1);
    expect(toolingQueryStub.callCount).toBe(1);

    let createArgs = toolingCreateStub.getCall(0).args;
    expect(createArgs[0]).toBe('DebugLevel');
    expect(createArgs[1].developerName).toContain('SFDC_DevConsole');
    expect(createArgs[1].MasterLabel).toContain('SFDC_DevConsole');
    expect(createArgs[1].ApexCode).toBe('FINEST');
    expect(createArgs[1].Visualforce).toBe('FINER');

    createArgs = toolingCreateStub.getCall(1).args;
    expect(createArgs[0]).toBe('TraceFlag');
    expect(createArgs[1].tracedentityid).toBe(USER_ID);
    expect(createArgs[1].logtype).toBe('DEVELOPER_LOG');
    expect(createArgs[1].debuglevelid).toBe('aBcDeF');
    expect(createArgs[1].StartDate).not.toBe('');
    const expDate = new Date(createArgs[1].ExpirationDate);
    expect(expDate.getTime() - currDate).toBeGreaterThan(60_000 * 29);
  });

  it('should return false if creating trace flag fails', async () => {
    flags = new TraceFlags(mockConnection);
    queryStub = $$.SANDBOX.stub(mockConnection, 'query');
    toolingCreateStub = $$.SANDBOX.stub(mockConnection.tooling, 'create');
    toolingQueryStub = $$.SANDBOX.stub(mockConnection.tooling, 'query');

    queryStub.onFirstCall().resolves({ done: true, totalSize: 1, records: [{ Id: USER_ID }] });
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

    expect(ensure).toBe(false);
  });

  it('should raise error for missing username', async () => {
    flags = new TraceFlags(mockConnection);
    $$.SANDBOX.stub(mockConnection, 'getUsername').returns(undefined);

    try {
      await flags.ensureTraceFlags();
      fail('Expected an error');
    } catch (err) {
      expect(err.message).toBe(nls.localize('error_no_default_username'));
    }
  });

  it('should raise error for unknown user', async () => {
    flags = new TraceFlags(mockConnection);
    $$.SANDBOX.stub(mockConnection, 'query').onFirstCall().resolves({ done: true, totalSize: 0, records: [] });

    try {
      await flags.ensureTraceFlags();
      fail('Expected an error');
    } catch (err) {
      expect(err.message).toBe(nls.localize('trace_flags_unknown_user'));
    }
  });

  it('should raise error on failure to create debug level', async () => {
    flags = new TraceFlags(mockConnection);
    queryStub = $$.SANDBOX.stub(mockConnection, 'query');
    toolingCreateStub = $$.SANDBOX.stub(mockConnection.tooling, 'create');
    toolingQueryStub = $$.SANDBOX.stub(mockConnection.tooling, 'query');

    queryStub.onFirstCall().resolves({ done: true, totalSize: 1, records: [{ Id: USER_ID }] });
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
      expect(err.message).toBe(nls.localize('trace_flags_failed_to_create_debug_level'));
    }
  });

  it('should raise error on failure to find debug level', async () => {
    flags = new TraceFlags(mockConnection);
    queryStub = $$.SANDBOX.stub(mockConnection, 'query');
    toolingQueryStub = $$.SANDBOX.stub(mockConnection.tooling, 'query');
    const debugLevelName = "'" + 'SFDC_Test';

    queryStub.onFirstCall().resolves({ done: true, totalSize: 1, records: [{ Id: USER_ID }] });
    toolingQueryStub
      .onFirstCall()
      .resolves({ done: true, totalSize: 0, records: [] })
      .onSecondCall()
      .resolves({ done: true, totalSize: 0, records: [] });

    try {
      await flags.ensureTraceFlags(debugLevelName);
      fail('Expected to raise an error');
    } catch (err) {
      expect(err.message).toBe(nls.localize('trace_flags_failed_to_find_debug_level', debugLevelName));
    }
  });
});
