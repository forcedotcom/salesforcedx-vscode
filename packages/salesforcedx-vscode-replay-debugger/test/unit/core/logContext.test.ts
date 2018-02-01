/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { StackFrame } from 'vscode-debugadapter';
import { LaunchRequestArguments } from '../../../src/adapter/apexReplayDebug';
import { BreakpointUtil } from '../../../src/breakpoints';
import {
  EVENT_CODE_UNIT_FINISHED,
  EVENT_CODE_UNIT_STARTED,
  EVENT_CONSTRUCTOR_ENTRY,
  EVENT_CONSTRUCTOR_EXIT,
  EVENT_EXECUTE_ANONYMOUS,
  EVENT_METHOD_ENTRY,
  EVENT_METHOD_EXIT,
  EVENT_STATEMENT_EXECUTE,
  EVENT_VF_APEX_CALL_END,
  EVENT_VF_APEX_CALL_START,
  EXEC_ANON_SIGNATURE
} from '../../../src/constants';
import { LogContext, LogContextUtil } from '../../../src/core';
import {
  FrameEntryState,
  FrameExitState,
  LogEntryState,
  NoOpState,
  StatementExecuteState
} from '../../../src/states';

// tslint:disable:no-unused-expression
describe('LogContext', () => {
  let context: LogContext;
  let readLogFileStub: sinon.SinonStub;
  let parseLogEventStub: sinon.SinonStub;
  let noOpHandleStub: sinon.SinonStub;
  const launchRequestArgs: LaunchRequestArguments = {
    logFile: '/path/foo.log',
    trace: true
  };
  // tslint:disable-next-line:no-empty
  const debugConsoleHandler = (message: string) => { };

  beforeEach(() => {
    readLogFileStub = sinon
      .stub(LogContextUtil.prototype, 'readLogFile')
      .returns(['line1', 'line2']);
    context = new LogContext(launchRequestArgs, new BreakpointUtil());
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
    context = new LogContext(launchRequestArgs, new BreakpointUtil());

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
    expect(context.getNumOfFrames()).to.equal(0);
    expect(context.getTopFrame()).to.be.undefined;
  });

  it('Should start with no state', () => {
    expect(context.hasState()).to.be.false;
  });

  it('Should handle undefined log event', () => {
    parseLogEventStub = sinon
      .stub(LogContext.prototype, 'parseLogEvent')
      .returns(undefined);

    context.updateFrames(debugConsoleHandler);

    expect(context.getLogLinePosition()).to.equal(2);
  });

  it('Should continue handling until the end of log file', () => {
    noOpHandleStub = sinon.stub(NoOpState.prototype, 'handle').returns(false);
    parseLogEventStub = sinon
      .stub(LogContext.prototype, 'parseLogEvent')
      .returns(new NoOpState());

    context.updateFrames(debugConsoleHandler);

    expect(context.getLogLinePosition()).to.equal(2);
    expect(context.hasState()).to.be.true;
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
    context.setState(new LogEntryState());
    context.getFrames().push({} as StackFrame);

    context.updateFrames(debugConsoleHandler);

    expect(context.getLogLinePosition()).to.equal(1);
    expect(context.hasState()).to.be.true;
    expect(context.getFrames()).to.be.empty;
  });

  describe('Log event parser', () => {
    beforeEach(() => {
      context = new LogContext(launchRequestArgs, new BreakpointUtil());
    });

    it('Should detect LogEntry as the first state', () => {
      expect(context.parseLogEvent('')).to.be.an.instanceof(LogEntryState);
    });

    it('Should detect NoOp with empty log line', () => {
      context.setState(new LogEntryState());
      expect(context.parseLogEvent('')).to.be.an.instanceof(NoOpState);
    });

    it('Should detect NoOp with unexpected number of fields', () => {
      context.setState(new LogEntryState());
      expect(context.parseLogEvent('timestamp|foo')).to.be.an.instanceof(
        NoOpState
      );
    });

    it('Should detect NoOp with unknown event', () => {
      context.setState(new LogEntryState());
      expect(context.parseLogEvent('timestamp|foo|bar')).to.be.an.instanceof(
        NoOpState
      );
    });

    it('Should detect execute anonymous script line', () => {
      context.setState(new LogEntryState());
      context.parseLogEvent(`${EVENT_EXECUTE_ANONYMOUS}: foo`);

      expect(context.getExecAnonScriptMapping().size).to.equal(1);
      expect(context.getExecAnonScriptMapping().get(1)).to.equal(0);
    });

    it('Should detect FrameEntry with CODE_UNIT_STARTED', () => {
      context.setState(new LogEntryState());

      expect(
        context.parseLogEvent(`|${EVENT_CODE_UNIT_STARTED}|`)
      ).to.be.an.instanceof(FrameEntryState);
    });

    it('Should detect FrameEntry with CONSTRUCTOR_ENTRY', () => {
      context.setState(new LogEntryState());

      expect(
        context.parseLogEvent(`|${EVENT_CONSTRUCTOR_ENTRY}|`)
      ).to.be.an.instanceof(FrameEntryState);
    });

    it('Should detect FrameEntry with METHOD_ENTRY', () => {
      context.setState(new LogEntryState());

      expect(
        context.parseLogEvent(`|${EVENT_METHOD_ENTRY}|`)
      ).to.be.an.instanceof(FrameEntryState);
    });

    it('Should detect FrameEntry with VF_APEX_CALL_START', () => {
      context.setState(new LogEntryState());

      expect(
        context.parseLogEvent(`|${EVENT_VF_APEX_CALL_START}|`)
      ).to.be.an.instanceof(FrameEntryState);
    });

    it('Should detect FrameExit with CODE_UNIT_FINISHED', () => {
      context.setState(new LogEntryState());

      expect(
        context.parseLogEvent(`|${EVENT_CODE_UNIT_FINISHED}|`)
      ).to.be.an.instanceof(FrameExitState);
    });

    it('Should detect FrameExit with CONSTRUCTOR_EXIT', () => {
      context.setState(new LogEntryState());

      expect(
        context.parseLogEvent(`|${EVENT_CONSTRUCTOR_EXIT}|`)
      ).to.be.an.instanceof(FrameExitState);
    });

    it('Should detect FrameExit with METHOD_EXIT', () => {
      context.setState(new LogEntryState());

      expect(
        context.parseLogEvent(`|${EVENT_METHOD_EXIT}|`)
      ).to.be.an.instanceof(FrameExitState);
    });

    it('Should detect FrameExit with VF_APEX_CALL_END', () => {
      context.setState(new LogEntryState());

      expect(
        context.parseLogEvent(`|${EVENT_VF_APEX_CALL_END}|`)
      ).to.be.an.instanceof(FrameExitState);
    });

    it('Should detect StatementExecute with STATEMENT_EXECUTE', () => {
      context.setState(new LogEntryState());

      expect(
        context.parseLogEvent(`|${EVENT_STATEMENT_EXECUTE}|[1]`)
      ).to.be.an.instanceof(StatementExecuteState);
    });
  });

  describe('Signature-to-URI', () => {
    let getTyperefMappingStub: sinon.SinonStub;
    const typerefMapping: Map<string, string> = new Map();
    typerefMapping.set('namespace/Foo$Bar', '/path/foo.cls');
    typerefMapping.set('namespace/Foo', '/path/foo.cls');
    typerefMapping.set('__sfdc_trigger/namespace/MyTrigger', '/path/MyTrigger.trigger');

    beforeEach(() => {
      getTyperefMappingStub = sinon
        .stub(BreakpointUtil.prototype, 'getTyperefMapping')
        .returns(typerefMapping);
    });

    afterEach(() => {
      getTyperefMappingStub.restore();
    });

    it('Should return debug log path for execute anonymous signature', () => {
      expect(context.getUriFromSignature(EXEC_ANON_SIGNATURE)).to.equal(
        encodeURI('file://' + context.getLogFilePath())
      );
    });

    it('Should return URI for inner class', () => {
      expect(
        context.getUriFromSignature('namespace.Foo.Bar(Integer)')
      ).to.equal('/path/foo.cls');
    });

    it('Should return URI for trigger', () => {
      expect(
        context.getUriFromSignature('__sfdc_trigger/namespace/MyTrigger')
      ).to.be.equal('/path/MyTrigger.trigger');
    });
  });
});
