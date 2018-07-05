/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  InitializedEvent,
  Source,
  StackFrame,
  StoppedEvent,
  TerminatedEvent,
  Thread
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import {
  ApexReplayDebug,
  LaunchRequestArguments
} from '../../../src/adapter/apexReplayDebug';
import {
  breakpointUtil,
  BreakpointUtil,
  LineBreakpointEventArgs,
  LineBreakpointInfo
} from '../../../src/breakpoints';
import {
  DEFAULT_INITIALIZE_TIMEOUT_MS,
  LINE_BREAKPOINT_INFO_REQUEST
} from '../../../src/constants';
import { LogContext, LogContextUtil } from '../../../src/core';
import { HeapDumpService } from '../../../src/core/heapDumpService';
import { nls } from '../../../src/messages';

export class MockApexReplayDebug extends ApexReplayDebug {
  public setLogFile(args: LaunchRequestArguments) {
    this.logContext = new LogContext(args, this);
    this.heapDumpService = new HeapDumpService(this.logContext);
  }

  public getDefaultResponse(): DebugProtocol.Response {
    return {
      command: '',
      success: true,
      request_seq: 0,
      seq: 0,
      type: 'response'
    };
  }

  public getTraceConfig(): string[] {
    return this.trace;
  }

  public getTraceAllConfig(): boolean {
    return this.traceAll;
  }

  public getBreakpoints(): Map<string, number[]> {
    return this.breakpoints;
  }

  public shouldStopForBreakpoint(): boolean {
    return super.shouldStopForBreakpoint();
  }

  public setProjectPath(projectPath: string | undefined): void {
    this.projectPath = projectPath;
  }

  public getProjectPath(): string | undefined {
    return this.projectPath;
  }
}

// tslint:disable:no-unused-expression
describe('Replay debugger adapter - unit', () => {
  let adapter: MockApexReplayDebug;
  const logFileName = 'foo.log';
  const logFilePath = `path/${logFileName}`;

  describe('Initialize', () => {
    let sendResponseSpy: sinon.SinonSpy;
    let response: DebugProtocol.InitializeResponse;
    let args: DebugProtocol.InitializeRequestArguments;
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      response = adapter.getDefaultResponse();
      args = {
        adapterID: ''
      };
      sendResponseSpy = sinon.spy(ApexReplayDebug.prototype, 'sendResponse');
      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      sendResponseSpy.restore();
      clock.restore();
    });

    it('Should send successful initialized response', () => {
      adapter.initializeRequest(response, args);

      setTimeout(() => {
        expect(sendResponseSpy.calledOnce).to.be.false;
      }, DEFAULT_INITIALIZE_TIMEOUT_MS);
      clock.tick(DEFAULT_INITIALIZE_TIMEOUT_MS + 1);
    });
  });

  describe('Launch', () => {
    let sendResponseSpy: sinon.SinonSpy;
    let sendEventSpy: sinon.SinonSpy;
    let response: DebugProtocol.LaunchResponse;
    let args: LaunchRequestArguments;
    let hasLogLinesStub: sinon.SinonStub;
    let meetsLogLevelRequirementsStub: sinon.SinonStub;
    let readLogFileStub: sinon.SinonStub;
    let printToDebugConsoleStub: sinon.SinonStub;
    let errorToDebugConsoleStub: sinon.SinonStub;
    let scanLogForHeapDumpLinesStub: sinon.SinonStub;
    let fetchOverlayResultsForApexHeapDumpsStub: sinon.SinonStub;

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      response = adapter.getDefaultResponse();
      args = {
        logFile: logFilePath,
        stopOnEntry: true,
        trace: false
      };
      sendResponseSpy = sinon.spy(ApexReplayDebug.prototype, 'sendResponse');
      sendEventSpy = sinon.spy(ApexReplayDebug.prototype, 'sendEvent');
      readLogFileStub = sinon
        .stub(LogContextUtil.prototype, 'readLogFile')
        .returns(['line1', 'line2']);
      printToDebugConsoleStub = sinon.stub(
        ApexReplayDebug.prototype,
        'printToDebugConsole'
      );
      errorToDebugConsoleStub = sinon.stub(
        ApexReplayDebug.prototype,
        'errorToDebugConsole'
      );
    });

    afterEach(() => {
      sendResponseSpy.restore();
      sendEventSpy.restore();
      hasLogLinesStub.restore();
      meetsLogLevelRequirementsStub.restore();
      readLogFileStub.restore();
      printToDebugConsoleStub.restore();
      errorToDebugConsoleStub.restore();
      if (scanLogForHeapDumpLinesStub) {
        scanLogForHeapDumpLinesStub.restore();
      }
      if (fetchOverlayResultsForApexHeapDumpsStub) {
        fetchOverlayResultsForApexHeapDumpsStub.restore();
      }
    });

    it('Should return error when there are no log lines', async () => {
      hasLogLinesStub = sinon
        .stub(LogContext.prototype, 'hasLogLines')
        .returns(false);
      meetsLogLevelRequirementsStub = sinon
        .stub(LogContext.prototype, 'meetsLogLevelRequirements')
        .returns(false);

      await adapter.launchRequest(response, args);

      expect(hasLogLinesStub.calledOnce).to.be.true;
      expect(meetsLogLevelRequirementsStub.calledOnce).to.be.false;
      expect(sendResponseSpy.calledOnce).to.be.true;
      const actualResponse: DebugProtocol.LaunchResponse = sendResponseSpy.getCall(
        0
      ).args[0];
      expect(actualResponse.success).to.be.false;
      expect(actualResponse.message).to.equal(nls.localize('no_log_file_text'));
    });

    it('Should return error when log levels are incorrect', async () => {
      hasLogLinesStub = sinon
        .stub(LogContext.prototype, 'hasLogLines')
        .returns(true);
      meetsLogLevelRequirementsStub = sinon
        .stub(LogContext.prototype, 'meetsLogLevelRequirements')
        .returns(false);

      await adapter.launchRequest(response, args);

      expect(hasLogLinesStub.calledOnce).to.be.true;
      expect(meetsLogLevelRequirementsStub.calledOnce).to.be.true;
      expect(sendResponseSpy.calledOnce).to.be.true;
      expect(sendEventSpy.calledOnce).to.be.true;
      expect(sendEventSpy.getCall(0).args[0]).to.be.instanceof(
        InitializedEvent
      );
      const actualResponse: DebugProtocol.LaunchResponse = sendResponseSpy.getCall(
        0
      ).args[0];
      expect(actualResponse.success).to.be.false;
      expect(actualResponse.message).to.equal(
        nls.localize('incorrect_log_levels_text')
      );
    });

    it('Should send response', async () => {
      hasLogLinesStub = sinon
        .stub(LogContext.prototype, 'hasLogLines')
        .returns(true);
      meetsLogLevelRequirementsStub = sinon
        .stub(LogContext.prototype, 'meetsLogLevelRequirements')
        .returns(true);

      await adapter.launchRequest(response, args);

      expect(hasLogLinesStub.calledOnce).to.be.true;
      expect(meetsLogLevelRequirementsStub.calledOnce).to.be.true;
      expect(printToDebugConsoleStub.calledOnce).to.be.true;
      const consoleMessage = printToDebugConsoleStub.getCall(0).args[0];
      expect(consoleMessage).to.equal(
        nls.localize('session_started_text', logFileName)
      );
      expect(sendResponseSpy.calledOnce).to.be.true;
      const actualResponse: DebugProtocol.LaunchResponse = sendResponseSpy.getCall(
        0
      ).args[0];
      expect(actualResponse.success).to.be.true;
    });

    it('Should not scan for log lines if projectPath is undefined', async () => {
      hasLogLinesStub = sinon
        .stub(LogContext.prototype, 'hasLogLines')
        .returns(true);
      meetsLogLevelRequirementsStub = sinon
        .stub(LogContext.prototype, 'meetsLogLevelRequirements')
        .returns(true);
      scanLogForHeapDumpLinesStub = sinon
        .stub(LogContext.prototype, 'scanLogForHeapDumpLines')
        .returns(false);

      adapter.setProjectPath(undefined);
      await adapter.launchRequest(response, args);

      expect(hasLogLinesStub.calledOnce).to.be.true;
      expect(meetsLogLevelRequirementsStub.calledOnce).to.be.true;
      expect(scanLogForHeapDumpLinesStub.called).to.be.false;
    });

    it('Should scan log lines for heap dumps if projectPath is set', async () => {
      hasLogLinesStub = sinon
        .stub(LogContext.prototype, 'hasLogLines')
        .returns(true);
      meetsLogLevelRequirementsStub = sinon
        .stub(LogContext.prototype, 'meetsLogLevelRequirements')
        .returns(true);
      scanLogForHeapDumpLinesStub = sinon
        .stub(LogContext.prototype, 'scanLogForHeapDumpLines')
        .returns(false);
      fetchOverlayResultsForApexHeapDumpsStub = sinon
        .stub(LogContext.prototype, 'fetchOverlayResultsForApexHeapDumps')
        .returns(true);

      adapter.setProjectPath('someProjectPath');
      await adapter.launchRequest(response, args);

      expect(hasLogLinesStub.calledOnce).to.be.true;
      expect(meetsLogLevelRequirementsStub.calledOnce).to.be.true;
      expect(scanLogForHeapDumpLinesStub.calledOnce).to.be.true;
      // fetchOverlayResultsForApexHeapDumps should not be called if scanLogForHeapDumpLines returns false
      expect(fetchOverlayResultsForApexHeapDumpsStub.calledOnce).to.be.false;
    });

    it('Should call to fetch overlay results if heap dumps are found in the logs', async () => {
      hasLogLinesStub = sinon
        .stub(LogContext.prototype, 'hasLogLines')
        .returns(true);
      meetsLogLevelRequirementsStub = sinon
        .stub(LogContext.prototype, 'meetsLogLevelRequirements')
        .returns(true);
      scanLogForHeapDumpLinesStub = sinon
        .stub(LogContext.prototype, 'scanLogForHeapDumpLines')
        .returns(true);
      fetchOverlayResultsForApexHeapDumpsStub = sinon
        .stub(LogContext.prototype, 'fetchOverlayResultsForApexHeapDumps')
        .returns(true);

      adapter.setProjectPath('someProjectPath');
      await adapter.launchRequest(response, args);

      expect(hasLogLinesStub.calledOnce).to.be.true;
      expect(meetsLogLevelRequirementsStub.calledOnce).to.be.true;
      expect(scanLogForHeapDumpLinesStub.calledOnce).to.be.true;
      expect(fetchOverlayResultsForApexHeapDumpsStub.calledOnce).to.be.true;
    });

    it('Should report a wrap up error if fetching heap dumps has a failure', async () => {
      hasLogLinesStub = sinon
        .stub(LogContext.prototype, 'hasLogLines')
        .returns(true);
      meetsLogLevelRequirementsStub = sinon
        .stub(LogContext.prototype, 'meetsLogLevelRequirements')
        .returns(true);
      scanLogForHeapDumpLinesStub = sinon
        .stub(LogContext.prototype, 'scanLogForHeapDumpLines')
        .returns(true);
      fetchOverlayResultsForApexHeapDumpsStub = sinon
        .stub(LogContext.prototype, 'fetchOverlayResultsForApexHeapDumps')
        .returns(false);

      adapter.setProjectPath('someProjectPath');
      await adapter.launchRequest(response, args);

      expect(hasLogLinesStub.calledOnce).to.be.true;
      expect(meetsLogLevelRequirementsStub.calledOnce).to.be.true;
      expect(scanLogForHeapDumpLinesStub.calledOnce).to.be.true;
      expect(fetchOverlayResultsForApexHeapDumpsStub.calledOnce).to.be.true;
      expect(errorToDebugConsoleStub.calledOnce).to.be.true;
      const errorMessage = errorToDebugConsoleStub.getCall(0).args[0];
      expect(errorMessage).to.equal(
        nls.localize('heap_dump_error_wrap_up_text')
      );
    });
  });

  describe('Configuration done', () => {
    let sendEventSpy: sinon.SinonSpy;
    let updateFramesStub: sinon.SinonStub;
    let continueRequestStub: sinon.SinonStub;
    let getLaunchArgsStub: sinon.SinonStub;
    let response: DebugProtocol.ConfigurationDoneResponse;
    const args: DebugProtocol.ConfigurationDoneArguments = {};
    const launchRequestArgs: LaunchRequestArguments = {
      logFile: logFilePath,
      trace: true
    };

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      adapter.setLogFile(launchRequestArgs);
      sendEventSpy = sinon.spy(ApexReplayDebug.prototype, 'sendEvent');
      updateFramesStub = sinon.stub(LogContext.prototype, 'updateFrames');
      continueRequestStub = sinon.stub(
        ApexReplayDebug.prototype,
        'continueRequest'
      );
      response = adapter.getDefaultResponse();
    });

    afterEach(() => {
      sendEventSpy.restore();
      updateFramesStub.restore();
      continueRequestStub.restore();
      getLaunchArgsStub.restore();
    });

    it('Should send stopped event', () => {
      getLaunchArgsStub = sinon
        .stub(LogContext.prototype, 'getLaunchArgs')
        .returns({
          stopOnEntry: true
        } as LaunchRequestArguments);

      adapter.configurationDoneRequest(response, args);

      expect(updateFramesStub.called).to.be.true;
      expect(sendEventSpy.calledOnce).to.be.true;
      const event = sendEventSpy.getCall(0).args[0];
      expect(event).to.be.instanceof(StoppedEvent);
    });

    it('Should continue until next breakpoint', () => {
      getLaunchArgsStub = sinon
        .stub(LogContext.prototype, 'getLaunchArgs')
        .returns({
          stopOnEntry: false
        } as LaunchRequestArguments);

      adapter.configurationDoneRequest(response, args);

      expect(updateFramesStub.called).to.be.false;
      expect(sendEventSpy.called).to.be.false;
      expect(updateFramesStub.called).to.be.false;
      expect(continueRequestStub.calledOnce).to.be.true;
    });
  });

  describe('Disconnect', () => {
    let sendResponseSpy: sinon.SinonSpy;
    let response: DebugProtocol.DisconnectResponse;
    let args: DebugProtocol.DisconnectArguments;
    let printToDebugConsoleStub: sinon.SinonStub;

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      response = adapter.getDefaultResponse();
      args = {};
      sendResponseSpy = sinon.spy(ApexReplayDebug.prototype, 'sendResponse');
      printToDebugConsoleStub = sinon.stub(
        ApexReplayDebug.prototype,
        'printToDebugConsole'
      );
    });

    afterEach(() => {
      sendResponseSpy.restore();
      printToDebugConsoleStub.restore();
    });

    it('Should disconnect', () => {
      adapter.disconnectRequest(response, args);

      expect(printToDebugConsoleStub.calledOnce).to.be.true;
      const consoleMessage = printToDebugConsoleStub.getCall(0).args[0];
      expect(consoleMessage).to.equal(nls.localize('session_terminated_text'));
      expect(sendResponseSpy.calledOnce).to.be.true;
      const actualResponse: DebugProtocol.DisconnectResponse = sendResponseSpy.getCall(
        0
      ).args[0];
      expect(actualResponse.success).to.be.true;
    });
  });

  describe('Threads', () => {
    let sendResponseSpy: sinon.SinonSpy;
    let response: DebugProtocol.ThreadsResponse;
    let readLogFileStub: sinon.SinonStub;
    const launchRequestArgs: LaunchRequestArguments = {
      logFile: logFilePath,
      trace: true
    };

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      response = Object.assign(adapter.getDefaultResponse(), {
        body: { threads: [] }
      });
      sendResponseSpy = sinon.spy(ApexReplayDebug.prototype, 'sendResponse');
      readLogFileStub = sinon
        .stub(LogContextUtil.prototype, 'readLogFile')
        .returns(['line1', 'line2']);
      adapter.setLogFile(launchRequestArgs);
    });

    afterEach(() => {
      sendResponseSpy.restore();
      readLogFileStub.restore();
    });

    it('Should always return one thread', () => {
      adapter.threadsRequest(response);

      expect(sendResponseSpy.calledOnce).to.be.true;
      const actualResponse: DebugProtocol.ThreadsResponse = sendResponseSpy.getCall(
        0
      ).args[0];
      expect(actualResponse.success).to.be.true;
      expect(actualResponse.body.threads.length).to.equal(1);
      const thread: Thread = actualResponse.body.threads[0];
      expect(thread.id).to.equal(ApexReplayDebug.THREAD_ID);
    });
  });

  describe('Stacktrace', () => {
    let sendResponseSpy: sinon.SinonSpy;
    let response: DebugProtocol.StackTraceResponse;
    let args: DebugProtocol.StackTraceArguments;
    let readLogFileStub: sinon.SinonStub;
    let getFramesStub: sinon.SinonStub;
    const launchRequestArgs: LaunchRequestArguments = {
      logFile: logFilePath,
      trace: true
    };
    const sampleStackFrames: StackFrame[] = [
      {
        id: 0,
        name: 'firstFrame',
        line: 5,
        column: 0,
        source: new Source(logFileName, logFilePath)
      },
      {
        id: 1,
        name: 'secondFrame',
        line: 10,
        column: 0,
        source: new Source(logFileName, logFilePath)
      }
    ];

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      response = Object.assign(adapter.getDefaultResponse(), {
        body: { stackFrames: [] }
      });
      args = {
        threadId: ApexReplayDebug.THREAD_ID
      };
      sendResponseSpy = sinon.spy(ApexReplayDebug.prototype, 'sendResponse');
      readLogFileStub = sinon
        .stub(LogContextUtil.prototype, 'readLogFile')
        .returns(['line1', 'line2']);
      adapter.setLogFile(launchRequestArgs);
      getFramesStub = sinon
        .stub(LogContext.prototype, 'getFrames')
        .returns(sampleStackFrames);
    });

    afterEach(() => {
      sendResponseSpy.restore();
      readLogFileStub.restore();
      getFramesStub.restore();
    });

    it('Should return stackframes', () => {
      adapter.stackTraceRequest(response, args);

      expect(sendResponseSpy.calledOnce).to.be.true;
      const actualResponse: DebugProtocol.StackTraceResponse = sendResponseSpy.getCall(
        0
      ).args[0];
      expect(actualResponse.success).to.be.true;
      expect(actualResponse.body.stackFrames).to.eql(
        sampleStackFrames.slice().reverse()
      );
    });
  });

  describe('Continue/run', () => {
    let sendResponseSpy: sinon.SinonSpy;
    let sendEventSpy: sinon.SinonSpy;
    let hasLogLinesStub: sinon.SinonStub;
    let updateFramesStub: sinon.SinonStub;
    let shouldStopForBreakpointStub: sinon.SinonStub;
    let response: DebugProtocol.ContinueResponse;
    let args: DebugProtocol.ContinueArguments;
    const launchRequestArgs: LaunchRequestArguments = {
      logFile: logFilePath,
      trace: true
    };

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      adapter.setLogFile(launchRequestArgs);
      response = Object.assign(adapter.getDefaultResponse(), {
        body: {}
      });
      args = {
        threadId: ApexReplayDebug.THREAD_ID
      };
      sendResponseSpy = sinon.spy(ApexReplayDebug.prototype, 'sendResponse');
      sendEventSpy = sinon.spy(ApexReplayDebug.prototype, 'sendEvent');
    });

    afterEach(() => {
      sendResponseSpy.restore();
      sendEventSpy.restore();
      hasLogLinesStub.restore();
      if (updateFramesStub) {
        updateFramesStub.restore();
      }
      if (shouldStopForBreakpointStub) {
        shouldStopForBreakpointStub.restore();
      }
    });

    it('Should terminate session', () => {
      hasLogLinesStub = sinon
        .stub(LogContext.prototype, 'hasLogLines')
        .returns(false);

      adapter.continueRequest(response, args);

      expect(sendResponseSpy.calledOnce).to.be.true;
      const actualResponse: DebugProtocol.StackTraceResponse = sendResponseSpy.getCall(
        0
      ).args[0];
      expect(actualResponse.success).to.be.true;
      expect(sendEventSpy.calledOnce).to.be.true;
      expect(sendEventSpy.getCall(0).args[0]).to.be.instanceof(TerminatedEvent);
    });

    it('Should hit breakpoint', () => {
      hasLogLinesStub = sinon
        .stub(LogContext.prototype, 'hasLogLines')
        .onFirstCall()
        .returns(true)
        .onSecondCall()
        .returns(false);
      updateFramesStub = sinon.stub(LogContext.prototype, 'updateFrames');
      shouldStopForBreakpointStub = sinon
        .stub(MockApexReplayDebug.prototype, 'shouldStopForBreakpoint')
        .returns(true);

      adapter.continueRequest(response, args);

      expect(sendResponseSpy.calledOnce).to.be.true;
      const actualResponse: DebugProtocol.StackTraceResponse = sendResponseSpy.getCall(
        0
      ).args[0];
      expect(actualResponse.success).to.be.true;
      expect(sendEventSpy.called).to.be.false;
    });

    it('Should not hit breakpoint', () => {
      hasLogLinesStub = sinon
        .stub(LogContext.prototype, 'hasLogLines')
        .onFirstCall()
        .returns(true)
        .onSecondCall()
        .returns(false);
      updateFramesStub = sinon.stub(LogContext.prototype, 'updateFrames');
      shouldStopForBreakpointStub = sinon
        .stub(MockApexReplayDebug.prototype, 'shouldStopForBreakpoint')
        .returns(false);

      adapter.continueRequest(response, args);

      expect(sendResponseSpy.calledOnce).to.be.true;
      const actualResponse: DebugProtocol.StackTraceResponse = sendResponseSpy.getCall(
        0
      ).args[0];
      expect(actualResponse.success).to.be.true;
      expect(sendEventSpy.calledOnce).to.be.true;
      const event = sendEventSpy.getCall(0).args[0];
      expect(event).to.be.instanceof(TerminatedEvent);
    });
  });

  describe('Stepping', () => {
    let sendResponseSpy: sinon.SinonSpy;
    let sendEventSpy: sinon.SinonSpy;
    let hasLogLinesStub: sinon.SinonStub;
    let updateFramesStub: sinon.SinonStub;
    let getNumOfFramesStub: sinon.SinonStub;

    beforeEach(() => {
      sendResponseSpy = sinon.spy(ApexReplayDebug.prototype, 'sendResponse');
      sendEventSpy = sinon.spy(ApexReplayDebug.prototype, 'sendEvent');
      updateFramesStub = sinon.stub(LogContext.prototype, 'updateFrames');
      hasLogLinesStub = sinon
        .stub(LogContext.prototype, 'hasLogLines')
        .onFirstCall()
        .returns(true)
        .onSecondCall()
        .returns(false);
    });

    afterEach(() => {
      sendResponseSpy.restore();
      sendEventSpy.restore();
      hasLogLinesStub.restore();
      updateFramesStub.restore();
      getNumOfFramesStub.restore();
    });

    it('Should send step over', () => {
      getNumOfFramesStub = sinon
        .stub(LogContext.prototype, 'getNumOfFrames')
        .onFirstCall()
        .returns(2)
        .onSecondCall()
        .returns(2);

      adapter.nextRequest(
        Object.assign(adapter.getDefaultResponse(), {
          body: {}
        }),
        {
          threadId: ApexReplayDebug.THREAD_ID
        }
      );

      expect(sendResponseSpy.calledOnce).to.be.true;
      const actualResponse: DebugProtocol.StackTraceResponse = sendResponseSpy.getCall(
        0
      ).args[0];
      expect(actualResponse.success).to.be.true;
      expect(sendEventSpy.calledOnce).to.be.true;
      const event = sendEventSpy.getCall(0).args[0];
      expect(event).to.be.instanceof(StoppedEvent);
      expect((event as StoppedEvent).body.reason).to.equal('step');
    });

    it('Should send step in', () => {
      getNumOfFramesStub = sinon
        .stub(LogContext.prototype, 'getNumOfFrames')
        .onFirstCall()
        .returns(2)
        .onSecondCall()
        .returns(3);

      adapter.stepInRequest(
        Object.assign(adapter.getDefaultResponse(), {
          body: {}
        }),
        {
          threadId: ApexReplayDebug.THREAD_ID
        }
      );

      expect(sendResponseSpy.calledOnce).to.be.true;
      const actualResponse: DebugProtocol.StackTraceResponse = sendResponseSpy.getCall(
        0
      ).args[0];
      expect(actualResponse.success).to.be.true;
      expect(sendEventSpy.calledOnce).to.be.true;
      const event = sendEventSpy.getCall(0).args[0];
      expect(event).to.be.instanceof(StoppedEvent);
      expect((event as StoppedEvent).body.reason).to.equal('step');
    });

    it('Should send step out', () => {
      getNumOfFramesStub = sinon
        .stub(LogContext.prototype, 'getNumOfFrames')
        .onFirstCall()
        .returns(2)
        .onSecondCall()
        .returns(1);

      adapter.stepOutRequest(
        Object.assign(adapter.getDefaultResponse(), {
          body: {}
        }),
        {
          threadId: ApexReplayDebug.THREAD_ID
        }
      );

      expect(sendResponseSpy.calledOnce).to.be.true;
      const actualResponse: DebugProtocol.StackTraceResponse = sendResponseSpy.getCall(
        0
      ).args[0];
      expect(actualResponse.success).to.be.true;
      expect(sendEventSpy.calledOnce).to.be.true;
      const event = sendEventSpy.getCall(0).args[0];
      expect(event).to.be.instanceof(StoppedEvent);
      expect((event as StoppedEvent).body.reason).to.equal('step');
    });
  });

  describe('Breakpoints', () => {
    let sendResponseSpy: sinon.SinonSpy;
    let sendEventSpy: sinon.SinonSpy;
    let canSetLineBreakpointStub: sinon.SinonStub;
    let getTopFrameStub: sinon.SinonStub;
    let response: DebugProtocol.SetBreakpointsResponse;
    let args: DebugProtocol.SetBreakpointsArguments;
    const launchRequestArgs: LaunchRequestArguments = {
      logFile: logFilePath,
      trace: true
    };

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      adapter.setLogFile(launchRequestArgs);
      response = Object.assign(adapter.getDefaultResponse(), {
        body: {}
      });
      args = {
        source: {}
      };
      sendResponseSpy = sinon.spy(ApexReplayDebug.prototype, 'sendResponse');
      sendEventSpy = sinon.spy(ApexReplayDebug.prototype, 'sendEvent');
    });

    afterEach(() => {
      sendResponseSpy.restore();
      sendEventSpy.restore();
      if (canSetLineBreakpointStub) {
        canSetLineBreakpointStub.restore();
      }
      if (getTopFrameStub) {
        getTopFrameStub.restore();
      }
    });

    it('Should stop for breakpoint', () => {
      getTopFrameStub = sinon
        .stub(LogContext.prototype, 'getTopFrame')
        .returns({ line: 2, source: { path: '/path/foo.cls' } } as StackFrame);
      adapter.getBreakpoints().set('file:///path/foo.cls', [2]);

      const isStopped = adapter.shouldStopForBreakpoint();

      expect(isStopped).to.be.true;
      expect(sendEventSpy.called).to.be.true;
      const event = sendEventSpy.getCall(0).args[0];
      expect(event).to.be.instanceof(StoppedEvent);
    });

    it('Should not stop for breakpoint', () => {
      getTopFrameStub = sinon
        .stub(LogContext.prototype, 'getTopFrame')
        .returns({ line: 2, source: { path: '/path/foo.cls' } } as StackFrame);
      adapter.getBreakpoints().set('file:///path/bar.cls', [2]);

      const isStopped = adapter.shouldStopForBreakpoint();

      expect(isStopped).to.be.false;
      expect(sendEventSpy.called).to.be.false;
    });

    it('Should not return breakpoints when path argument is invalid', () => {
      args.lines = [1];

      adapter.setBreakPointsRequest(response, args);

      expect(sendResponseSpy.calledOnce).to.be.true;
      const actualResponse: DebugProtocol.SetBreakpointsResponse = sendResponseSpy.getCall(
        0
      ).args[0];
      expect(actualResponse.success).to.be.true;
      expect(actualResponse.body.breakpoints).to.be.empty;
    });

    it('Should not return breakpoints when line argument is invalid', () => {
      args.source.path = 'foo.cls';

      adapter.setBreakPointsRequest(response, args);

      expect(sendResponseSpy.calledOnce).to.be.true;
      const actualResponse: DebugProtocol.SetBreakpointsResponse = sendResponseSpy.getCall(
        0
      ).args[0];
      expect(actualResponse.success).to.be.true;
      expect(actualResponse.body.breakpoints).to.be.empty;
    });

    it('Should return breakpoints', () => {
      const expectedPath = /^win32/.test(process.platform)
        ? 'C:\\space in path\\foo.cls'
        : '/space in path/foo.cls';
      const uriFromLanguageServer = /^win32/.test(process.platform)
        ? 'file:///c:/space%20in%20path/foo.cls'
        : 'file:///space%20in%20path/foo.cls';
      args.source.path = expectedPath;
      args.lines = [1, 2];
      args.breakpoints = [];
      args.breakpoints.push({ line: 1 }, { line: 2 });
      canSetLineBreakpointStub = sinon
        .stub(BreakpointUtil.prototype, 'canSetLineBreakpoint')
        .onFirstCall()
        .returns(true)
        .onSecondCall()
        .returns(false);

      adapter.setBreakPointsRequest(response, args);

      expect(sendResponseSpy.calledOnce).to.be.true;
      const actualResponse: DebugProtocol.SetBreakpointsResponse = sendResponseSpy.getCall(
        0
      ).args[0];
      expect(actualResponse.success).to.be.true;
      expect(actualResponse.body.breakpoints).to.deep.equal([
        {
          verified: true,
          source: { path: expectedPath },
          line: 1
        },
        {
          verified: false,
          source: { path: expectedPath },
          line: 2
        }
      ]);
      expect(canSetLineBreakpointStub.calledTwice).to.be.true;
      expect(canSetLineBreakpointStub.getCall(0).args).to.have.same.members([
        uriFromLanguageServer,
        1
      ]);
      expect(canSetLineBreakpointStub.getCall(1).args).to.have.same.members([
        uriFromLanguageServer,
        2
      ]);
    });
  });

  describe('Custom request', () => {
    describe('Line breakpoint info', () => {
      let sendResponseSpy: sinon.SinonSpy;
      let createMappingsFromLineBreakpointInfo: sinon.SinonSpy;
      const initializedResponse = {
        success: true,
        type: 'response',
        body: {
          supportsCompletionsRequest: false,
          supportsConditionalBreakpoints: false,
          supportsDelayedStackTraceLoading: false,
          supportsEvaluateForHovers: false,
          supportsExceptionInfoRequest: false,
          supportsExceptionOptions: false,
          supportsFunctionBreakpoints: false,
          supportsHitConditionalBreakpoints: false,
          supportsLoadedSourcesRequest: false,
          supportsRestartFrame: false,
          supportsSetVariable: false,
          supportsStepBack: false,
          supportsStepInTargetsRequest: false
        }
      } as DebugProtocol.InitializeResponse;

      beforeEach(() => {
        adapter = new MockApexReplayDebug();
        adapter.initializeRequest(
          initializedResponse,
          {} as DebugProtocol.InitializeRequestArguments
        );
        sendResponseSpy = sinon.spy(ApexReplayDebug.prototype, 'sendResponse');
        createMappingsFromLineBreakpointInfo = sinon.spy(
          BreakpointUtil.prototype,
          'createMappingsFromLineBreakpointInfo'
        );
      });

      afterEach(() => {
        sendResponseSpy.restore();
        createMappingsFromLineBreakpointInfo.restore();
      });

      it('Should handle undefined args', () => {
        adapter.customRequest(
          LINE_BREAKPOINT_INFO_REQUEST,
          {} as DebugProtocol.Response,
          null
        );

        expect(createMappingsFromLineBreakpointInfo.called).to.be.false;
        expect(sendResponseSpy.called).to.be.true;
        const actualResponse: DebugProtocol.InitializeResponse = sendResponseSpy.getCall(
          0
        ).args[0];
        expect(actualResponse.success).to.be.true;
        expect(actualResponse).to.deep.equal(initializedResponse);
      });

      it('Should handle empty line breakpoint info', () => {
        const returnArgs: LineBreakpointEventArgs = {
          lineBreakpointInfo: [],
          projectPath: undefined
        };
        adapter.customRequest(
          LINE_BREAKPOINT_INFO_REQUEST,
          {} as DebugProtocol.Response,
          returnArgs
        );

        expect(createMappingsFromLineBreakpointInfo.called).to.be.true;
        expect(sendResponseSpy.called).to.be.true;
        const actualResponse: DebugProtocol.InitializeResponse = sendResponseSpy.getCall(
          0
        ).args[0];
        expect(actualResponse.success).to.be.true;
        expect(actualResponse).to.deep.equal(initializedResponse);
        expect(adapter.getProjectPath()).to.equal(undefined);
      });

      it('Should save line number mapping', () => {
        const info: LineBreakpointInfo[] = [
          { uri: 'file:///foo.cls', typeref: 'foo', lines: [1, 2, 3] },
          { uri: 'file:///foo.cls', typeref: 'foo$inner', lines: [4, 5, 6] },
          { uri: 'file:///bar.cls', typeref: 'bar', lines: [1, 2, 3] },
          { uri: 'file:///bar.cls', typeref: 'bar$inner', lines: [4, 5, 6] }
        ];
        const expectedLineNumberMapping: Map<string, number[]> = new Map();
        expectedLineNumberMapping.set('file:///foo.cls', [1, 2, 3, 4, 5, 6]);
        expectedLineNumberMapping.set('file:///bar.cls', [1, 2, 3, 4, 5, 6]);
        const projectPathArg = 'some path';

        const returnArgs: LineBreakpointEventArgs = {
          lineBreakpointInfo: info,
          projectPath: projectPathArg
        };
        adapter.customRequest(
          LINE_BREAKPOINT_INFO_REQUEST,
          {} as DebugProtocol.Response,
          returnArgs
        );

        expect(createMappingsFromLineBreakpointInfo.calledOnce).to.be.true;
        expect(
          createMappingsFromLineBreakpointInfo.getCall(0).args[0]
        ).to.deep.equal(info);
        expect(sendResponseSpy.called).to.be.true;
        const actualResponse: DebugProtocol.InitializeResponse = sendResponseSpy.getCall(
          0
        ).args[0];
        expect(actualResponse.success).to.be.true;
        expect(actualResponse).to.deep.equal(initializedResponse);
        // Verify that the line number mapping is the expected line number mapping
        expect(breakpointUtil.getLineNumberMapping()).to.deep.eq(
          expectedLineNumberMapping
        );
        expect(adapter.getProjectPath()).to.equal(projectPathArg);
      });
    });
  });
});
