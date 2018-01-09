/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { LaunchRequestArguments } from '../../../src/adapter/apexReplayDebug';
import { LogFile } from '../../../src/core';
import { NoOp } from '../../../src/events';

// tslint:disable:no-unused-expression
describe('NoOp event', () => {
  it('Should handle event', () => {
    const logFile = new LogFile({
      logFile: '/path/foo.log',
      stopOnEntry: true,
      trace: true
    } as LaunchRequestArguments);
    const unsupported = new NoOp();

    expect(unsupported.handleThenStop(logFile)).to.be.false;
  });
});
