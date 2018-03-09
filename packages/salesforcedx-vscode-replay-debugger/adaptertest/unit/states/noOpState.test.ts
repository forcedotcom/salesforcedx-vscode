/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import {
  ApexReplayDebug,
  LaunchRequestArguments
} from '../../../src/adapter/apexReplayDebug';
import { LogContext } from '../../../src/core';
import { NoOpState } from '../../../src/states';

// tslint:disable:no-unused-expression
describe('NoOp event', () => {
  it('Should handle event', () => {
    const context = new LogContext(
      {
        logFile: '/path/foo.log',
        trace: true
      } as LaunchRequestArguments,
      new ApexReplayDebug()
    );
    const unsupported = new NoOpState();

    expect(unsupported.handle(context)).to.be.false;
  });
});
