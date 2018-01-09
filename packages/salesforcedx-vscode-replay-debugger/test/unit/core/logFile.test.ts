/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { LaunchRequestArguments } from '../../../src/adapter/apexReplayDebug';
import { LogFile, LogFileUtil } from '../../../src/core';
import { NoOp } from '../../../src/events';

// tslint:disable:no-unused-expression
describe('LogFile', () => {
  let logFile: LogFile;
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
      .stub(LogFileUtil.prototype, 'readLogFile')
      .returns(['line1', 'line2']);
    logFile = new LogFile(launchRequestArgs);
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
    const logLines = logFile.getLogLines();

    expect(logLines.length).to.equal(2);
    expect(logLines[0]).to.equal('line1');
    expect(logLines[1]).to.equal('line2');
  });

  it('Should have log lines', () => {
    expect(logFile.hasLogLines()).to.be.true;
  });

  it('Should not have log lines', () => {
    readLogFileStub.restore();
    readLogFileStub = sinon
      .stub(LogFileUtil.prototype, 'readLogFile')
      .returns([]);
    logFile = new LogFile(launchRequestArgs);

    expect(logFile.hasLogLines()).to.be.false;
  });

  it('Should return log file name', () => {
    expect(logFile.getLogFileName()).to.equal('foo.log');
  });

  it('Should return log file path', () => {
    expect(logFile.getLogFilePath()).to.equal('/path/foo.log');
  });

  it('Should have starting log line position', () => {
    expect(logFile.getLogLinePosition()).to.equal(-1);
  });

  it('Should start with empty array of stackframes', () => {
    expect(logFile.getFrames()).to.be.empty;
  });

  it('Should handle undefined log event', () => {
    parseLogEventStub = sinon
      .stub(LogFileUtil.prototype, 'parseLogEvent')
      .returns(undefined);

    logFile.updateFrames();

    expect(logFile.getLogLinePosition()).to.equal(2);
  });

  it('Should continue handling until the end of log file', () => {
    noOpHandleStub = sinon
      .stub(NoOp.prototype, 'handleThenStop')
      .returns(false);
    parseLogEventStub = sinon
      .stub(LogFileUtil.prototype, 'parseLogEvent')
      .returns(new NoOp());

    logFile.updateFrames();

    expect(logFile.getLogLinePosition()).to.equal(2);
  });

  it('Should pause parsing the log', () => {
    noOpHandleStub = sinon
      .stub(NoOp.prototype, 'handleThenStop')
      .onFirstCall()
      .returns(false)
      .onSecondCall()
      .returns(true);
    parseLogEventStub = sinon
      .stub(LogFileUtil.prototype, 'parseLogEvent')
      .returns(new NoOp());

    logFile.updateFrames();

    expect(logFile.getLogLinePosition()).to.equal(1);
  });
});
