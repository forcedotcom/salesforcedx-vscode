/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { StackFrame } from 'vscode-debugadapter';
import {
  ApexReplayDebug,
  LaunchRequestArguments
} from '../../../src/adapter/apexReplayDebug';
import { BreakpointUtil } from '../../../src/breakpoints';
import {
  EVENT_CODE_UNIT_FINISHED,
  EVENT_CODE_UNIT_STARTED,
  EVENT_CONSTRUCTOR_ENTRY,
  EVENT_CONSTRUCTOR_EXIT,
  EVENT_EXECUTE_ANONYMOUS,
  EVENT_HEAP_DUMP,
  EVENT_METHOD_ENTRY,
  EVENT_METHOD_EXIT,
  EVENT_STATEMENT_EXECUTE,
  EVENT_USER_DEBUG,
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
  StatementExecuteState,
  UserDebugState
} from '../../../src/states';

// tslint:disable:no-unused-expression
describe('LogContext', () => {
  let context: LogContext;
  let readLogFileStub: sinon.SinonStub;
  let getFileSizeStub: sinon.SinonStub;
  let parseLogEventStub: sinon.SinonStub;
  let noOpHandleStub: sinon.SinonStub;
  let shouldTraceLogFileStub: sinon.SinonStub;
  let printToDebugConsoleStub: sinon.SinonStub;
  let getTopFrameStub: sinon.SinonStub;
  let hasHeapDumpStub: sinon.SinonStub;
  let revertStateAfterHeapDumpSpy: sinon.SinonSpy;
  const launchRequestArgs: LaunchRequestArguments = {
    logFile: '/path/foo.log',
    trace: true,
    projectPath: 'path/project'
  };

  beforeEach(() => {
    readLogFileStub = sinon
      .stub(LogContextUtil.prototype, 'readLogFile')
      .returns([
        '43.0 APEX_CODE,FINEST;...;VISUALFORCE,FINER;..',
        'line1',
        'line2'
      ]);
    getFileSizeStub = sinon
      .stub(LogContextUtil.prototype, 'getFileSize')
      .returns(123);
    shouldTraceLogFileStub = sinon
      .stub(ApexReplayDebug.prototype, 'shouldTraceLogFile')
      .returns(true);
    printToDebugConsoleStub = sinon.stub(
      ApexReplayDebug.prototype,
      'printToDebugConsole'
    );
    revertStateAfterHeapDumpSpy = sinon.spy(
      LogContext.prototype,
      'revertStateAfterHeapDump'
    );
    context = new LogContext(launchRequestArgs, new ApexReplayDebug());
  });

  afterEach(() => {
    readLogFileStub.restore();
    getFileSizeStub.restore();
    if (parseLogEventStub) {
      parseLogEventStub.restore();
    }
    if (noOpHandleStub) {
      noOpHandleStub.restore();
    }
    shouldTraceLogFileStub.restore();
    printToDebugConsoleStub.restore();
    if (getTopFrameStub) {
      getTopFrameStub.restore();
    }
    if (hasHeapDumpStub) {
      hasHeapDumpStub.restore();
    }
    revertStateAfterHeapDumpSpy.restore();
  });

  it('Should return array of log lines', () => {
    const logLines = context.getLogLines();

    expect(logLines.length).to.equal(3);
    expect(logLines[1]).to.equal('line1');
    expect(logLines[2]).to.equal('line2');
  });

  it('Should return log size', () => {
    expect(context.getLogSize()).to.equal(123);
  });

  it('Should have log lines', () => {
    expect(context.hasLogLines()).to.be.true;
  });

  it('Should not have log lines', () => {
    readLogFileStub.restore();
    readLogFileStub = sinon
      .stub(LogContextUtil.prototype, 'readLogFile')
      .returns([]);
    context = new LogContext(launchRequestArgs, new ApexReplayDebug());

    expect(context.hasLogLines()).to.be.false;
  });

  it('Should detect log level requirements', () => {
    expect(context.meetsLogLevelRequirements()).to.be.true;

    readLogFileStub.restore();
    readLogFileStub = sinon
      .stub(LogContextUtil.prototype, 'readLogFile')
      .returns([
        '43.0 APEX_CODE,DEBUG;...;VISUALFORCE,DEBUG;..',
        'line1',
        'line2'
      ]);
    context = new LogContext(launchRequestArgs, new ApexReplayDebug());

    expect(context.meetsLogLevelRequirements()).to.be.false;
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

    context.updateFrames();

    expect(context.getLogLinePosition()).to.equal(3);
  });

  it('Should continue handling until the end of log file', () => {
    noOpHandleStub = sinon.stub(NoOpState.prototype, 'handle').returns(false);
    parseLogEventStub = sinon
      .stub(LogContext.prototype, 'parseLogEvent')
      .returns(new NoOpState());

    context.updateFrames();

    expect(context.getLogLinePosition()).to.equal(3);
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

    context.updateFrames();

    expect(context.getLogLinePosition()).to.equal(1);
    expect(context.hasState()).to.be.true;
    expect(context.getFrames()).to.be.empty;
    expect(printToDebugConsoleStub.calledTwice).to.be.true;
  });

  it('Should revert state if there is a heapdump', () => {
    hasHeapDumpStub = sinon
      .stub(LogContext.prototype, 'hasHeapDump')
      .returns(true);
    context = new LogContext(launchRequestArgs, new ApexReplayDebug());

    context.updateFrames();

    expect(revertStateAfterHeapDumpSpy.calledOnce).to.be.true;
  });

  it('Should not revert state if there is no heapdump', () => {
    hasHeapDumpStub = sinon
      .stub(LogContext.prototype, 'hasHeapDump')
      .returns(false);
    context = new LogContext(launchRequestArgs, new ApexReplayDebug());

    context.updateFrames();

    expect(revertStateAfterHeapDumpSpy.called).to.be.false;
  });

  it('Should detect and parse HEAP_DUMP log entries', () => {
    readLogFileStub.restore();
    readLogFileStub = sinon
      .stub(LogContextUtil.prototype, 'readLogFile')
      .returns([
        '43.0 APEX_CODE,FINEST;...;VISUALFORCE,FINER;..',
        '<TimeInfo>|HEAP_DUMP|[11]|<HeapDumpId1>|<ClassName1>|<Namespace1>|11',
        '<TimeInfo>|HEAP_DUMP|[22]|<HeapDumpId2>|<ClassName2>|<Namespace2>|22'
      ]);
    context = new LogContext(launchRequestArgs, new ApexReplayDebug());
    expect(context.scanLogForHeapDumpLines()).to.be.true;
    expect(context.hasHeapDump()).to.be.true;
    const apexHeapDumps = context.getHeapDumps();
    expect(apexHeapDumps.length).to.equal(2);
    expect(apexHeapDumps[0].getHeapDumpId()).to.equal('<HeapDumpId1>');
    expect(apexHeapDumps[1].getHeapDumpId()).to.equal('<HeapDumpId2>');
    expect(apexHeapDumps[0].getClassName()).to.equal('<ClassName1>');
    expect(apexHeapDumps[1].getClassName()).to.equal('<ClassName2>');
    expect(apexHeapDumps[0].getNamespace()).to.equal('<Namespace1>');
    expect(apexHeapDumps[1].getNamespace()).to.equal('<Namespace2>');
    expect(apexHeapDumps[0].getLine()).to.equal(11);
    expect(apexHeapDumps[1].getLine()).to.equal(22);
  });

  it('Should not find heapdump with incorrect line', () => {
    readLogFileStub.restore();
    readLogFileStub = sinon
      .stub(LogContextUtil.prototype, 'readLogFile')
      .returns([
        '43.0 APEX_CODE,FINEST;...;VISUALFORCE,FINER;..',
        '<TimeInfo>|HEAP_DUMP|[11]|<HeapDumpId1>|ClassName1|Namespace1|11'
      ]);

    context = new LogContext(launchRequestArgs, new ApexReplayDebug());

    expect(context.scanLogForHeapDumpLines()).to.be.true;
    const heapdump = context.getHeapDumpForThisLocation('ClassName1', 22);
    expect(heapdump).to.be.undefined;
  });

  it('Should not find heapdump with incorrect class name', () => {
    readLogFileStub.restore();
    readLogFileStub = sinon
      .stub(LogContextUtil.prototype, 'readLogFile')
      .returns([
        '43.0 APEX_CODE,FINEST;...;VISUALFORCE,FINER;..',
        '<TimeInfo>|HEAP_DUMP|[11]|<HeapDumpId1>|ClassName1|Namespace1|11'
      ]);

    context = new LogContext(launchRequestArgs, new ApexReplayDebug());

    expect(context.scanLogForHeapDumpLines()).to.be.true;
    const heapdump = context.getHeapDumpForThisLocation('ClassName2', 11);
    expect(heapdump).to.be.undefined;
  });

  it('Should have heapdump for top frame', () => {
    readLogFileStub.restore();
    readLogFileStub = sinon
      .stub(LogContextUtil.prototype, 'readLogFile')
      .returns([
        '43.0 APEX_CODE,FINEST;...;VISUALFORCE,FINER;..',
        `<TimeInfo>|${EVENT_HEAP_DUMP}|[11]|<HeapDumpId1>|ClassName1|Namespace1|11`
      ]);
    getTopFrameStub = sinon.stub(LogContext.prototype, 'getTopFrame').returns({
      name: 'ClassName1',
      line: 11
    } as StackFrame);

    context = new LogContext(launchRequestArgs, new ApexReplayDebug());
    context.setState(new LogEntryState());
    context.parseLogEvent(
      `<TimeInfo>|${EVENT_HEAP_DUMP}|[11]|<HeapDumpId1>|ClassName1|Namespace1|11`
    );

    expect(context.scanLogForHeapDumpLines()).to.be.true;
    expect(context.hasHeapDumpForTopFrame()).to.equal('<HeapDumpId1>');
  });

  it('Should not have heapdump for top frame', () => {
    readLogFileStub.restore();
    readLogFileStub = sinon
      .stub(LogContextUtil.prototype, 'readLogFile')
      .returns([
        '43.0 APEX_CODE,FINEST;...;VISUALFORCE,FINER;..',
        `<TimeInfo>|${EVENT_HEAP_DUMP}|[11]|<HeapDumpId1>|ClassName1|Namespace1|11`
      ]);
    getTopFrameStub = sinon.stub(LogContext.prototype, 'getTopFrame').returns({
      name: 'ClassName1',
      line: 22
    } as StackFrame);

    context = new LogContext(launchRequestArgs, new ApexReplayDebug());
    context.setState(new LogEntryState());
    context.parseLogEvent(
      `<TimeInfo>|${EVENT_HEAP_DUMP}|[11]|<HeapDumpId1>|ClassName1|Namespace1|11`
    );

    expect(context.scanLogForHeapDumpLines()).to.be.true;
    expect(context.hasHeapDumpForTopFrame()).to.be.undefined;
  });

  describe('Log event parser', () => {
    beforeEach(() => {
      context = new LogContext(launchRequestArgs, new ApexReplayDebug());
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

    it('Should detect UserDebug with USER_DEBUG', () => {
      context.setState(new LogEntryState());

      expect(
        context.parseLogEvent(`|${EVENT_USER_DEBUG}|[1]|DEBUG|Hello`)
      ).to.be.an.instanceof(UserDebugState);
    });
  });

  describe('Signature-to-URI', () => {
    let getTyperefMappingStub: sinon.SinonStub;
    const typerefMapping: Map<string, string> = new Map();
    typerefMapping.set('namespace/Foo$Bar', '/path/foo.cls');
    typerefMapping.set('namespace/Foo', '/path/foo.cls');
    typerefMapping.set(
      '__sfdc_trigger/namespace/MyTrigger',
      '/path/MyTrigger.trigger'
    );

    beforeEach(() => {
      getTyperefMappingStub = sinon
        .stub(BreakpointUtil.prototype, 'getTyperefMapping')
        .returns(typerefMapping);
    });

    afterEach(() => {
      getTyperefMappingStub.restore();
    });

    it('Should return debug log fs path for execute anonymous signature', () => {
      expect(context.getUriFromSignature(EXEC_ANON_SIGNATURE)).to.equal(
        context.getLogFilePath()
      );
    });

    it('Should return URI for inner class', () => {
      expect(
        context.getUriFromSignature(
          'namespace.Foo.Bar(namespace.Foo.Bar, String, Map<String,String>, List<String>)'
        )
      ).to.equal('/path/foo.cls');
    });

    it('Should return URI for trigger', () => {
      expect(
        context.getUriFromSignature('__sfdc_trigger/namespace/MyTrigger')
      ).to.be.equal('/path/MyTrigger.trigger');
    });
  });
});
