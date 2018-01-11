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
  Thread,
  ThreadEvent
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import {
  ApexReplayDebug,
  LaunchRequestArguments
} from '../../../src/adapter/apexReplayDebug';
import { BreakpointUtil, LineBreakpointInfo } from '../../../src/breakpoints';
import {
  DEFAULT_INITIALIZE_TIMEOUT_MS,
  LINE_BREAKPOINT_INFO_REQUEST
} from '../../../src/constants';
import { LogContext, LogContextUtil } from '../../../src/core';
import { nls } from '../../../src/messages';

class MockApexReplayDebug extends ApexReplayDebug {
  public setLogFile(args: LaunchRequestArguments) {
    this.logFile = new LogContext(args);
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
    let sendEventSpy: sinon.SinonSpy;
    let response: DebugProtocol.LaunchResponse;
    let args: LaunchRequestArguments;
    let hasLogLinesStub: sinon.SinonStub;
    let readLogFileStub: sinon.SinonStub;
    let updateFramesStub: sinon.SinonStub;
    let printToDebugConsoleStub: sinon.SinonStub;

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      response = adapter.getDefaultResponse();
      args = {
        logFile: logFilePath,
        stopOnEntry: true,
        trace: true
      };
      sendResponseSpy = sinon.spy(ApexReplayDebug.prototype, 'sendResponse');
      sendEventSpy = sinon.spy(ApexReplayDebug.prototype, 'sendEvent');
      readLogFileStub = sinon
        .stub(LogContextUtil.prototype, 'readLogFile')
        .returns(['line1', 'line2']);
      updateFramesStub = sinon.stub(LogContext.prototype, 'updateFrames');
      printToDebugConsoleStub = sinon.stub(
        ApexReplayDebug.prototype,
        'printToDebugConsole'
      );
    });

    afterEach(() => {
      sendResponseSpy.restore();
      sendEventSpy.restore();
      hasLogLinesStub.restore();
      readLogFileStub.restore();
      updateFramesStub.restore();
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
      expect(actualResponse.message).to.be.equal(
        nls.localize('no_log_file_text')
      );
    });

    it('Should stop on first line of log file', () => {
      hasLogLinesStub = sinon
        .stub(LogContext.prototype, 'hasLogLines')
        .returns(true);

      adapter.launchRequest(response, args);

      expect(hasLogLinesStub.calledOnce).to.be.true;
      expect(updateFramesStub.calledOnce).to.be.true;
      expect(sendEventSpy.calledOnce).to.be.true;
      const stoppedEvent: StoppedEvent = sendEventSpy.getCall(0).args[0];
      expect(stoppedEvent.body.reason).to.equal('entry');
      expect(stoppedEvent.body.threadId).to.equal(ApexReplayDebug.THREAD_ID);
      expect(printToDebugConsoleStub.calledOnce).to.be.true;
      const consoleMessage = printToDebugConsoleStub.getCall(0).args[0];
      expect(consoleMessage).to.be.equal(
        nls.localize('session_started_text', logFileName)
      );
      expect(sendResponseSpy.calledOnce).to.be.true;
      const actualResponse: DebugProtocol.LaunchResponse = sendResponseSpy.getCall(
        0
      ).args[0];
      expect(actualResponse.success).to.be.true;
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
      expect(consoleMessage).to.be.equal(
        nls.localize('session_terminated_text')
      );
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
      stopOnEntry: true,
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
      expect(thread.name).to.equal(logFileName);
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
      stopOnEntry: true,
      trace: true
    };
    const sampleStackFrames: StackFrame[] = [
      {
        id: 0,
        name: 'firstFrame',
        line: 5,
        column: 0,
        source: new Source(logFileName, encodeURI(`file://${logFilePath}`))
      },
      {
        id: 1,
        name: 'secondFrame',
        line: 10,
        column: 0,
        source: new Source(logFileName, encodeURI(`file://${logFilePath}`))
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
      expect(actualResponse.body.stackFrames).to.equal(
        sampleStackFrames.reverse()
      );
    });
  });

  describe('Continue/run', () => {
    let sendResponseSpy: sinon.SinonSpy;
    let sendEventSpy: sinon.SinonSpy;
    let response: DebugProtocol.ContinueResponse;
    let args: DebugProtocol.ContinueArguments;

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
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
    });

    it('Should exit thread', () => {
      adapter.continueRequest(response, args);

      expect(sendResponseSpy.calledOnce).to.be.true;
      const actualResponse: DebugProtocol.StackTraceResponse = sendResponseSpy.getCall(
        0
      ).args[0];
      expect(actualResponse.success).to.be.true;
      expect(sendEventSpy.calledOnce).to.be.true;
      const stoppedEvent: ThreadEvent = sendEventSpy.getCall(0).args[0];
      expect(stoppedEvent.body.reason).to.equal('exited');
      expect(stoppedEvent.body.threadId).to.equal(ApexReplayDebug.THREAD_ID);
    });
  });

  describe('Breakpoints', () => {
    let sendResponseSpy: sinon.SinonSpy;
    let canSetLineBreakpointStub: sinon.SinonStub;
    let response: DebugProtocol.SetBreakpointsResponse;
    let args: DebugProtocol.SetBreakpointsArguments;

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      response = Object.assign(adapter.getDefaultResponse(), {
        body: {}
      });
      args = {
        source: {}
      };
      sendResponseSpy = sinon.spy(ApexReplayDebug.prototype, 'sendResponse');
    });

    afterEach(() => {
      sendResponseSpy.restore();
      if (canSetLineBreakpointStub) {
        canSetLineBreakpointStub.restore();
      }
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

  describe('Debug console', () => {
    let sendEventSpy: sinon.SinonSpy;

    describe('Print', () => {
      beforeEach(() => {
        adapter = new MockApexReplayDebug();
        sendEventSpy = sinon.spy(ApexReplayDebug.prototype, 'sendEvent');
      });

      afterEach(() => {
        sendEventSpy.restore();
      });

      it('Should not print if message is undefined', () => {
        adapter.printToDebugConsole(undefined);

        expect(sendEventSpy.notCalled).to.be.true;
      });

      it('Should not print is message is empty', () => {
        adapter.printToDebugConsole('');

        expect(sendEventSpy.notCalled).to.be.true;
      });

      it('Should send Output event', () => {
        const source = new Source(
          logFileName,
          encodeURI(`file://${logFilePath}`)
        );
        adapter.printToDebugConsole('test', source, 5);

        expect(sendEventSpy.calledOnce).to.be.true;
        const outputEvent: DebugProtocol.OutputEvent = sendEventSpy.getCall(0)
          .args[0];
        expect(outputEvent.body.output).to.have.string('test');
        expect(outputEvent.body.category).to.equal('stdout');
        expect(outputEvent.body.line).to.equal(5);
        expect(outputEvent.body.column).to.equal(0);
        expect(outputEvent.body.source).to.equal(source);
      });
    });

    describe('Warn', () => {
      beforeEach(() => {
        adapter = new MockApexReplayDebug();
        sendEventSpy = sinon.spy(ApexReplayDebug.prototype, 'sendEvent');
      });

      afterEach(() => {
        sendEventSpy.restore();
      });

      it('Should not warn if message is undefined', () => {
        adapter.warnToDebugConsole(undefined);

        expect(sendEventSpy.notCalled).to.be.true;
      });

      it('Should not warn is message is empty', () => {
        adapter.warnToDebugConsole('');

        expect(sendEventSpy.notCalled).to.be.true;
      });

      it('Should send Output event', () => {
        adapter.warnToDebugConsole('test');

        expect(sendEventSpy.calledOnce).to.be.true;
        const outputEvent: DebugProtocol.OutputEvent = sendEventSpy.getCall(0)
          .args[0];
        expect(outputEvent.body.output).to.have.string('test');
        expect(outputEvent.body.category).to.equal('console');
      });
    });

    describe('Error', () => {
      beforeEach(() => {
        adapter = new MockApexReplayDebug();
        sendEventSpy = sinon.spy(ApexReplayDebug.prototype, 'sendEvent');
      });

      afterEach(() => {
        sendEventSpy.restore();
      });

      it('Should not error if message is undefined', () => {
        adapter.errorToDebugConsole(undefined);

        expect(sendEventSpy.notCalled).to.be.true;
      });

      it('Should not error is message is empty', () => {
        adapter.errorToDebugConsole('');

        expect(sendEventSpy.notCalled).to.be.true;
      });

      it('Should send Output event', () => {
        adapter.errorToDebugConsole('test');

        expect(sendEventSpy.calledOnce).to.be.true;
        const outputEvent: DebugProtocol.OutputEvent = sendEventSpy.getCall(0)
          .args[0];
        expect(outputEvent.body.output).to.have.string('test');
        expect(outputEvent.body.category).to.equal('stderr');
      });
    });
  });
});
