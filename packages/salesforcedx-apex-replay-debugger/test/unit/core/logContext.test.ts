/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Mock DebugSession.run to prevent it from executing during tests
jest.mock('@vscode/debugadapter', () => ({
  ...jest.requireActual('@vscode/debugadapter'),
  DebugSession: {
    ...jest.requireActual('@vscode/debugadapter').DebugSession,
    run: jest.fn()
  }
}));

import { StackFrame } from '@vscode/debugadapter';
import { ApexReplayDebug } from '../../../src/adapter/apexReplayDebug';
import { LaunchRequestArguments } from '../../../src/adapter/types';
import { breakpointUtil } from '../../../src/breakpoints';
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

describe('LogContext', () => {
  let context: LogContext;
  let readLogFileSpy: jest.SpyInstance;
  let getFileSizeSpy: jest.SpyInstance;
  let shouldTraceLogFileStub: jest.Mock;
  let printToDebugConsoleSpy: jest.SpyInstance;
  let revertStateAfterHeapDumpSpy: jest.SpyInstance;
  let getTyperefMappingSpy: jest.SpyInstance;
  const launchRequestArgs: LaunchRequestArguments = {
    logFileContents: 'test log content',
    logFilePath: '/path/foo.log',
    logFileName: 'foo.log',
    trace: true,
    projectPath: 'path/project'
  };

  beforeEach(() => {
    readLogFileSpy = jest
      .spyOn(LogContextUtil.prototype, 'readLogFileFromContents')
      .mockReturnValue(['43.0 APEX_CODE,FINEST;...;VISUALFORCE,FINER;..', 'line1', 'line2']);
    getFileSizeSpy = jest.spyOn(LogContextUtil.prototype, 'getFileSizeFromContents').mockReturnValue(123);
    shouldTraceLogFileStub = jest.fn().mockReturnValue(true);
    printToDebugConsoleSpy = jest.spyOn(ApexReplayDebug.prototype, 'printToDebugConsole').mockImplementation(() => {});
    revertStateAfterHeapDumpSpy = jest.spyOn(LogContext.prototype, 'revertStateAfterHeapDump');
    context = new LogContext(launchRequestArgs, new ApexReplayDebug());
  });

  afterEach(() => {
    readLogFileSpy.mockRestore();
    getFileSizeSpy.mockRestore();
    shouldTraceLogFileStub.mockRestore();
    printToDebugConsoleSpy.mockRestore();
    revertStateAfterHeapDumpSpy.mockRestore();
    if (getTyperefMappingSpy) getTyperefMappingSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('Should return array of log lines', () => {
    const logLines = context.getLogLines();

    expect(logLines.length).toBe(3);
    expect(logLines[1]).toBe('line1');
    expect(logLines[2]).toBe('line2');
  });

  it('Should return log size', () => {
    expect(context.getLogSize()).toBe(123);
  });

  it('Should have log lines', () => {
    expect(context.hasLogLines()).toBe(true);
  });

  it('Should not have log lines', () => {
    readLogFileSpy.mockRestore();
    readLogFileSpy = jest.spyOn(LogContextUtil.prototype, 'readLogFileFromContents').mockReturnValue([]);
    context = new LogContext(launchRequestArgs, new ApexReplayDebug());

    expect(context.hasLogLines()).toBe(false);
  });

  it('Should detect log level requirements', () => {
    expect(context.meetsLogLevelRequirements()).toBe(true);

    readLogFileSpy.mockRestore();
    readLogFileSpy = jest
      .spyOn(LogContextUtil.prototype, 'readLogFileFromContents')
      .mockReturnValue(['43.0 APEX_CODE,DEBUG;...;VISUALFORCE,DEBUG;..', 'line1', 'line2']);
    context = new LogContext(launchRequestArgs, new ApexReplayDebug());

    expect(context.meetsLogLevelRequirements()).toBe(false);
  });

  it('Should return log file name', () => {
    expect(context.getLogFileName()).toBe('foo.log');
  });

  it('Should return log file path', () => {
    expect(context.getLogFilePath()).toBe('/path/foo.log');
  });

  it('Should have starting log line position', () => {
    expect(context.getLogLinePosition()).toBe(-1);
  });

  it('Should start with empty array of stackframes', () => {
    expect(context.getFrames()).toHaveLength(0);
    expect(context.getNumOfFrames()).toBe(0);
    expect(context.getTopFrame()).toBeUndefined();
  });

  it('Should start with no state', () => {
    expect(context.hasState()).toBe(false);
  });

  it('Should handle undefined log event', () => {
    jest
      .spyOn(LogContext.prototype, 'parseLogEvent')
      .mockReturnValue(undefined as unknown as import('../../../src/states').DebugLogState);
    context.updateFrames();
    expect(context.getLogLinePosition()).toBe(3);
  });

  it('Should continue handling until the end of log file', () => {
    jest.spyOn(NoOpState.prototype, 'handle').mockReturnValue(false);
    jest.spyOn(LogContext.prototype, 'parseLogEvent').mockReturnValue(new NoOpState());
    context.updateFrames();
    expect(context.getLogLinePosition()).toBe(3);
    expect(context.hasState()).toBe(true);
  });

  it('Should pause parsing the log', () => {
    readLogFileSpy.mockRestore();
    // Provide two log lines to ensure two calls to printToDebugConsole
    readLogFileSpy = jest
      .spyOn(LogContextUtil.prototype, 'readLogFileFromContents')
      .mockReturnValue(['43.0 APEX_CODE,FINEST;...;VISUALFORCE,FINER;..', 'line1', 'line2']);
    context = new LogContext(launchRequestArgs, new ApexReplayDebug());
    jest.spyOn(context.getSession(), 'shouldTraceLogFile').mockReturnValue(true);
    let call = 0;
    jest.spyOn(NoOpState.prototype, 'handle').mockImplementation(() => {
      call++;
      return call === 2;
    });
    jest.spyOn(LogContext.prototype, 'parseLogEvent').mockReturnValue(new NoOpState());
    context.setState(new LogEntryState());
    context.getFrames().push({} as StackFrame);
    context.updateFrames();
    expect(context.getLogLinePosition()).toBe(1);
    expect(context.hasState()).toBe(true);
    expect(context.getFrames()).toHaveLength(0);
    expect(printToDebugConsoleSpy).toHaveBeenCalledTimes(2);
  });

  it('Should revert state if there is a heapdump', () => {
    jest.spyOn(LogContext.prototype, 'hasHeapDump').mockReturnValue(true);
    context = new LogContext(launchRequestArgs, new ApexReplayDebug());
    context.updateFrames();
    expect(revertStateAfterHeapDumpSpy).toHaveBeenCalledTimes(1);
  });

  it('Should not revert state if there is no heapdump', () => {
    jest.spyOn(LogContext.prototype, 'hasHeapDump').mockReturnValue(false);
    context = new LogContext(launchRequestArgs, new ApexReplayDebug());
    context.updateFrames();
    expect(revertStateAfterHeapDumpSpy).toHaveBeenCalledTimes(0);
  });

  it('Should detect and parse HEAP_DUMP log entries', () => {
    readLogFileSpy.mockRestore();
    readLogFileSpy = jest
      .spyOn(LogContextUtil.prototype, 'readLogFileFromContents')
      .mockReturnValue([
        '43.0 APEX_CODE,FINEST;...;VISUALFORCE,FINER;..',
        '<TimeInfo>|HEAP_DUMP|[11]|<HeapDumpId1>|<ClassName1>|<Namespace1>|11',
        '<TimeInfo>|HEAP_DUMP|[22]|<HeapDumpId2>|<ClassName2>|<Namespace2>|22'
      ]);
    context = new LogContext(launchRequestArgs, new ApexReplayDebug());
    expect(context.scanLogForHeapDumpLines()).toBe(true);
    expect(context.hasHeapDump()).toBe(true);
    const apexHeapDumps = context.getHeapDumps();
    expect(apexHeapDumps.length).toBe(2);
    expect(apexHeapDumps[0].getHeapDumpId()).toBe('<HeapDumpId1>');
    expect(apexHeapDumps[1].getHeapDumpId()).toBe('<HeapDumpId2>');
    expect(apexHeapDumps[0].getClassName()).toBe('<ClassName1>');
    expect(apexHeapDumps[1].getClassName()).toBe('<ClassName2>');
    expect(apexHeapDumps[0].getNamespace()).toBe('<Namespace1>');
    expect(apexHeapDumps[1].getNamespace()).toBe('<Namespace2>');
    expect(apexHeapDumps[0].getLine()).toBe(11);
    expect(apexHeapDumps[1].getLine()).toBe(22);
  });

  it('Should not find heapdump with incorrect line', () => {
    readLogFileSpy.mockRestore();
    readLogFileSpy = jest
      .spyOn(LogContextUtil.prototype, 'readLogFileFromContents')
      .mockReturnValue([
        '43.0 APEX_CODE,FINEST;...;VISUALFORCE,FINER;..',
        '<TimeInfo>|HEAP_DUMP|[11]|<HeapDumpId1>|ClassName1|Namespace1|11'
      ]);

    context = new LogContext(launchRequestArgs, new ApexReplayDebug());

    expect(context.scanLogForHeapDumpLines()).toBe(true);
    const heapdump = context.getHeapDumpForThisLocation('ClassName1', 22);
    expect(heapdump).toBeUndefined();
  });

  it('Should not find heapdump with incorrect class name', () => {
    readLogFileSpy.mockRestore();
    readLogFileSpy = jest
      .spyOn(LogContextUtil.prototype, 'readLogFileFromContents')
      .mockReturnValue([
        '43.0 APEX_CODE,FINEST;...;VISUALFORCE,FINER;..',
        '<TimeInfo>|HEAP_DUMP|[11]|<HeapDumpId1>|ClassName1|Namespace1|11'
      ]);

    context = new LogContext(launchRequestArgs, new ApexReplayDebug());

    expect(context.scanLogForHeapDumpLines()).toBe(true);
    const heapdump = context.getHeapDumpForThisLocation('ClassName2', 11);
    expect(heapdump).toBeUndefined();
  });

  it('Should have heapdump for top frame', () => {
    readLogFileSpy.mockRestore();
    readLogFileSpy = jest
      .spyOn(LogContextUtil.prototype, 'readLogFileFromContents')
      .mockReturnValue([
        '43.0 APEX_CODE,FINEST;...;VISUALFORCE,FINER;..',
        `<TimeInfo>|${EVENT_HEAP_DUMP}|[11]|<HeapDumpId1>|ClassName1|Namespace1|11`
      ]);
    jest.spyOn(LogContext.prototype, 'getTopFrame').mockReturnValue({
      name: 'ClassName1',
      line: 11
    } as StackFrame);
    context = new LogContext(launchRequestArgs, new ApexReplayDebug());
    context.setState(new LogEntryState());
    context.parseLogEvent(`<TimeInfo>|${EVENT_HEAP_DUMP}|[11]|<HeapDumpId1>|ClassName1|Namespace1|11`);
    expect(context.scanLogForHeapDumpLines()).toBe(true);
    expect(context.hasHeapDumpForTopFrame()).toBe('<HeapDumpId1>');
  });

  it('Should not have heapdump for top frame', () => {
    readLogFileSpy.mockRestore();
    readLogFileSpy = jest
      .spyOn(LogContextUtil.prototype, 'readLogFileFromContents')
      .mockReturnValue([
        '43.0 APEX_CODE,FINEST;...;VISUALFORCE,FINER;..',
        `<TimeInfo>|${EVENT_HEAP_DUMP}|[11]|<HeapDumpId1>|ClassName1|Namespace1|11`
      ]);
    jest.spyOn(LogContext.prototype, 'getTopFrame').mockReturnValue({
      name: 'ClassName1',
      line: 22
    } as StackFrame);
    context = new LogContext(launchRequestArgs, new ApexReplayDebug());
    context.setState(new LogEntryState());
    context.parseLogEvent(`<TimeInfo>|${EVENT_HEAP_DUMP}|[11]|<HeapDumpId1>|ClassName1|Namespace1|11`);
    expect(context.scanLogForHeapDumpLines()).toBe(true);
    expect(context.hasHeapDumpForTopFrame()).toBeUndefined();
  });

  describe('Log event parser', () => {
    beforeEach(() => {
      context = new LogContext(launchRequestArgs, new ApexReplayDebug());
    });

    it('Should detect LogEntry as the first state', () => {
      expect(context.parseLogEvent('')).toBeInstanceOf(LogEntryState);
    });

    it('Should detect NoOp with empty log line', () => {
      context.setState(new LogEntryState());
      expect(context.parseLogEvent('')).toBeInstanceOf(NoOpState);
    });

    it('Should detect NoOp with unexpected number of fields', () => {
      context.setState(new LogEntryState());
      expect(context.parseLogEvent('timestamp|foo')).toBeInstanceOf(NoOpState);
    });

    it('Should detect NoOp with unknown event', () => {
      context.setState(new LogEntryState());
      expect(context.parseLogEvent('timestamp|foo|bar')).toBeInstanceOf(NoOpState);
    });

    it('Should detect execute anonymous script line', () => {
      context.setState(new LogEntryState());
      context.parseLogEvent(`${EVENT_EXECUTE_ANONYMOUS}: foo`);

      expect(context.getExecAnonScriptMapping().size).toBe(1);
      expect(context.getExecAnonScriptMapping().get(1)).toBe(0);
    });

    it('Should detect FrameEntry with CODE_UNIT_STARTED', () => {
      context.setState(new LogEntryState());

      expect(context.parseLogEvent(`|${EVENT_CODE_UNIT_STARTED}|`)).toBeInstanceOf(FrameEntryState);
    });

    it('Should detect FrameEntry with CONSTRUCTOR_ENTRY', () => {
      context.setState(new LogEntryState());

      expect(context.parseLogEvent(`|${EVENT_CONSTRUCTOR_ENTRY}|`)).toBeInstanceOf(FrameEntryState);
    });

    it('Should detect FrameEntry with METHOD_ENTRY', () => {
      context.setState(new LogEntryState());

      expect(context.parseLogEvent(`|${EVENT_METHOD_ENTRY}|`)).toBeInstanceOf(FrameEntryState);
    });

    it('Should detect FrameEntry with VF_APEX_CALL_START', () => {
      context.setState(new LogEntryState());

      expect(context.parseLogEvent(`|${EVENT_VF_APEX_CALL_START}|`)).toBeInstanceOf(FrameEntryState);
    });

    it('Should detect FrameExit with CODE_UNIT_FINISHED', () => {
      context.setState(new LogEntryState());

      expect(context.parseLogEvent(`|${EVENT_CODE_UNIT_FINISHED}|`)).toBeInstanceOf(FrameExitState);
    });

    it('Should detect FrameExit with CONSTRUCTOR_EXIT', () => {
      context.setState(new LogEntryState());

      expect(context.parseLogEvent(`|${EVENT_CONSTRUCTOR_EXIT}|`)).toBeInstanceOf(FrameExitState);
    });

    it('Should detect FrameExit with METHOD_EXIT', () => {
      context.setState(new LogEntryState());

      expect(context.parseLogEvent(`|${EVENT_METHOD_EXIT}|`)).toBeInstanceOf(FrameExitState);
    });

    it('Should detect FrameExit with VF_APEX_CALL_END', () => {
      context.setState(new LogEntryState());

      expect(context.parseLogEvent(`|${EVENT_VF_APEX_CALL_END}|`)).toBeInstanceOf(FrameExitState);
    });

    it('Should detect StatementExecute with STATEMENT_EXECUTE', () => {
      context.setState(new LogEntryState());

      expect(context.parseLogEvent(`|${EVENT_STATEMENT_EXECUTE}|[1]`)).toBeInstanceOf(StatementExecuteState);
    });

    it('Should detect UserDebug with USER_DEBUG', () => {
      context.setState(new LogEntryState());

      expect(context.parseLogEvent(`|${EVENT_USER_DEBUG}|[1]|DEBUG|Hello`)).toBeInstanceOf(UserDebugState);
    });
  });

  describe('Signature-to-URI', () => {
    const typerefMapping: Map<string, string> = new Map();
    typerefMapping.set('namespace/Foo$Bar', '/path/foo.cls');
    typerefMapping.set('namespace/Foo', '/path/foo.cls');
    typerefMapping.set('__sfdc_trigger/namespace/MyTrigger', '/path/MyTrigger.trigger');

    beforeEach(() => {
      getTyperefMappingSpy = jest.spyOn(breakpointUtil, 'getTyperefMapping').mockReturnValue(typerefMapping);
    });

    afterEach(() => {
      if (getTyperefMappingSpy) getTyperefMappingSpy.mockRestore();
    });

    it('Should return debug log fs path for execute anonymous signature', () => {
      expect(context.getUriFromSignature(EXEC_ANON_SIGNATURE)).toBe(context.getLogFilePath());
    });

    it('Should return URI for inner class', () => {
      expect(
        context.getUriFromSignature('namespace.Foo.Bar(namespace.Foo.Bar, String, Map<String,String>, List<String>)')
      ).toBe('/path/foo.cls');
    });

    it('Should return URI for trigger', () => {
      expect(context.getUriFromSignature('__sfdc_trigger/namespace/MyTrigger')).toStrictEqual(
        '/path/MyTrigger.trigger'
      );
    });
  });
});
