/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { LineBreakpointInfo } from '@salesforce/salesforcedx-utils';
// Mock DebugSession.run to prevent it from executing during tests
jest.mock('@vscode/debugadapter', () => ({
  ...jest.requireActual('@vscode/debugadapter'),
  DebugSession: {
    ...jest.requireActual('@vscode/debugadapter').DebugSession,
    run: jest.fn()
  }
}));

import {
  Event,
  InitializedEvent,
  Source,
  StackFrame,
  StoppedEvent,
  TerminatedEvent,
  Thread
} from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import * as sinon from 'sinon';
import { ApexReplayDebug } from '../../../src/adapter/apexReplayDebug';
import { LaunchRequestArguments } from '../../../src/adapter/types';
import { BreakpointUtil, breakpointUtil } from '../../../src/breakpoints';
import { SEND_METRIC_ERROR_EVENT, SEND_METRIC_LAUNCH_EVENT } from '../../../src/constants';
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

describe('Replay debugger adapter - unit', () => {
  let adapter: MockApexReplayDebug;
  const logFileName = 'foo.log';
  const logFilePath = `path/${logFileName}`;
  const projectPath = 'path/project';

  describe('Launch', () => {
    let sendResponseSpy: sinon.SinonSpy;
    let sendEventSpy: sinon.SinonSpy;
    let response: DebugProtocol.LaunchResponse;
    let args: LaunchRequestArguments;
    let hasLogLinesStub: sinon.SinonStub;
    let meetsLogLevelRequirementsStub: sinon.SinonStub;
    let readLogFileStub: sinon.SinonStub;
    let getLogSizeStub: sinon.SinonStub;
    let printToDebugConsoleStub: sinon.SinonStub;
    let errorToDebugConsoleStub: sinon.SinonStub;
    let scanLogForHeapDumpLinesStub: sinon.SinonStub;
    let fetchOverlayResultsForApexHeapDumpsStub: sinon.SinonStub;
    const lineBpInfo: LineBreakpointInfo[] = [];
    lineBpInfo.push({
      uri: 'classA',
      typeref: 'StaticVarsA',
      lines: [9, 10, 13]
    });

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      response = adapter.getDefaultResponse();
      args = {
        logFile: logFilePath,
        stopOnEntry: true,
        trace: false,
        projectPath
      };
      sendResponseSpy = sinon.spy(ApexReplayDebug.prototype, 'sendResponse');
      sendEventSpy = sinon.spy(ApexReplayDebug.prototype, 'sendEvent');
      readLogFileStub = sinon.stub(LogContextUtil.prototype, 'readLogFile').returns(['line1', 'line2']);
      getLogSizeStub = sinon.stub(LogContext.prototype, 'getLogSize').returns(123);
      printToDebugConsoleStub = sinon.stub(ApexReplayDebug.prototype, 'printToDebugConsole');
      errorToDebugConsoleStub = sinon.stub(ApexReplayDebug.prototype, 'errorToDebugConsole');
    });

    afterEach(() => {
      sendResponseSpy.restore();
      sendEventSpy.restore();
      hasLogLinesStub.restore();
      meetsLogLevelRequirementsStub.restore();
      readLogFileStub.restore();
      getLogSizeStub.restore();
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
      hasLogLinesStub = sinon.stub(LogContext.prototype, 'hasLogLines').returns(false);
      meetsLogLevelRequirementsStub = sinon.stub(LogContext.prototype, 'meetsLogLevelRequirements').returns(false);

      await adapter.launchRequest(response, args);

      expect(hasLogLinesStub.calledOnce).toBe(true);
      expect(meetsLogLevelRequirementsStub.calledOnce).toBe(false);
      expect(sendResponseSpy.calledOnce).toBe(true);
      expect(sendEventSpy.callCount).toBe(4);
      const actualResponse: DebugProtocol.LaunchResponse = sendResponseSpy.getCall(0).args[0];
      expect(actualResponse.success).toBe(false);
      expect(actualResponse.message).toBe(nls.localize('no_log_file_text'));
      expect(sendEventSpy.getCall(1).args[0]).toBeInstanceOf(Event);
      expect(sendEventSpy.getCall(1).args[0].body.subject).toBe('No log lines found');
      expect(sendEventSpy.getCall(2).args[0]).toBeInstanceOf(InitializedEvent);
      const eventObj = sendEventSpy.getCall(3).args[0] as DebugProtocol.Event;
      expect(eventObj.event).toBe(SEND_METRIC_LAUNCH_EVENT);
      expect(eventObj.body).toEqual({
        logSize: 123,
        error: { subject: nls.localize('no_log_file_text') }
      });
    });

    it('Should return error when log levels are incorrect', async () => {
      hasLogLinesStub = sinon.stub(LogContext.prototype, 'hasLogLines').returns(true);
      meetsLogLevelRequirementsStub = sinon.stub(LogContext.prototype, 'meetsLogLevelRequirements').returns(false);

      await adapter.launchRequest(response, args);

      expect(hasLogLinesStub.calledOnce).toBe(true);
      expect(meetsLogLevelRequirementsStub.calledOnce).toBe(true);
      expect(sendResponseSpy.calledOnce).toBe(true);
      expect(sendEventSpy.callCount).toBe(4);
      const actualResponse: DebugProtocol.LaunchResponse = sendResponseSpy.getCall(0).args[0];
      expect(actualResponse.success).toBe(false);
      expect(actualResponse.message).toBe(nls.localize('incorrect_log_levels_text'));
      expect(sendEventSpy.getCall(1).args[0]).toBeInstanceOf(Event);
      expect(sendEventSpy.getCall(1).args[0].body.subject).toBe('Incorrect log levels');
      expect(sendEventSpy.getCall(2).args[0]).toBeInstanceOf(InitializedEvent);
      const eventObj = sendEventSpy.getCall(3).args[0] as DebugProtocol.Event;
      expect(eventObj.event).toBe(SEND_METRIC_LAUNCH_EVENT);
      expect(eventObj.body).toEqual({
        logSize: 123,
        error: { subject: nls.localize('incorrect_log_levels_text') }
      });
    });

    it('Should send response', async () => {
      hasLogLinesStub = sinon.stub(LogContext.prototype, 'hasLogLines').returns(true);
      meetsLogLevelRequirementsStub = sinon.stub(LogContext.prototype, 'meetsLogLevelRequirements').returns(true);

      args.lineBreakpointInfo = lineBpInfo;
      await adapter.launchRequest(response, args);

      expect(hasLogLinesStub.calledOnce).toBe(true);
      expect(meetsLogLevelRequirementsStub.calledOnce).toBe(true);
      expect(printToDebugConsoleStub.calledOnce).toBe(true);
      const consoleMessage = printToDebugConsoleStub.getCall(0).args[0];
      expect(consoleMessage).toBe(nls.localize('session_started_text', logFileName));
      expect(sendResponseSpy.calledOnce).toBe(true);
      const actualResponse: DebugProtocol.LaunchResponse = sendResponseSpy.getCall(0).args[0];
      expect(actualResponse.success).toBe(true);
    });

    it('Should not scan for log lines if projectPath is undefined', async () => {
      hasLogLinesStub = sinon.stub(LogContext.prototype, 'hasLogLines').returns(true);
      meetsLogLevelRequirementsStub = sinon.stub(LogContext.prototype, 'meetsLogLevelRequirements').returns(true);
      scanLogForHeapDumpLinesStub = sinon.stub(LogContext.prototype, 'scanLogForHeapDumpLines').returns(false);

      adapter.setProjectPath(undefined);
      await adapter.launchRequest(response, args);

      expect(hasLogLinesStub.calledOnce).toBe(true);
      expect(meetsLogLevelRequirementsStub.calledOnce).toBe(true);
      expect(scanLogForHeapDumpLinesStub.called).toBe(false);
    });

    it('Should scan log lines for heap dumps if projectPath is set', async () => {
      hasLogLinesStub = sinon.stub(LogContext.prototype, 'hasLogLines').returns(true);
      meetsLogLevelRequirementsStub = sinon.stub(LogContext.prototype, 'meetsLogLevelRequirements').returns(true);
      scanLogForHeapDumpLinesStub = sinon.stub(LogContext.prototype, 'scanLogForHeapDumpLines').returns(false);
      fetchOverlayResultsForApexHeapDumpsStub = sinon
        .stub(LogContext.prototype, 'fetchOverlayResultsForApexHeapDumps')
        .returns(true);

      args.lineBreakpointInfo = lineBpInfo;
      await adapter.launchRequest(response, args);

      expect(hasLogLinesStub.calledOnce).toBe(true);
      expect(meetsLogLevelRequirementsStub.calledOnce).toBe(true);
      expect(scanLogForHeapDumpLinesStub.calledOnce).toBe(true);
      // fetchOverlayResultsForApexHeapDumps should not be called if scanLogForHeapDumpLines returns false
      expect(fetchOverlayResultsForApexHeapDumpsStub.calledOnce).toBe(false);
    });

    it('Should call to fetch overlay results if heap dumps are found in the logs', async () => {
      hasLogLinesStub = sinon.stub(LogContext.prototype, 'hasLogLines').returns(true);
      meetsLogLevelRequirementsStub = sinon.stub(LogContext.prototype, 'meetsLogLevelRequirements').returns(true);
      scanLogForHeapDumpLinesStub = sinon.stub(LogContext.prototype, 'scanLogForHeapDumpLines').returns(true);
      fetchOverlayResultsForApexHeapDumpsStub = sinon
        .stub(LogContext.prototype, 'fetchOverlayResultsForApexHeapDumps')
        .returns(true);

      args.lineBreakpointInfo = lineBpInfo;
      await adapter.launchRequest(response, args);

      expect(hasLogLinesStub.calledOnce).toBe(true);
      expect(meetsLogLevelRequirementsStub.calledOnce).toBe(true);
      expect(scanLogForHeapDumpLinesStub.calledOnce).toBe(true);
      expect(fetchOverlayResultsForApexHeapDumpsStub.calledOnce).toBe(true);
    });

    it('Should report a wrap up error if fetching heap dumps has a failure', async () => {
      hasLogLinesStub = sinon.stub(LogContext.prototype, 'hasLogLines').returns(true);
      meetsLogLevelRequirementsStub = sinon.stub(LogContext.prototype, 'meetsLogLevelRequirements').returns(true);
      scanLogForHeapDumpLinesStub = sinon.stub(LogContext.prototype, 'scanLogForHeapDumpLines').returns(true);
      fetchOverlayResultsForApexHeapDumpsStub = sinon
        .stub(LogContext.prototype, 'fetchOverlayResultsForApexHeapDumps')
        .returns(false);

      args.lineBreakpointInfo = lineBpInfo;
      await adapter.launchRequest(response, args);

      expect(hasLogLinesStub.calledOnce).toBe(true);
      expect(meetsLogLevelRequirementsStub.calledOnce).toBe(true);
      expect(scanLogForHeapDumpLinesStub.calledOnce).toBe(true);
      expect(fetchOverlayResultsForApexHeapDumpsStub.calledOnce).toBe(true);
      expect(errorToDebugConsoleStub.calledOnce).toBe(true);
      expect(sendEventSpy.callCount).toBe(4);
      const errorMessage = errorToDebugConsoleStub.getCall(0).args[0];
      expect(errorMessage).toBe(nls.localize('heap_dump_error_wrap_up_text'));
      expect(sendEventSpy.getCall(1).args[0]).toBeInstanceOf(Event);
      expect(sendEventSpy.getCall(1).args[0].body.subject).toBe('Fetching heap dumps failed');
      expect(sendEventSpy.getCall(2).args[0]).toBeInstanceOf(InitializedEvent);
      const eventObj = sendEventSpy.getCall(3).args[0] as DebugProtocol.Event;
      expect(eventObj.event).toBe(SEND_METRIC_LAUNCH_EVENT);
      expect(eventObj.body).toEqual({
        logSize: 123,
        error: { subject: nls.localize('heap_dump_error_wrap_up_text') }
      });
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
      trace: true,
      projectPath
    };

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      adapter.setLogFile(launchRequestArgs);
      sendEventSpy = sinon.spy(ApexReplayDebug.prototype, 'sendEvent');
      updateFramesStub = sinon.stub(LogContext.prototype, 'updateFrames');
      continueRequestStub = sinon.stub(ApexReplayDebug.prototype, 'continueRequest');
      response = adapter.getDefaultResponse();
    });

    afterEach(() => {
      sendEventSpy.restore();
      updateFramesStub.restore();
      continueRequestStub.restore();
      getLaunchArgsStub.restore();
    });

    it('Should send stopped event', () => {
      getLaunchArgsStub = sinon.stub(LogContext.prototype, 'getLaunchArgs').returns({
        stopOnEntry: true
      } as LaunchRequestArguments);

      adapter.configurationDoneRequest(response, args);

      expect(updateFramesStub.called).toBe(true);
      expect(sendEventSpy.calledTwice).toBe(true);
      const event = sendEventSpy.getCall(0).args[0];
      expect(event).toBeInstanceOf(StoppedEvent);
      expect(sendEventSpy.getCall(1).args[0]).toBeInstanceOf(Event);
      expect(sendEventSpy.getCall(1).args[0].body.subject).toBe('configurationDoneRequest');
    });

    it('Should continue until next breakpoint', () => {
      getLaunchArgsStub = sinon.stub(LogContext.prototype, 'getLaunchArgs').returns({
        stopOnEntry: false
      } as LaunchRequestArguments);

      adapter.configurationDoneRequest(response, args);

      expect(updateFramesStub.called).toBe(false);
      expect(sendEventSpy.calledOnce).toBe(true);
      expect(updateFramesStub.called).toBe(false);
      expect(continueRequestStub.calledOnce).toBe(true);
      expect(sendEventSpy.getCall(0).args[0]).toBeInstanceOf(Event);
      expect(sendEventSpy.getCall(0).args[0].body.subject).toBe('configurationDoneRequest');
    });
  });

  describe('Disconnect', () => {
    let sendEventSpy: sinon.SinonSpy;
    let sendResponseSpy: sinon.SinonSpy;
    let response: DebugProtocol.DisconnectResponse;
    let args: DebugProtocol.DisconnectArguments;
    let printToDebugConsoleStub: sinon.SinonStub;

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      response = adapter.getDefaultResponse();
      args = {};
      sendEventSpy = sinon.spy(ApexReplayDebug.prototype, 'sendEvent');
      sendResponseSpy = sinon.spy(ApexReplayDebug.prototype, 'sendResponse');
      printToDebugConsoleStub = sinon.stub(ApexReplayDebug.prototype, 'printToDebugConsole');
    });

    afterEach(() => {
      sendEventSpy.restore();
      sendResponseSpy.restore();
      printToDebugConsoleStub.restore();
    });

    it('Should disconnect', () => {
      adapter.disconnectRequest(response, args);

      expect(printToDebugConsoleStub.calledOnce).toBe(true);
      const consoleMessage = printToDebugConsoleStub.getCall(0).args[0];
      expect(consoleMessage).toBe(nls.localize('session_terminated_text'));
      expect(sendResponseSpy.calledOnce).toBe(true);
      const actualResponse: DebugProtocol.DisconnectResponse = sendResponseSpy.getCall(0).args[0];
      expect(actualResponse.success).toBe(true);
      expect(sendEventSpy.getCall(0).args[0]).toBeInstanceOf(Event);
      expect(sendEventSpy.getCall(0).args[0].body.subject).toBe('disconnectRequest');
    });
  });

  describe('Threads', () => {
    let sendResponseSpy: sinon.SinonSpy;
    let response: DebugProtocol.ThreadsResponse;
    let readLogFileStub: sinon.SinonStub;
    const launchRequestArgs: LaunchRequestArguments = {
      logFile: logFilePath,
      trace: true,
      projectPath
    };

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      response = Object.assign(adapter.getDefaultResponse(), {
        body: { threads: [] }
      });
      sendResponseSpy = sinon.spy(ApexReplayDebug.prototype, 'sendResponse');
      readLogFileStub = sinon.stub(LogContextUtil.prototype, 'readLogFile').returns(['line1', 'line2']);
      adapter.setLogFile(launchRequestArgs);
    });

    afterEach(() => {
      sendResponseSpy.restore();
      readLogFileStub.restore();
    });

    it('Should always return one thread', () => {
      adapter.threadsRequest(response);

      expect(sendResponseSpy.calledOnce).toBe(true);
      const actualResponse: DebugProtocol.ThreadsResponse = sendResponseSpy.getCall(0).args[0];
      expect(actualResponse.success).toBe(true);
      expect(actualResponse.body.threads.length).toBe(1);
      const thread: Thread = actualResponse.body.threads[0];
      expect(thread.id).toBe(ApexReplayDebug.THREAD_ID);
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
      trace: true,
      projectPath
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
      readLogFileStub = sinon.stub(LogContextUtil.prototype, 'readLogFile').returns(['line1', 'line2']);
      adapter.setLogFile(launchRequestArgs);
      getFramesStub = sinon.stub(LogContext.prototype, 'getFrames').returns(sampleStackFrames);
    });

    afterEach(() => {
      sendResponseSpy.restore();
      readLogFileStub.restore();
      getFramesStub.restore();
    });

    it('Should return stackframes', () => {
      adapter.stackTraceRequest(response, args);

      expect(sendResponseSpy.calledOnce).toBe(true);
      const actualResponse: DebugProtocol.StackTraceResponse = sendResponseSpy.getCall(0).args[0];
      expect(actualResponse.success).toBe(true);
      expect(actualResponse.body.stackFrames).toEqual(sampleStackFrames.slice().reverse());
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
      trace: true,
      projectPath
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
      hasLogLinesStub = sinon.stub(LogContext.prototype, 'hasLogLines').returns(false);

      adapter.continueRequest(response, args);

      expect(sendResponseSpy.calledOnce).toBe(true);
      const actualResponse: DebugProtocol.StackTraceResponse = sendResponseSpy.getCall(0).args[0];
      expect(actualResponse.success).toBe(true);
      expect(sendEventSpy.calledOnce).toBe(true);
      expect(sendEventSpy.getCall(0).args[0]).toBeInstanceOf(TerminatedEvent);
    });

    it('Should hit breakpoint', () => {
      hasLogLinesStub = sinon
        .stub(LogContext.prototype, 'hasLogLines')
        .onFirstCall()
        .returns(true)
        .onSecondCall()
        .returns(false);
      updateFramesStub = sinon.stub(LogContext.prototype, 'updateFrames');
      shouldStopForBreakpointStub = sinon.stub(MockApexReplayDebug.prototype, 'shouldStopForBreakpoint').returns(true);

      adapter.continueRequest(response, args);

      expect(sendResponseSpy.calledOnce).toBe(true);
      const actualResponse: DebugProtocol.StackTraceResponse = sendResponseSpy.getCall(0).args[0];
      expect(actualResponse.success).toBe(true);
      expect(sendEventSpy.called).toBe(false);
    });

    it('Should not hit breakpoint', () => {
      hasLogLinesStub = sinon
        .stub(LogContext.prototype, 'hasLogLines')
        .onFirstCall()
        .returns(true)
        .onSecondCall()
        .returns(false);
      updateFramesStub = sinon.stub(LogContext.prototype, 'updateFrames');
      shouldStopForBreakpointStub = sinon.stub(MockApexReplayDebug.prototype, 'shouldStopForBreakpoint').returns(false);

      adapter.continueRequest(response, args);

      expect(sendResponseSpy.calledOnce).toBe(true);
      const actualResponse: DebugProtocol.StackTraceResponse = sendResponseSpy.getCall(0).args[0];
      expect(actualResponse.success).toBe(true);
      expect(sendEventSpy.calledOnce).toBe(true);
      const event = sendEventSpy.getCall(0).args[0];
      expect(event).toBeInstanceOf(TerminatedEvent);
    });

    it('Should handle errors during step execution', () => {
      hasLogLinesStub = sinon.stub(LogContext.prototype, 'hasLogLines').onFirstCall().returns(true);

      // Cause `updateFrames` to throw an error to trigger the catch block
      const error = new Error('Test error during step execution');
      updateFramesStub = sinon.stub(LogContext.prototype, 'updateFrames').throws(error);

      shouldStopForBreakpointStub = sinon.stub(MockApexReplayDebug.prototype, 'shouldStopForBreakpoint').returns(false);

      try {
        adapter.continueRequest(response, args);
      } catch (err) {
        // Assert that the error thrown is the one we caused
        expect(err).toBe(error);
      }

      // Check that the error event was sent
      expect(sendEventSpy.calledOnce).toBe(true);
      const event = sendEventSpy.getCall(0).args[0];
      expect(event).toBeInstanceOf(Event);
      expect(event.event).toBe(SEND_METRIC_ERROR_EVENT);
      expect(event.body.subject).toBe('Error during step execution');
      expect(event.body.message).toBe(error.message);
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

      expect(sendResponseSpy.calledOnce).toBe(true);
      const actualResponse: DebugProtocol.StackTraceResponse = sendResponseSpy.getCall(0).args[0];
      expect(actualResponse.success).toBe(true);
      expect(sendEventSpy.calledOnce).toBe(true);
      const event = sendEventSpy.getCall(0).args[0];
      expect(event).toBeInstanceOf(StoppedEvent);
      expect((event as StoppedEvent).body.reason).toBe('step');
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

      expect(sendResponseSpy.calledOnce).toBe(true);
      const actualResponse: DebugProtocol.StackTraceResponse = sendResponseSpy.getCall(0).args[0];
      expect(actualResponse.success).toBe(true);
      expect(sendEventSpy.calledOnce).toBe(true);
      const event = sendEventSpy.getCall(0).args[0];
      expect(event).toBeInstanceOf(StoppedEvent);
      expect((event as StoppedEvent).body.reason).toBe('step');
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

      expect(sendResponseSpy.calledOnce).toBe(true);
      const actualResponse: DebugProtocol.StackTraceResponse = sendResponseSpy.getCall(0).args[0];
      expect(actualResponse.success).toBe(true);
      expect(sendEventSpy.calledOnce).toBe(true);
      const event = sendEventSpy.getCall(0).args[0];
      expect(event).toBeInstanceOf(StoppedEvent);
      expect((event as StoppedEvent).body.reason).toBe('step');
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
      trace: true,
      projectPath
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

      expect(isStopped).toBe(true);
      expect(sendEventSpy.called).toBe(true);
      const event = sendEventSpy.getCall(0).args[0];
      expect(event).toBeInstanceOf(StoppedEvent);
    });

    it('Should not stop for breakpoint', () => {
      getTopFrameStub = sinon
        .stub(LogContext.prototype, 'getTopFrame')
        .returns({ line: 2, source: { path: '/path/foo.cls' } } as StackFrame);
      adapter.getBreakpoints().set('file:///path/bar.cls', [2]);

      const isStopped = adapter.shouldStopForBreakpoint();

      expect(isStopped).toBe(false);
      expect(sendEventSpy.called).toBe(false);
    });

    it('Should not return breakpoints when path argument is invalid', () => {
      args.lines = [1];

      adapter.setBreakPointsRequest(response, args);

      expect(sendResponseSpy.calledOnce).toBe(true);
      const actualResponse: DebugProtocol.SetBreakpointsResponse = sendResponseSpy.getCall(0).args[0];
      expect(actualResponse.success).toBe(true);
      expect(actualResponse.body.breakpoints).toHaveLength(0);
      expect(sendEventSpy.calledOnce).toBe(true);
      expect(sendEventSpy.getCall(0).args[0]).toBeInstanceOf(Event);
      expect(sendEventSpy.getCall(0).args[0].body.subject).toBe('setBreakPointsRequest - path or breakpoints invalid');
    });

    it('Should not return breakpoints when line argument is invalid', () => {
      args.source.path = 'foo.cls';

      adapter.setBreakPointsRequest(response, args);

      expect(sendResponseSpy.calledOnce).toBe(true);
      const actualResponse: DebugProtocol.SetBreakpointsResponse = sendResponseSpy.getCall(0).args[0];
      expect(actualResponse.success).toBe(true);
      expect(actualResponse.body.breakpoints).toHaveLength(0);
      expect(sendEventSpy.calledOnce).toBe(true);
      expect(sendEventSpy.getCall(0).args[0]).toBeInstanceOf(Event);
      expect(sendEventSpy.getCall(0).args[0].body.subject).toBe('setBreakPointsRequest - path or breakpoints invalid');
    });

    it('Should return breakpoints', () => {
      const expectedPath = /^win32/.test(process.platform) ? 'C:\\space in path\\foo.cls' : '/space in path/foo.cls';
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

      expect(sendResponseSpy.calledOnce).toBe(true);
      const actualResponse: DebugProtocol.SetBreakpointsResponse = sendResponseSpy.getCall(0).args[0];
      expect(actualResponse.success).toBe(true);
      expect(actualResponse.body.breakpoints).toEqual([
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
      expect(canSetLineBreakpointStub.calledTwice).toBe(true);
      expect(canSetLineBreakpointStub.getCall(0).args).toEqual([uriFromLanguageServer, 1]);
      expect(canSetLineBreakpointStub.getCall(1).args).toEqual([uriFromLanguageServer, 2]);
      expect(sendEventSpy.calledTwice).toBe(true);
      expect(sendEventSpy.getCall(0).args[0]).toBeInstanceOf(Event);
      expect(sendEventSpy.getCall(0).args[0].body.subject).toBe('Failed to set breakpoint');
      expect(sendEventSpy.getCall(1).args[0]).toBeInstanceOf(Event);
      expect(sendEventSpy.getCall(1).args[0].body.subject).toBe('setBreakPointsRequest');
    });
  });

  describe('Launch request', () => {
    describe('Line breakpoint info', () => {
      let sendEventSpy: sinon.SinonSpy;
      let sendResponseSpy: sinon.SinonSpy;
      let createMappingsFromLineBreakpointInfo: sinon.SinonSpy;
      let hasLogLinesStub: sinon.SinonStub;
      let meetsLogLevelRequirementsStub: sinon.SinonStub;
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
        hasLogLinesStub = sinon.stub(LogContext.prototype, 'hasLogLines').returns(true);
        meetsLogLevelRequirementsStub = sinon.stub(LogContext.prototype, 'meetsLogLevelRequirements').returns(true);
        sendEventSpy = sinon.spy(ApexReplayDebug.prototype, 'sendEvent');
        sendResponseSpy = sinon.spy(ApexReplayDebug.prototype, 'sendResponse');
        createMappingsFromLineBreakpointInfo = sinon.spy(
          BreakpointUtil.prototype,
          'createMappingsFromLineBreakpointInfo'
        );
      });

      afterEach(() => {
        hasLogLinesStub.restore();
        meetsLogLevelRequirementsStub.restore();
        sendResponseSpy.restore();
        sendEventSpy.restore();
        createMappingsFromLineBreakpointInfo.restore();
      });

      it('Should handle undefined args', async () => {
        await adapter.launchRequest(initializedResponse, {} as LaunchRequestArguments);
        expect(createMappingsFromLineBreakpointInfo.called).toBe(false);
        expect(initializedResponse.message).toEqual(nls.localize('session_language_server_error_text'));
        expect(sendEventSpy.callCount).toBe(4);
        expect(sendEventSpy.getCall(1).args[0]).toBeInstanceOf(Event);
        expect(sendEventSpy.getCall(1).args[0].body.subject).toBe('No line breakpoint info available');
      });

      it('Should handle empty line breakpoint info', async () => {
        const config = {
          lineBreakpointInfo: [],
          logFile: 'someTestLogFile.log',
          projectPath: undefined
        };

        await adapter.launchRequest(initializedResponse, config as LaunchRequestArguments);
        expect(createMappingsFromLineBreakpointInfo.called).toBe(true);
        expect(sendResponseSpy.called).toBe(true);
        const actualResponse: DebugProtocol.InitializeResponse = sendResponseSpy.getCall(0).args[0];
        expect(actualResponse.success).toBe(true);
        expect(actualResponse).toEqual(initializedResponse);
        expect(adapter.getProjectPath()).toBe(undefined);
      });

      it('Should save line number mapping', async () => {
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

        const config = {
          lineBreakpointInfo: info,
          projectPath: projectPathArg,
          logFile: 'someTestLogFile.log'
        };
        await adapter.launchRequest(initializedResponse, config as LaunchRequestArguments);

        expect(createMappingsFromLineBreakpointInfo.calledOnce).toBe(true);
        expect(createMappingsFromLineBreakpointInfo.getCall(0).args[0]).toEqual(info);
        expect(sendResponseSpy.called).toBe(true);
        const actualResponse: DebugProtocol.InitializeResponse = sendResponseSpy.getCall(0).args[0];
        expect(actualResponse.success).toBe(true);
        expect(actualResponse).toEqual(initializedResponse);
        // Verify that the line number mapping is the expected line number mapping
        expect(breakpointUtil.getLineNumberMapping()).toEqual(expectedLineNumberMapping);
        expect(adapter.getProjectPath()).toBe(projectPathArg);
      });
    });
  });
});
