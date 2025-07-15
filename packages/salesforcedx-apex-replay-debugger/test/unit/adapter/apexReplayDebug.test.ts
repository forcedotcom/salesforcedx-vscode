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
    let sendResponseSpy: jest.SpyInstance;
    let sendEventSpy: jest.SpyInstance;
    let response: DebugProtocol.LaunchResponse;
    let args: LaunchRequestArguments;
    let hasLogLinesStub: jest.SpyInstance;
    let meetsLogLevelRequirementsStub: jest.SpyInstance;
    let readLogFileStub: jest.SpyInstance;
    let getLogSizeStub: jest.SpyInstance;
    let printToDebugConsoleStub: jest.SpyInstance;
    let errorToDebugConsoleStub: jest.SpyInstance;
    let scanLogForHeapDumpLinesStub: jest.SpyInstance;
    let fetchOverlayResultsForApexHeapDumpsStub: jest.SpyInstance;
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
        logFileContents: 'test log content',
        logFilePath,
        logFileName,
        stopOnEntry: true,
        trace: false,
        projectPath
      };
      sendResponseSpy = jest.spyOn(ApexReplayDebug.prototype, 'sendResponse');
      // Mock console methods to prevent them from calling sendEvent
      printToDebugConsoleStub = jest
        .spyOn(ApexReplayDebug.prototype, 'printToDebugConsole')
        .mockImplementation(() => {});
      errorToDebugConsoleStub = jest
        .spyOn(ApexReplayDebug.prototype, 'errorToDebugConsole')
        .mockImplementation(() => {});
      // Create a targeted sendEvent spy that only tracks the events we care about
      sendEventSpy = jest.spyOn(ApexReplayDebug.prototype, 'sendEvent').mockImplementation(event => {
        // Only track metric events and initialized events, not output events from console methods
        if (event.event === 'output') {
          return;
        }
        // Call the original implementation for non-output events
        return jest.requireActual('@vscode/debugadapter').DebugSession.prototype.sendEvent.call(adapter, event);
      });
      readLogFileStub = jest
        .spyOn(LogContextUtil.prototype, 'readLogFileFromContents')
        .mockReturnValue(['line1', 'line2']);
      getLogSizeStub = jest.spyOn(LogContext.prototype, 'getLogSize').mockReturnValue(123);
    });

    afterEach(() => {
      sendResponseSpy.mockRestore();
      sendEventSpy.mockRestore();
      hasLogLinesStub.mockRestore();
      meetsLogLevelRequirementsStub.mockRestore();
      readLogFileStub.mockRestore();
      getLogSizeStub.mockRestore();
      printToDebugConsoleStub.mockRestore();
      errorToDebugConsoleStub.mockRestore();
      if (scanLogForHeapDumpLinesStub) {
        scanLogForHeapDumpLinesStub.mockRestore();
      }
      if (fetchOverlayResultsForApexHeapDumpsStub) {
        fetchOverlayResultsForApexHeapDumpsStub.mockRestore();
      }
    });

    it('Should return error when there are no log lines', async () => {
      hasLogLinesStub = jest.spyOn(LogContext.prototype, 'hasLogLines').mockReturnValue(false);
      meetsLogLevelRequirementsStub = jest
        .spyOn(LogContext.prototype, 'meetsLogLevelRequirements')
        .mockReturnValue(false);

      await adapter.launchRequest(response, args);

      expect(hasLogLinesStub).toHaveBeenCalledTimes(1);
      expect(meetsLogLevelRequirementsStub).toHaveBeenCalledTimes(0);
      expect(sendResponseSpy).toHaveBeenCalledTimes(1);
      expect(sendEventSpy).toHaveBeenCalledTimes(4);
      const actualResponse: DebugProtocol.LaunchResponse = sendResponseSpy.mock.calls[0][0];
      expect(actualResponse.success).toBe(false);
      expect(actualResponse.message).toBe(nls.localize('no_log_file_text'));
      expect(sendEventSpy.mock.calls[1][0]).toBeInstanceOf(Event);
      expect(sendEventSpy.mock.calls[1][0].body.subject).toBe('No log lines found');
      expect(sendEventSpy.mock.calls[2][0]).toBeInstanceOf(InitializedEvent);
      const eventObj = sendEventSpy.mock.calls[3][0] as DebugProtocol.Event;
      expect(eventObj.event).toBe(SEND_METRIC_LAUNCH_EVENT);
      expect(eventObj.body).toEqual({
        logSize: 123,
        error: { subject: nls.localize('no_log_file_text') }
      });
    });

    it('Should return error when log levels are incorrect', async () => {
      hasLogLinesStub = jest.spyOn(LogContext.prototype, 'hasLogLines').mockReturnValue(true);
      meetsLogLevelRequirementsStub = jest
        .spyOn(LogContext.prototype, 'meetsLogLevelRequirements')
        .mockReturnValue(false);

      await adapter.launchRequest(response, args);

      expect(hasLogLinesStub).toHaveBeenCalledTimes(1);
      expect(meetsLogLevelRequirementsStub).toHaveBeenCalledTimes(1);
      expect(sendResponseSpy).toHaveBeenCalledTimes(1);
      expect(sendEventSpy).toHaveBeenCalledTimes(4);
      const actualResponse: DebugProtocol.LaunchResponse = sendResponseSpy.mock.calls[0][0];
      expect(actualResponse.success).toBe(false);
      expect(actualResponse.message).toBe(nls.localize('incorrect_log_levels_text'));
      expect(sendEventSpy.mock.calls[1][0]).toBeInstanceOf(Event);
      expect(sendEventSpy.mock.calls[1][0].body.subject).toBe('Incorrect log levels');
      expect(sendEventSpy.mock.calls[2][0]).toBeInstanceOf(InitializedEvent);
      const eventObj = sendEventSpy.mock.calls[3][0] as DebugProtocol.Event;
      expect(eventObj.event).toBe(SEND_METRIC_LAUNCH_EVENT);
      expect(eventObj.body).toEqual({
        logSize: 123,
        error: { subject: nls.localize('incorrect_log_levels_text') }
      });
    });

    it('Should send response', async () => {
      hasLogLinesStub = jest.spyOn(LogContext.prototype, 'hasLogLines').mockReturnValue(true);
      meetsLogLevelRequirementsStub = jest
        .spyOn(LogContext.prototype, 'meetsLogLevelRequirements')
        .mockReturnValue(true);

      args.lineBreakpointInfo = lineBpInfo;
      await adapter.launchRequest(response, args);

      expect(hasLogLinesStub).toHaveBeenCalledTimes(1);
      expect(meetsLogLevelRequirementsStub).toHaveBeenCalledTimes(1);
      expect(printToDebugConsoleStub).toHaveBeenCalledTimes(1);
      const consoleMessage = printToDebugConsoleStub.mock.calls[0][0];
      expect(consoleMessage).toBe(nls.localize('session_started_text', logFileName));
      expect(sendResponseSpy).toHaveBeenCalledTimes(1);
      const actualResponse: DebugProtocol.LaunchResponse = sendResponseSpy.mock.calls[0][0];
      expect(actualResponse.success).toBe(true);
    });

    it('Should not scan for log lines if projectPath is undefined', async () => {
      hasLogLinesStub = jest.spyOn(LogContext.prototype, 'hasLogLines').mockReturnValue(true);
      meetsLogLevelRequirementsStub = jest
        .spyOn(LogContext.prototype, 'meetsLogLevelRequirements')
        .mockReturnValue(true);
      scanLogForHeapDumpLinesStub = jest.spyOn(LogContext.prototype, 'scanLogForHeapDumpLines').mockReturnValue(false);

      adapter.setProjectPath(undefined);
      await adapter.launchRequest(response, args);

      expect(hasLogLinesStub).toHaveBeenCalledTimes(1);
      expect(meetsLogLevelRequirementsStub).toHaveBeenCalledTimes(1);
      expect(scanLogForHeapDumpLinesStub).toHaveBeenCalledTimes(0);
    });

    it('Should scan log lines for heap dumps if projectPath is set', async () => {
      hasLogLinesStub = jest.spyOn(LogContext.prototype, 'hasLogLines').mockReturnValue(true);
      meetsLogLevelRequirementsStub = jest
        .spyOn(LogContext.prototype, 'meetsLogLevelRequirements')
        .mockReturnValue(true);
      scanLogForHeapDumpLinesStub = jest.spyOn(LogContext.prototype, 'scanLogForHeapDumpLines').mockReturnValue(false);
      fetchOverlayResultsForApexHeapDumpsStub = jest
        .spyOn(LogContext.prototype, 'fetchOverlayResultsForApexHeapDumps')
        .mockResolvedValue(true);

      args.lineBreakpointInfo = lineBpInfo;
      await adapter.launchRequest(response, args);

      expect(hasLogLinesStub).toHaveBeenCalledTimes(1);
      expect(meetsLogLevelRequirementsStub).toHaveBeenCalledTimes(1);
      expect(scanLogForHeapDumpLinesStub).toHaveBeenCalledTimes(1);
      // fetchOverlayResultsForApexHeapDumps should not be called if scanLogForHeapDumpLines returns false
      expect(fetchOverlayResultsForApexHeapDumpsStub).toHaveBeenCalledTimes(0);
    });

    it('Should call to fetch overlay results if heap dumps are found in the logs', async () => {
      hasLogLinesStub = jest.spyOn(LogContext.prototype, 'hasLogLines').mockReturnValue(true);
      meetsLogLevelRequirementsStub = jest
        .spyOn(LogContext.prototype, 'meetsLogLevelRequirements')
        .mockReturnValue(true);
      scanLogForHeapDumpLinesStub = jest.spyOn(LogContext.prototype, 'scanLogForHeapDumpLines').mockReturnValue(true);
      fetchOverlayResultsForApexHeapDumpsStub = jest
        .spyOn(LogContext.prototype, 'fetchOverlayResultsForApexHeapDumps')
        .mockResolvedValue(true);

      args.lineBreakpointInfo = lineBpInfo;
      await adapter.launchRequest(response, args);

      expect(hasLogLinesStub).toHaveBeenCalledTimes(1);
      expect(meetsLogLevelRequirementsStub).toHaveBeenCalledTimes(1);
      expect(scanLogForHeapDumpLinesStub).toHaveBeenCalledTimes(1);
      expect(fetchOverlayResultsForApexHeapDumpsStub).toHaveBeenCalledTimes(1);
    });

    it('Should report a wrap up error if fetching heap dumps has a failure', async () => {
      hasLogLinesStub = jest.spyOn(LogContext.prototype, 'hasLogLines').mockReturnValue(true);
      meetsLogLevelRequirementsStub = jest
        .spyOn(LogContext.prototype, 'meetsLogLevelRequirements')
        .mockReturnValue(true);
      scanLogForHeapDumpLinesStub = jest.spyOn(LogContext.prototype, 'scanLogForHeapDumpLines').mockReturnValue(true);
      fetchOverlayResultsForApexHeapDumpsStub = jest
        .spyOn(LogContext.prototype, 'fetchOverlayResultsForApexHeapDumps')
        .mockResolvedValue(false);

      args.lineBreakpointInfo = lineBpInfo;
      await adapter.launchRequest(response, args);

      expect(hasLogLinesStub).toHaveBeenCalledTimes(1);
      expect(meetsLogLevelRequirementsStub).toHaveBeenCalledTimes(1);
      expect(scanLogForHeapDumpLinesStub).toHaveBeenCalledTimes(1);
      expect(fetchOverlayResultsForApexHeapDumpsStub).toHaveBeenCalledTimes(1);
      expect(errorToDebugConsoleStub).toHaveBeenCalledTimes(1);
      expect(sendEventSpy).toHaveBeenCalledTimes(4);
      const errorMessage = errorToDebugConsoleStub.mock.calls[0][0];
      expect(errorMessage).toBe(nls.localize('heap_dump_error_wrap_up_text'));
      expect(sendEventSpy.mock.calls[1][0]).toBeInstanceOf(Event);
      expect(sendEventSpy.mock.calls[1][0].body.subject).toBe('Fetching heap dumps failed');
      expect(sendEventSpy.mock.calls[2][0]).toBeInstanceOf(InitializedEvent);
      const eventObj = sendEventSpy.mock.calls[3][0] as DebugProtocol.Event;
      expect(eventObj.event).toBe(SEND_METRIC_LAUNCH_EVENT);
      expect(eventObj.body).toEqual({
        logSize: 123,
        error: { subject: nls.localize('heap_dump_error_wrap_up_text') }
      });
    });
  });

  describe('Configuration done', () => {
    let sendEventSpy: jest.SpyInstance;
    let updateFramesStub: jest.SpyInstance;
    let continueRequestStub: jest.SpyInstance;
    let getLaunchArgsStub: jest.SpyInstance;
    let response: DebugProtocol.ConfigurationDoneResponse;
    const args: DebugProtocol.ConfigurationDoneArguments = {};
    const launchRequestArgs: LaunchRequestArguments = {
      logFileContents: 'test log content',
      logFilePath,
      logFileName,
      trace: true,
      projectPath
    };

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      adapter.setLogFile(launchRequestArgs);
      // Create a targeted sendEvent spy that filters out output events
      sendEventSpy = jest.spyOn(ApexReplayDebug.prototype, 'sendEvent').mockImplementation(event => {
        if (event.event === 'output') {
          return;
        }
        return jest.requireActual('@vscode/debugadapter').DebugSession.prototype.sendEvent.call(adapter, event);
      });
      updateFramesStub = jest.spyOn(LogContext.prototype, 'updateFrames');
      continueRequestStub = jest.spyOn(ApexReplayDebug.prototype, 'continueRequest').mockImplementation(() => {});
      response = adapter.getDefaultResponse();
    });

    afterEach(() => {
      sendEventSpy.mockRestore();
      updateFramesStub.mockRestore();
      continueRequestStub.mockRestore();
      getLaunchArgsStub.mockRestore();
    });

    it('Should send stopped event', () => {
      getLaunchArgsStub = jest.spyOn(LogContext.prototype, 'getLaunchArgs').mockReturnValue({
        stopOnEntry: true
      } as LaunchRequestArguments);

      adapter.configurationDoneRequest(response, args);

      expect(updateFramesStub).toHaveBeenCalledTimes(1);
      expect(sendEventSpy).toHaveBeenCalledTimes(2);
      const event = sendEventSpy.mock.calls[0][0];
      expect(event).toBeInstanceOf(StoppedEvent);
      expect(sendEventSpy.mock.calls[1][0]).toBeInstanceOf(Event);
      expect(sendEventSpy.mock.calls[1][0].body.subject).toBe('configurationDoneRequest');
    });

    it('Should continue until next breakpoint', () => {
      getLaunchArgsStub = jest.spyOn(LogContext.prototype, 'getLaunchArgs').mockReturnValue({
        stopOnEntry: false
      } as LaunchRequestArguments);

      adapter.configurationDoneRequest(response, args);

      expect(updateFramesStub).toHaveBeenCalledTimes(0);
      expect(sendEventSpy).toHaveBeenCalledTimes(1);
      expect(updateFramesStub).toHaveBeenCalledTimes(0);
      expect(continueRequestStub).toHaveBeenCalledTimes(1);
      expect(sendEventSpy.mock.calls[0][0]).toBeInstanceOf(Event);
      expect(sendEventSpy.mock.calls[0][0].body.subject).toBe('configurationDoneRequest');
    });
  });

  describe('Disconnect', () => {
    let sendEventSpy: jest.SpyInstance;
    let sendResponseSpy: jest.SpyInstance;
    let response: DebugProtocol.DisconnectResponse;
    let args: DebugProtocol.DisconnectArguments;
    let printToDebugConsoleStub: jest.SpyInstance;

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      response = adapter.getDefaultResponse();
      args = {};
      // Mock printToDebugConsole to prevent it from calling sendEvent
      printToDebugConsoleStub = jest
        .spyOn(ApexReplayDebug.prototype, 'printToDebugConsole')
        .mockImplementation(() => {});
      // Create a targeted sendEvent spy that filters out output events
      sendEventSpy = jest.spyOn(ApexReplayDebug.prototype, 'sendEvent').mockImplementation(event => {
        if (event.event === 'output') {
          return;
        }
        return jest.requireActual('@vscode/debugadapter').DebugSession.prototype.sendEvent.call(adapter, event);
      });
      sendResponseSpy = jest.spyOn(ApexReplayDebug.prototype, 'sendResponse');
    });

    afterEach(() => {
      sendEventSpy.mockRestore();
      sendResponseSpy.mockRestore();
      printToDebugConsoleStub.mockRestore();
    });

    it('Should disconnect', () => {
      adapter.disconnectRequest(response, args);

      expect(printToDebugConsoleStub).toHaveBeenCalledTimes(1);
      const consoleMessage = printToDebugConsoleStub.mock.calls[0][0];
      expect(consoleMessage).toBe(nls.localize('session_terminated_text'));
      expect(sendResponseSpy).toHaveBeenCalledTimes(1);
      const actualResponse: DebugProtocol.DisconnectResponse = sendResponseSpy.mock.calls[0][0];
      expect(actualResponse.success).toBe(true);
      expect(sendEventSpy.mock.calls[0][0]).toBeInstanceOf(Event);
      expect(sendEventSpy.mock.calls[0][0].body.subject).toBe('disconnectRequest');
    });
  });

  describe('Threads', () => {
    let sendResponseSpy: jest.SpyInstance;
    let response: DebugProtocol.ThreadsResponse;
    let readLogFileStub: jest.SpyInstance;
    const launchRequestArgs: LaunchRequestArguments = {
      logFileContents: 'test log content',
      logFilePath,
      logFileName,
      trace: true,
      projectPath
    };

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      response = Object.assign(adapter.getDefaultResponse(), {
        body: { threads: [] }
      });
      sendResponseSpy = jest.spyOn(ApexReplayDebug.prototype, 'sendResponse');
      readLogFileStub = jest
        .spyOn(LogContextUtil.prototype, 'readLogFileFromContents')
        .mockReturnValue(['line1', 'line2']);
      adapter.setLogFile(launchRequestArgs);
    });

    afterEach(() => {
      sendResponseSpy.mockRestore();
      readLogFileStub.mockRestore();
    });

    it('Should always return one thread', () => {
      adapter.threadsRequest(response);

      expect(sendResponseSpy).toHaveBeenCalledTimes(1);
      const actualResponse: DebugProtocol.ThreadsResponse = sendResponseSpy.mock.calls[0][0];
      expect(actualResponse.success).toBe(true);
      expect(actualResponse.body.threads.length).toBe(1);
      const thread: Thread = actualResponse.body.threads[0];
      expect(thread.id).toBe(ApexReplayDebug.THREAD_ID);
    });
  });

  describe('Stacktrace', () => {
    let sendResponseSpy: jest.SpyInstance;
    let response: DebugProtocol.StackTraceResponse;
    let args: DebugProtocol.StackTraceArguments;
    let readLogFileStub: jest.SpyInstance;
    let getFramesStub: jest.SpyInstance;
    const launchRequestArgs: LaunchRequestArguments = {
      logFileContents: 'test log content',
      logFilePath,
      logFileName,
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
      sendResponseSpy = jest.spyOn(ApexReplayDebug.prototype, 'sendResponse');
      readLogFileStub = jest
        .spyOn(LogContextUtil.prototype, 'readLogFileFromContents')
        .mockReturnValue(['line1', 'line2']);
      adapter.setLogFile(launchRequestArgs);
      getFramesStub = jest.spyOn(LogContext.prototype, 'getFrames').mockReturnValue(sampleStackFrames);
    });

    afterEach(() => {
      sendResponseSpy.mockRestore();
      readLogFileStub.mockRestore();
      getFramesStub.mockRestore();
    });

    it('Should return stackframes', () => {
      adapter.stackTraceRequest(response, args);

      expect(sendResponseSpy).toHaveBeenCalledTimes(1);
      const actualResponse: DebugProtocol.StackTraceResponse = sendResponseSpy.mock.calls[0][0];
      expect(actualResponse.success).toBe(true);
      expect(actualResponse.body.stackFrames).toEqual(sampleStackFrames.slice().reverse());
    });
  });

  describe('Continue/run', () => {
    let sendResponseSpy: jest.SpyInstance;
    let sendEventSpy: jest.SpyInstance;
    let hasLogLinesStub: jest.SpyInstance;
    let updateFramesStub: jest.SpyInstance;
    let shouldStopForBreakpointStub: jest.SpyInstance;
    let response: DebugProtocol.ContinueResponse;
    let args: DebugProtocol.ContinueArguments;
    const launchRequestArgs: LaunchRequestArguments = {
      logFileContents: 'test log content',
      logFilePath,
      logFileName,
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
      sendResponseSpy = jest.spyOn(ApexReplayDebug.prototype, 'sendResponse');
      // Create a targeted sendEvent spy that filters out output events
      sendEventSpy = jest.spyOn(ApexReplayDebug.prototype, 'sendEvent').mockImplementation(event => {
        if (event.event === 'output') {
          return;
        }
        return jest.requireActual('@vscode/debugadapter').DebugSession.prototype.sendEvent.call(adapter, event);
      });
    });

    afterEach(() => {
      sendResponseSpy.mockRestore();
      sendEventSpy.mockRestore();
      hasLogLinesStub.mockRestore();
      if (updateFramesStub) {
        updateFramesStub.mockRestore();
      }
      if (shouldStopForBreakpointStub) {
        shouldStopForBreakpointStub.mockRestore();
      }
    });

    it('Should terminate session', () => {
      hasLogLinesStub = jest.spyOn(LogContext.prototype, 'hasLogLines').mockReturnValue(false);

      adapter.continueRequest(response, args);

      expect(sendResponseSpy).toHaveBeenCalledTimes(1);
      const actualResponse: DebugProtocol.StackTraceResponse = sendResponseSpy.mock.calls[0][0];
      expect(actualResponse.success).toBe(true);
      expect(sendEventSpy).toHaveBeenCalledTimes(1);
      expect(sendEventSpy.mock.calls[0][0]).toBeInstanceOf(TerminatedEvent);
    });

    it('Should hit breakpoint', () => {
      hasLogLinesStub = jest
        .spyOn(LogContext.prototype, 'hasLogLines')
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
      updateFramesStub = jest.spyOn(LogContext.prototype, 'updateFrames');
      shouldStopForBreakpointStub = jest
        .spyOn(MockApexReplayDebug.prototype, 'shouldStopForBreakpoint')
        .mockReturnValue(true);

      adapter.continueRequest(response, args);

      expect(sendResponseSpy).toHaveBeenCalledTimes(1);
      const actualResponse: DebugProtocol.StackTraceResponse = sendResponseSpy.mock.calls[0][0];
      expect(actualResponse.success).toBe(true);
      expect(sendEventSpy).toHaveBeenCalledTimes(0);
    });

    it('Should not hit breakpoint', () => {
      hasLogLinesStub = jest
        .spyOn(LogContext.prototype, 'hasLogLines')
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
      updateFramesStub = jest.spyOn(LogContext.prototype, 'updateFrames');
      shouldStopForBreakpointStub = jest
        .spyOn(MockApexReplayDebug.prototype, 'shouldStopForBreakpoint')
        .mockReturnValue(false);

      adapter.continueRequest(response, args);

      expect(sendResponseSpy).toHaveBeenCalledTimes(1);
      const actualResponse: DebugProtocol.StackTraceResponse = sendResponseSpy.mock.calls[0][0];
      expect(actualResponse.success).toBe(true);
      expect(sendEventSpy).toHaveBeenCalledTimes(1);
      const event = sendEventSpy.mock.calls[0][0];
      expect(event).toBeInstanceOf(TerminatedEvent);
    });

    it('Should handle errors during step execution', () => {
      hasLogLinesStub = jest.spyOn(LogContext.prototype, 'hasLogLines').mockReturnValue(true);

      // Cause `updateFrames` to throw an error to trigger the catch block
      const error = new Error('Test error during step execution');
      updateFramesStub = jest.spyOn(LogContext.prototype, 'updateFrames').mockImplementation(() => {
        throw error;
      });

      shouldStopForBreakpointStub = jest
        .spyOn(MockApexReplayDebug.prototype, 'shouldStopForBreakpoint')
        .mockReturnValue(false);

      try {
        adapter.continueRequest(response, args);
      } catch (err) {
        // Assert that the error thrown is the one we caused
        expect(err).toBe(error);
      }

      // Check that the error event was sent
      expect(sendEventSpy).toHaveBeenCalledTimes(1);
      const event = sendEventSpy.mock.calls[0][0];
      expect(event).toBeInstanceOf(Event);
      expect(event.event).toBe(SEND_METRIC_ERROR_EVENT);
      expect(event.body.subject).toBe('Error during step execution');
      expect(event.body.message).toBe(error.message);
    });
  });

  describe('Stepping', () => {
    let sendResponseSpy: jest.SpyInstance;
    let sendEventSpy: jest.SpyInstance;
    let hasLogLinesStub: jest.SpyInstance;
    let updateFramesStub: jest.SpyInstance;
    let getNumOfFramesStub: jest.SpyInstance;

    beforeEach(() => {
      sendResponseSpy = jest.spyOn(ApexReplayDebug.prototype, 'sendResponse');
      // Create a targeted sendEvent spy that filters out output events
      sendEventSpy = jest.spyOn(ApexReplayDebug.prototype, 'sendEvent').mockImplementation(event => {
        if (event.event === 'output') {
          return;
        }
        return jest.requireActual('@vscode/debugadapter').DebugSession.prototype.sendEvent.call(adapter, event);
      });
      updateFramesStub = jest.spyOn(LogContext.prototype, 'updateFrames');
      hasLogLinesStub = jest
        .spyOn(LogContext.prototype, 'hasLogLines')
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
    });

    afterEach(() => {
      sendResponseSpy.mockRestore();
      sendEventSpy.mockRestore();
      hasLogLinesStub.mockRestore();
      updateFramesStub.mockRestore();
      getNumOfFramesStub.mockRestore();
    });

    it('Should send step over', () => {
      getNumOfFramesStub = jest
        .spyOn(LogContext.prototype, 'getNumOfFrames')
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(2);

      adapter.nextRequest(
        Object.assign(adapter.getDefaultResponse(), {
          body: {}
        }),
        {
          threadId: ApexReplayDebug.THREAD_ID
        }
      );

      expect(sendResponseSpy).toHaveBeenCalledTimes(1);
      const actualResponse: DebugProtocol.StackTraceResponse = sendResponseSpy.mock.calls[0][0];
      expect(actualResponse.success).toBe(true);
      expect(sendEventSpy).toHaveBeenCalledTimes(1);
      const event = sendEventSpy.mock.calls[0][0];
      expect(event).toBeInstanceOf(StoppedEvent);
      expect((event as StoppedEvent).body.reason).toBe('step');
    });

    it('Should send step in', () => {
      getNumOfFramesStub = jest
        .spyOn(LogContext.prototype, 'getNumOfFrames')
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(3);

      adapter.stepInRequest(
        Object.assign(adapter.getDefaultResponse(), {
          body: {}
        }),
        {
          threadId: ApexReplayDebug.THREAD_ID
        }
      );

      expect(sendResponseSpy).toHaveBeenCalledTimes(1);
      const actualResponse: DebugProtocol.StackTraceResponse = sendResponseSpy.mock.calls[0][0];
      expect(actualResponse.success).toBe(true);
      expect(sendEventSpy).toHaveBeenCalledTimes(1);
      const event = sendEventSpy.mock.calls[0][0];
      expect(event).toBeInstanceOf(StoppedEvent);
      expect((event as StoppedEvent).body.reason).toBe('step');
    });

    it('Should send step out', () => {
      getNumOfFramesStub = jest
        .spyOn(LogContext.prototype, 'getNumOfFrames')
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(1);

      adapter.stepOutRequest(
        Object.assign(adapter.getDefaultResponse(), {
          body: {}
        }),
        {
          threadId: ApexReplayDebug.THREAD_ID
        }
      );

      expect(sendResponseSpy).toHaveBeenCalledTimes(1);
      const actualResponse: DebugProtocol.StackTraceResponse = sendResponseSpy.mock.calls[0][0];
      expect(actualResponse.success).toBe(true);
      expect(sendEventSpy).toHaveBeenCalledTimes(1);
      const event = sendEventSpy.mock.calls[0][0];
      expect(event).toBeInstanceOf(StoppedEvent);
      expect((event as StoppedEvent).body.reason).toBe('step');
    });
  });

  describe('Breakpoints', () => {
    let sendResponseSpy: jest.SpyInstance;
    let sendEventSpy: jest.SpyInstance;
    let canSetLineBreakpointStub: jest.SpyInstance;
    let getTopFrameStub: jest.SpyInstance;
    let response: DebugProtocol.SetBreakpointsResponse;
    let args: DebugProtocol.SetBreakpointsArguments;
    const launchRequestArgs: LaunchRequestArguments = {
      logFileContents: 'test log content',
      logFilePath,
      logFileName,
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
      sendResponseSpy = jest.spyOn(ApexReplayDebug.prototype, 'sendResponse');
      // Create a targeted sendEvent spy that filters out output events
      sendEventSpy = jest.spyOn(ApexReplayDebug.prototype, 'sendEvent').mockImplementation(event => {
        if (event.event === 'output') {
          return;
        }
        return jest.requireActual('@vscode/debugadapter').DebugSession.prototype.sendEvent.call(adapter, event);
      });
    });

    afterEach(() => {
      sendResponseSpy.mockRestore();
      sendEventSpy.mockRestore();
      if (canSetLineBreakpointStub) {
        canSetLineBreakpointStub.mockRestore();
      }
      if (getTopFrameStub) {
        getTopFrameStub.mockRestore();
      }
    });

    it('Should stop for breakpoint', () => {
      getTopFrameStub = jest
        .spyOn(LogContext.prototype, 'getTopFrame')
        .mockReturnValue({ line: 2, source: { path: '/path/foo.cls' } } as StackFrame);
      adapter.getBreakpoints().set('file:///path/foo.cls', [2]);

      const isStopped = adapter.shouldStopForBreakpoint();

      expect(isStopped).toBe(true);
      expect(sendEventSpy).toHaveBeenCalledTimes(1);
      const event = sendEventSpy.mock.calls[0][0];
      expect(event).toBeInstanceOf(StoppedEvent);
    });

    it('Should not stop for breakpoint', () => {
      getTopFrameStub = jest
        .spyOn(LogContext.prototype, 'getTopFrame')
        .mockReturnValue({ line: 2, source: { path: '/path/foo.cls' } } as StackFrame);
      adapter.getBreakpoints().set('file:///path/bar.cls', [2]);

      const isStopped = adapter.shouldStopForBreakpoint();

      expect(isStopped).toBe(false);
      expect(sendEventSpy).toHaveBeenCalledTimes(0);
    });

    it('Should not return breakpoints when path argument is invalid', () => {
      args.lines = [1];

      adapter.setBreakPointsRequest(response, args);

      expect(sendResponseSpy).toHaveBeenCalledTimes(1);
      const actualResponse: DebugProtocol.SetBreakpointsResponse = sendResponseSpy.mock.calls[0][0];
      expect(actualResponse.success).toBe(true);
      expect(actualResponse.body.breakpoints).toHaveLength(0);
      expect(sendEventSpy).toHaveBeenCalledTimes(1);
      expect(sendEventSpy.mock.calls[0][0]).toBeInstanceOf(Event);
      expect(sendEventSpy.mock.calls[0][0].body.subject).toBe('setBreakPointsRequest - path or breakpoints invalid');
    });

    it('Should not return breakpoints when line argument is invalid', () => {
      args.source.path = 'foo.cls';

      adapter.setBreakPointsRequest(response, args);

      expect(sendResponseSpy).toHaveBeenCalledTimes(1);
      const actualResponse: DebugProtocol.SetBreakpointsResponse = sendResponseSpy.mock.calls[0][0];
      expect(actualResponse.success).toBe(true);
      expect(actualResponse.body.breakpoints).toHaveLength(0);
      expect(sendEventSpy).toHaveBeenCalledTimes(1);
      expect(sendEventSpy.mock.calls[0][0]).toBeInstanceOf(Event);
      expect(sendEventSpy.mock.calls[0][0].body.subject).toBe('setBreakPointsRequest - path or breakpoints invalid');
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
      canSetLineBreakpointStub = jest
        .spyOn(BreakpointUtil.prototype, 'canSetLineBreakpoint')
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      adapter.setBreakPointsRequest(response, args);

      expect(sendResponseSpy).toHaveBeenCalledTimes(1);
      const actualResponse: DebugProtocol.SetBreakpointsResponse = sendResponseSpy.mock.calls[0][0];
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
      expect(canSetLineBreakpointStub).toHaveBeenCalledTimes(2);
      expect(canSetLineBreakpointStub.mock.calls[0][0]).toEqual(uriFromLanguageServer);
      expect(canSetLineBreakpointStub.mock.calls[0][1]).toEqual(1);
      expect(canSetLineBreakpointStub.mock.calls[1][0]).toEqual(uriFromLanguageServer);
      expect(canSetLineBreakpointStub.mock.calls[1][1]).toEqual(2);
      expect(sendEventSpy).toHaveBeenCalledTimes(2);
      expect(sendEventSpy.mock.calls[0][0]).toBeInstanceOf(Event);
      expect(sendEventSpy.mock.calls[0][0].body.subject).toBe('Failed to set breakpoint');
      expect(sendEventSpy.mock.calls[1][0]).toBeInstanceOf(Event);
      expect(sendEventSpy.mock.calls[1][0].body.subject).toBe('setBreakPointsRequest');
    });
  });

  describe('Launch request', () => {
    describe('Line breakpoint info', () => {
      let sendEventSpy: jest.SpyInstance;
      let sendResponseSpy: jest.SpyInstance;
      let createMappingsFromLineBreakpointInfo: jest.SpyInstance;
      let hasLogLinesStub: jest.SpyInstance;
      let meetsLogLevelRequirementsStub: jest.SpyInstance;
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
        hasLogLinesStub = jest.spyOn(LogContext.prototype, 'hasLogLines').mockReturnValue(true);
        meetsLogLevelRequirementsStub = jest
          .spyOn(LogContext.prototype, 'meetsLogLevelRequirements')
          .mockReturnValue(true);
        // Create a targeted sendEvent spy that filters out output events
        sendEventSpy = jest.spyOn(ApexReplayDebug.prototype, 'sendEvent').mockImplementation(event => {
          if (event.event === 'output') {
            return;
          }
          return jest.requireActual('@vscode/debugadapter').DebugSession.prototype.sendEvent.call(adapter, event);
        });
        sendResponseSpy = jest.spyOn(ApexReplayDebug.prototype, 'sendResponse');
        createMappingsFromLineBreakpointInfo = jest.spyOn(
          BreakpointUtil.prototype,
          'createMappingsFromLineBreakpointInfo'
        );
      });

      afterEach(() => {
        hasLogLinesStub.mockRestore();
        meetsLogLevelRequirementsStub.mockRestore();
        sendResponseSpy.mockRestore();
        sendEventSpy.mockRestore();
        createMappingsFromLineBreakpointInfo.mockRestore();
      });

      it('Should handle undefined args', async () => {
        await adapter.launchRequest(initializedResponse, {
          logFileContents: 'test log content',
          logFilePath,
          logFileName
        } as LaunchRequestArguments);
        expect(createMappingsFromLineBreakpointInfo).toHaveBeenCalledTimes(0);
        expect(initializedResponse.message).toEqual(nls.localize('session_language_server_error_text'));
        expect(sendEventSpy).toHaveBeenCalledTimes(4);
        expect(sendEventSpy.mock.calls[1][0]).toBeInstanceOf(Event);
        expect(sendEventSpy.mock.calls[1][0].body.subject).toBe('No line breakpoint info available');
      });

      it('Should handle empty line breakpoint info', async () => {
        const config = {
          lineBreakpointInfo: [],
          logFileContents: 'test log content',
          logFilePath,
          logFileName,
          projectPath: undefined
        };

        await adapter.launchRequest(initializedResponse, config as LaunchRequestArguments);
        expect(createMappingsFromLineBreakpointInfo).toHaveBeenCalledTimes(1);
        expect(sendResponseSpy).toHaveBeenCalledTimes(1);
        const actualResponse: DebugProtocol.InitializeResponse = sendResponseSpy.mock.calls[0][0];
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
          logFileContents: 'test log content',
          logFilePath,
          logFileName
        };
        await adapter.launchRequest(initializedResponse, config as LaunchRequestArguments);

        expect(createMappingsFromLineBreakpointInfo).toHaveBeenCalledTimes(1);
        expect(createMappingsFromLineBreakpointInfo.mock.calls[0][0]).toEqual(info);
        expect(sendResponseSpy).toHaveBeenCalledTimes(1);
        const actualResponse: DebugProtocol.InitializeResponse = sendResponseSpy.mock.calls[0][0];
        expect(actualResponse.success).toBe(true);
        expect(actualResponse).toEqual(initializedResponse);
        // Verify that the line number mapping is the expected line number mapping
        expect(breakpointUtil.getLineNumberMapping()).toEqual(expectedLineNumberMapping);
        expect(adapter.getProjectPath()).toBe(projectPathArg);
      });
    });
  });
});
