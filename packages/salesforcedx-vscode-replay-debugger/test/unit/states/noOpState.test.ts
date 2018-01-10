/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { LaunchRequestArguments } from '../../../src/adapter/apexReplayDebug';
import { LogContext } from '../../../src/core';
import { NoOpState } from '../../../src/states';

// tslint:disable:no-unused-expression
describe('NoOp event', () => {
  it('Should handle event', () => {
    const logFile = new LogContext({
      logFile: '/path/foo.log',
      stopOnEntry: true,
      trace: true
    } as LaunchRequestArguments);
    const unsupported = new NoOpState();

    expect(unsupported.handle(logFile)).to.be.false;
  });
});
