/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import {
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
import { LogFile, LogFileUtil } from '../../../src/core';
import { nls } from '../../../src/messages';

class MockApexReplayDebug extends ApexReplayDebug {
  public setLogFile(args: LaunchRequestArguments) {
    this.logFile = new LogFile(args);
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
    let response: DebugProtocol.InitializeResponse;
    let args: DebugProtocol.InitializeRequestArguments;

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      response = adapter.getDefaultResponse();
      args = {
        adapterID: ''
      };
      sendResponseSpy = sinon.spy(ApexReplayDebug.prototype, 'sendResponse');
    });

    afterEach(() => {
      sendResponseSpy.restore();
    });

    it('Should set supported features', () => {
      adapter.initializeRequest(response, args);

      expect(sendResponseSpy.calledOnce).to.be.true;
      const actualResponse = sendResponseSpy.getCall(0).args[0];
      expect(actualResponse.success).to.be.true;
      expect(actualResponse.body).to.deep.equal({
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
      });
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
        traceLog: true
      };
      sendResponseSpy = sinon.spy(ApexReplayDebug.prototype, 'sendResponse');
      sendEventSpy = sinon.spy(ApexReplayDebug.prototype, 'sendEvent');
      readLogFileStub = sinon
        .stub(LogFileUtil.prototype, 'readLogFile')
        .returns(['line1', 'line2']);
      updateFramesStub = sinon.stub(LogFile.prototype, 'updateFrames');
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
        .stub(LogFile.prototype, 'hasLogLines')
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
        .stub(LogFile.prototype, 'hasLogLines')
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
      traceLog: true
    };

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      response = Object.assign(adapter.getDefaultResponse(), {
        body: { threads: [] }
      });
      sendResponseSpy = sinon.spy(ApexReplayDebug.prototype, 'sendResponse');
      readLogFileStub = sinon
        .stub(LogFileUtil.prototype, 'readLogFile')
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
      traceLog: true
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
        .stub(LogFileUtil.prototype, 'readLogFile')
        .returns(['line1', 'line2']);
      adapter.setLogFile(launchRequestArgs);
      getFramesStub = sinon
        .stub(LogFile.prototype, 'getFrames')
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
