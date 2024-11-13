/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { developerLogTraceFlag, StopApexDebugLoggingExecutor } from '../../../src/commands';
import { nls } from '../../../src/messages';

// tslint:disable:no-unused-expression
describe('Source Status', () => {
  let getDebugLevelIdStub: sinon.SinonStub;
  const fakeTraceFlagId = 'fakeDebugLevelId';

  beforeEach(() => {
    getDebugLevelIdStub = sinon.stub(developerLogTraceFlag, 'getTraceFlagId').returns(fakeTraceFlagId);
  });

  afterEach(() => {
    getDebugLevelIdStub.restore();
  });

  it('Should build the source command no flag', async () => {
    const forceStopLogging = new StopApexDebugLoggingExecutor();
    const forceStopLoggingCmd = forceStopLogging.build();
    expect(forceStopLoggingCmd.toCommand()).to.equal(
      `sf data:delete:record --sobject TraceFlag --record-id ${fakeTraceFlagId} --use-tooling-api`
    );
    expect(forceStopLoggingCmd.description).to.equal(nls.localize('stop_apex_debug_logging'));
  });
});
