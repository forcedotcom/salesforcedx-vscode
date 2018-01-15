/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { LaunchRequestArguments } from '../../../src/adapter/apexReplayDebug';
import { LogContext, LogContextUtil } from '../../../src/core';
import { LogEntryState, NoOpState } from '../../../src/states';

// tslint:disable:no-unused-expression
describe('LogContext', () => {
  let context: LogContext;
  let readLogFileStub: sinon.SinonStub;
  let parseLogEventStub: sinon.SinonStub;
  let noOpHandleStub: sinon.SinonStub;
  const launchRequestArgs: LaunchRequestArguments = {
    logFile: '/path/foo.log',
    stopOnEntry: true,
    trace: true
  };

  beforeEach(() => {
    readLogFileStub = sinon
      .stub(LogContextUtil.prototype, 'readLogFile')
      .returns(['line1', 'line2']);
    context = new LogContext(launchRequestArgs);
  });

  afterEach(() => {
    readLogFileStub.restore();
    if (parseLogEventStub) {
      parseLogEventStub.restore();
    }
    if (noOpHandleStub) {
      noOpHandleStub.restore();
    }
  });

  it('Should return array of log lines', () => {
    const logLines = context.getLogLines();

    expect(logLines.length).to.equal(2);
    expect(logLines[0]).to.equal('line1');
    expect(logLines[1]).to.equal('line2');
  });

  it('Should have log lines', () => {
    expect(context.hasLogLines()).to.be.true;
  });

  it('Should not have log lines', () => {
    readLogFileStub.restore();
    readLogFileStub = sinon
      .stub(LogContextUtil.prototype, 'readLogFile')
      .returns([]);
    context = new LogContext(launchRequestArgs);

    expect(context.hasLogLines()).to.be.false;
  });

  it('Should return log file name', () => {
    expect(context.getLogFileName()).to.equal('foo.log');
  });

  it('Should return log file path', () => {
    expect(context.getLogFilePath()).to.equal('/path/foo.log');
  });

  it('Should have starting log line position', () => {
    expect(context.getLogLinePosition()).to.equal(-1);
  });

  it('Should start with empty array of stackframes', () => {
    expect(context.getFrames()).to.be.empty;
  });

  it('Should handle undefined log event', () => {
    parseLogEventStub = sinon
      .stub(LogContext.prototype, 'parseLogEvent')
      .returns(undefined);

    context.updateFrames();

    expect(context.getLogLinePosition()).to.equal(2);
  });

  it('Should continue handling until the end of log file', () => {
    noOpHandleStub = sinon.stub(NoOpState.prototype, 'handle').returns(false);
    parseLogEventStub = sinon
      .stub(LogContext.prototype, 'parseLogEvent')
      .returns(new NoOpState());

    context.updateFrames();

    expect(context.getLogLinePosition()).to.equal(2);
  });

  it('Should pause parsing the log', () => {
    noOpHandleStub = sinon
      .stub(NoOpState.prototype, 'handle')
      .onFirstCall()
      .returns(false)
      .onSecondCall()
      .returns(true);
    parseLogEventStub = sinon
      .stub(LogContext.prototype, 'parseLogEvent')
      .returns(new NoOpState());

    context.updateFrames();

    expect(context.getLogLinePosition()).to.equal(1);
  });

  describe('Log event parser', () => {
    beforeEach(() => {
      context = new LogContext(launchRequestArgs);
      context.setState(new LogEntryState());
    });

    it('Should detect NoOp with empty log line', () => {
      expect(context.parseLogEvent('')).to.be.an.instanceof(NoOpState);
    });

    it('Should detect NoOp with unexpected number of fields', () => {
      expect(context.parseLogEvent('timestamp|foo')).to.be.an.instanceof(
        NoOpState
      );
    });

    it('Should detect NoOp with unknown event', () => {
      expect(context.parseLogEvent('timestamp|foo|bar')).to.be.an.instanceof(
        NoOpState
      );
    });

    it('Should detect LogEntry', () => {
      context.setState(undefined);
      expect(
        context.parseLogEvent(
          '41.0 APEX_CODE,FINEST;APEX_PROFILING,FINEST;CALLOUT,FINEST;DB,FINEST;SYSTEM,FINE;VALIDATION,INFO;VISUALFORCE,FINER;WAVE,FINEST;WORKFLOW,FINER'
        )
      ).to.be.an.instanceof(LogEntryState);
    });
  });
});
