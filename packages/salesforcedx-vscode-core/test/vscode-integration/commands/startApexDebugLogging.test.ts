/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  CreateDebugLevel,
  CreateTraceFlag,
  developerLogTraceFlag,
  QueryTraceFlag,
  QueryUser,
  StartApexDebugLoggingExecutor,
  UpdateDebugLevelsExecutor,
  UpdateTraceFlagsExecutor
} from '../../../src/commands';
import { APEX_CODE_DEBUG_LEVEL, VISUALFORCE_DEBUG_LEVEL } from '../../../src/constants';
import { nls } from '../../../src/messages';

// tslint:disable:no-unused-expression
describe('Start Apex Debug Logging', () => {
  let getTraceFlagIdStub: sinon.SinonStub;
  let getDebugLevelIdStub: sinon.SinonStub;
  let startDateStub: sinon.SinonStub;
  let expDateStub: sinon.SinonStub;
  const fakeTraceFlagId = 'fakeTraceFlagId';
  const fakeDebugLevelId = 'fakeDebugLevelId';
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + 1000);

  beforeEach(() => {
    getTraceFlagIdStub = sinon.stub(developerLogTraceFlag, 'getTraceFlagId').returns(fakeTraceFlagId);
    getDebugLevelIdStub = sinon.stub(developerLogTraceFlag, 'getDebugLevelId').returns(fakeDebugLevelId);
    startDateStub = sinon.stub(developerLogTraceFlag, 'getStartDate').returns(startDate);
    expDateStub = sinon.stub(developerLogTraceFlag, 'getExpirationDate').returns(endDate);
  });

  afterEach(() => {
    getTraceFlagIdStub.restore();
    getDebugLevelIdStub.restore();
    startDateStub.restore();
    expDateStub.restore();
  });

  it('Should build the start logging command and only have description set', async () => {
    const startLoggingExecutor = new StartApexDebugLoggingExecutor();
    const startLoggingCmd = startLoggingExecutor.build();
    expect(startLoggingCmd.toCommand().trim()).to.equal(nls.localize('start_apex_debug_logging'));
  });

  it('Should build the traceflag query command for logging', async () => {
    const queryTraceFlagsExecutor = new QueryTraceFlag();
    const updateTraceFlagCmd = queryTraceFlagsExecutor.build('005x00000000123');
    expect(updateTraceFlagCmd.toCommand()).to.equal(
      "sf data:query --query SELECT id, logtype, startdate, expirationdate, debuglevelid, debuglevel.apexcode, debuglevel.visualforce FROM TraceFlag WHERE logtype='DEVELOPER_LOG' AND TracedEntityId='005x00000000123' --use-tooling-api --json"
    );
  });

  it('Should build the traceflag update command for logging', async () => {
    const updateTraceFlagsExecutor = new UpdateTraceFlagsExecutor();
    const updateTraceFlagCmd = updateTraceFlagsExecutor.build();
    expect(updateTraceFlagCmd.toCommand()).to.equal(
      `sf data:update:record --sobject TraceFlag --record-id ${fakeTraceFlagId} --values StartDate='' ExpirationDate='${endDate.toUTCString()}' --use-tooling-api --json`
    );
  });

  it('Should build the debuglevel update command for logging', async () => {
    const updateDebugLevelsExecutor = new UpdateDebugLevelsExecutor();
    const updateDebugLevelCmd = updateDebugLevelsExecutor.build();
    expect(updateDebugLevelCmd.toCommand()).to.equal(
      `sf data:update:record --sobject DebugLevel --record-id ${fakeDebugLevelId} --values ApexCode=${APEX_CODE_DEBUG_LEVEL} Visualforce=${VISUALFORCE_DEBUG_LEVEL} --use-tooling-api --json`
    );
  });

  it('Should build the traceflag create command for logging', async () => {
    const createTraceFlagExecutor = new CreateTraceFlag('testUserId');
    const createTraceFlagCmd = createTraceFlagExecutor.build();
    expect(createTraceFlagCmd.toCommand()).to.equal(
      `sf data:create:record --sobject TraceFlag --values tracedentityid='testUserId' logtype=developer_log debuglevelid=${fakeDebugLevelId} StartDate='' ExpirationDate='${endDate.toUTCString()} --use-tooling-api --json`
    );
  });

  it('Should build the debuglevel create command for logging', async () => {
    const createDebugLevelExecutor = new CreateDebugLevel();
    const createDebugLevelCmd = createDebugLevelExecutor.build();
    expect(createDebugLevelCmd.toCommand()).to.equal(
      `sf data:create:record --sobject DebugLevel --values developername=${createDebugLevelExecutor.developerName} MasterLabel=${createDebugLevelExecutor.developerName} apexcode=${APEX_CODE_DEBUG_LEVEL} visualforce=${VISUALFORCE_DEBUG_LEVEL} --use-tooling-api --json`
    );
  });

  it('Should build the user id query command', async () => {
    const testUser = 'user@test.org';
    const forceQueryUserExecutor = new QueryUser(testUser);
    const forceQueryUserCmd = forceQueryUserExecutor.build();
    expect(forceQueryUserCmd.toCommand()).to.equal(
      `sf data:query --query SELECT id FROM User WHERE username='${testUser}' --json`
    );
  });
});
