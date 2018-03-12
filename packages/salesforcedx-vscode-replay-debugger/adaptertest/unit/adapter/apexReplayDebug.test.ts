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
import { BreakpointUtil, LineBreakpointInfo } from '../../../src/breakpoints';
import { CheckpointMessage } from '../../../src/breakpoints/checkpointService';
import {
  CHECKPOINT_INFO_EVENT,
  DEFAULT_INITIALIZE_TIMEOUT_MS,
  LINE_BREAKPOINT_INFO_REQUEST
} from '../../../src/constants';
import { LogContext, LogContextUtil } from '../../../src/core';
import { nls } from '../../../src/messages';

export class MockApexReplayDebug extends ApexReplayDebug {
  public setLogFile(args: LaunchRequestArguments) {
    this.logContext = new LogContext(args, this);
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
}

// tslint:disable:no-unused-expression
describe('Replay debugger adapter - unit', () => {
  let adapter: MockApexReplayDebug;
  const logFileName = 'foo.log';
  const logFilePath = `path/${logFileName}`;

  describe('Initialize', () => {
    let sendResponseSpy: sinon.SinonSpy;
    let hasLineNumberMappingStub: sinon.SinonStub;
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
      hasLineNumberMappingStub.restore();
      clock.restore();
    });

    it('Should send successful initialized response', () => {
      hasLineNumberMappingStub = sinon
        .stub(BreakpointUtil.prototype, 'hasLineNumberMapping')
        .returns(true);

      adapter.initializeRequest(response, args);

      setTimeout(() => {
        expect(hasLineNumberMappingStub.calledOnce).to.be.true;
        expect(sendResponseSpy.calledOnce).to.be.false;
      }, DEFAULT_INITIALIZE_TIMEOUT_MS);
      clock.tick(DEFAULT_INITIALIZE_TIMEOUT_MS + 1);
    });

    it('Should send language server error message', () => {
      hasLineNumberMappingStub = sinon
        .stub(BreakpointUtil.prototype, 'hasLineNumberMapping')
        .returns(false);

      adapter.initializeRequest(response, args);

      setTimeout(() => {
        expect(hasLineNumberMappingStub.calledOnce).to.be.true;
        expect(sendResponseSpy.calledOnce).to.be.true;
        const actualResponse = sendResponseSpy.getCall(0).args[0];
        expect(actualResponse.success).to.be.false;
        expect(actualResponse.message).to.have.string(
          nls.localize('session_language_server_error_text')
        );
      }, DEFAULT_INITIALIZE_TIMEOUT_MS);
      clock.tick(DEFAULT_INITIALIZE_TIMEOUT_MS + 1);
    });
  });

  describe('Launch', () => {
    let sendResponseSpy: sinon.SinonSpy;
    let response: DebugProtocol.LaunchResponse;
    let args: LaunchRequestArguments;
    let hasLogLinesStub: sinon.SinonStub;
    let readLogFileStub: sinon.SinonStub;
    let printToDebugConsoleStub: sinon.SinonStub;

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      response = adapter.getDefaultResponse();
      args = {
        logFile: logFilePath,
        stopOnEntry: true,
        trace: false
      };
      sendResponseSpy = sinon.spy(ApexReplayDebug.prototype, 'sendResponse');
      readLogFileStub = sinon
        .stub(LogContextUtil.prototype, 'readLogFile')
        .returns(['line1', 'line2']);
      printToDebugConsoleStub = sinon.stub(
        ApexReplayDebug.prototype,
        'printToDebugConsole'
      );
    });

    afterEach(() => {
      sendResponseSpy.restore();
      hasLogLinesStub.restore();
      readLogFileStub.restore();
      printToDebugConsoleStub.restore();
    });

    it('Should return error when there are no log lines', () => {
      hasLogLinesStub = sinon
        .stub(LogContext.prototype, 'hasLogLines')
        .returns(false);

      adapter.launchRequest(response, args);

      expect(hasLogLinesStub.calledOnce).to.be.true;
      expect(sendResponseSpy.calledOnce).to.be.true;
      const actualResponse: DebugProtocol.LaunchResponse = sendResponseSpy.getCall(
        0
      ).args[0];
      expect(actualResponse.success).to.be.false;
      expect(actualResponse.message).to.equal(nls.localize('no_log_file_text'));
    });

    it('Should send response', () => {
      hasLogLinesStub = sinon
        .stub(LogContext.prototype, 'hasLogLines')
        .returns(true);

      adapter.launchRequest(response, args);

      expect(hasLogLinesStub.calledOnce).to.be.true;
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
      args.source.path = 'foo.cls';
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
          source: { path: 'foo.cls' },
          line: 1
        },
        {
          verified: false,
          source: { path: 'foo.cls' },
          line: 2
        }
      ]);
    });
    it('Should schedule checkpoint when condition is set to checkpoint', () => {
      // Create the breakpoint information for the typeRef lookup
      const lineNumberMapping: Map<string, number[]> = new Map();
      lineNumberMapping.set('file:///bar.cls', [3, 4]);
      const typerefMapping: Map<string, string> = new Map();
      typerefMapping.set('bar', 'file:///bar.cls');

      // path should, in theory, be the entire path to the file whereas name should just be the filename
      args.source.path = 'bar.cls';
      args.source.name = 'bar.cls';
      args.lines = [3];
      args.breakpoints = [];
      args.breakpoints.push({ line: 3, condition: 'checkpoint' });
      canSetLineBreakpointStub = sinon
        .stub(BreakpointUtil.prototype, 'canSetLineBreakpoint')
        .onFirstCall()
        .returns(true)
        .onSecondCall()
        .returns(false);

      // Add the lineNumberMapping and the typerefMapping to the apexReplayDebug for
      // the typeref lookup that is part of the eventBody for the CheckpointMessage
      adapter
        .getBreakpointUtil()
        .setValidLines(lineNumberMapping, typerefMapping);
      adapter.setBreakPointsRequest(response, args);

      expect(sendResponseSpy.calledOnce).to.be.true;
      const actualResponse: DebugProtocol.SetBreakpointsResponse = sendResponseSpy.getCall(
        0
      ).args[0];

      // Verify the successful response
      expect(actualResponse.success).to.be.true;

      // Ensure that the event was fired
      expect(sendEventSpy.called).to.be.true;

      // Retrieve the event, ensure that it was a CHECKPOINT_INFO_EVENT
      const event = sendEventSpy.getCall(0).args[0];
      expect(event.event).to.be.equal(CHECKPOINT_INFO_EVENT);
      const eventBody = event.body as CheckpointMessage;
      expect(eventBody.line).to.be.equal(3);
      expect(eventBody.sourceFile).to.be.equal('bar.cls');
      expect(eventBody.typeRef).to.be.equal('bar');
    });
  });

  describe('Custom request', () => {
    describe('Line breakpoint info', () => {
      let sendResponseSpy: sinon.SinonSpy;
      let sendEventSpy: sinon.SinonSpy;
      let setValidLines: sinon.SinonSpy;
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
        sendEventSpy = sinon.spy(ApexReplayDebug.prototype, 'sendEvent');
        setValidLines = sinon.spy(BreakpointUtil.prototype, 'setValidLines');
      });

      afterEach(() => {
        sendResponseSpy.restore();
        sendEventSpy.restore();
        setValidLines.restore();
      });

      it('Should handle undefined args', () => {
        adapter.customRequest(
          LINE_BREAKPOINT_INFO_REQUEST,
          {} as DebugProtocol.Response,
          null
        );

        expect(setValidLines.called).to.be.false;
        expect(sendResponseSpy.called).to.be.true;
        const actualResponse: DebugProtocol.InitializeResponse = sendResponseSpy.getCall(
          0
        ).args[0];
        expect(actualResponse.success).to.be.true;
        expect(actualResponse).to.deep.equal(initializedResponse);
        expect(sendEventSpy.calledOnce).to.be.true;
        expect(sendEventSpy.getCall(0).args[0]).to.be.instanceof(
          InitializedEvent
        );
      });

      it('Should handle empty line breakpoint info', () => {
        adapter.customRequest(
          LINE_BREAKPOINT_INFO_REQUEST,
          {} as DebugProtocol.Response,
          []
        );

        expect(setValidLines.called).to.be.false;
        expect(sendResponseSpy.called).to.be.true;
        const actualResponse: DebugProtocol.InitializeResponse = sendResponseSpy.getCall(
          0
        ).args[0];
        expect(actualResponse.success).to.be.true;
        expect(actualResponse).to.deep.equal(initializedResponse);
        expect(sendEventSpy.calledOnce).to.be.true;
        expect(sendEventSpy.getCall(0).args[0]).to.be.instanceof(
          InitializedEvent
        );
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

        adapter.customRequest(
          LINE_BREAKPOINT_INFO_REQUEST,
          {} as DebugProtocol.Response,
          info
        );

        expect(setValidLines.calledOnce).to.be.true;
        expect(setValidLines.getCall(0).args[0]).to.deep.equal(
          expectedLineNumberMapping
        );
        expect(sendResponseSpy.called).to.be.true;
        const actualResponse: DebugProtocol.InitializeResponse = sendResponseSpy.getCall(
          0
        ).args[0];
        expect(actualResponse.success).to.be.true;
        expect(actualResponse).to.deep.equal(initializedResponse);
        expect(sendEventSpy.calledOnce).to.be.true;
        expect(sendEventSpy.getCall(0).args[0]).to.be.instanceof(
          InitializedEvent
        );
      });
    });
  });
});
