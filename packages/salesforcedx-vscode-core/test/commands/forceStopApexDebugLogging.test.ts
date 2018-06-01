/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { developerLogTraceFlag } from '../../src/commands';
import { ForceStopApexDebugLoggingExecutor } from '../../src/commands/forceStopApexDebugLogging';
import { nls } from '../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Source Status', () => {
  let getDebugLevelIdStub: sinon.SinonStub;
  const fakeTraceFlagId = 'fakeDebugLevelId';

  before(() => {
    getDebugLevelIdStub = sinon
      .stub(developerLogTraceFlag, 'getTraceFlagId')
      .returns(fakeTraceFlagId);
  });

  after(() => {
    getDebugLevelIdStub.restore();
  });

  it('Should build the source command no flag', async () => {
    const forceStopLogging = new ForceStopApexDebugLoggingExecutor();
    const forceStopLoggingCmd = forceStopLogging.build();
    expect(forceStopLoggingCmd.toCommand()).to.equal(
      `sfdx force:data:record:delete --sobjecttype TraceFlag --sobjectid ${fakeTraceFlagId} --usetoolingapi`
    );
    expect(forceStopLoggingCmd.description).to.equal(
      nls.localize('force_stop_apex_debug_logging')
    );
  });
});
