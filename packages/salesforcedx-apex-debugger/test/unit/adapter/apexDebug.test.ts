/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// This is only done in tests because we are mocking things

import { Org } from '@salesforce/core';
import { ConfigAggregator } from '@salesforce/core/configAggregator';
import { LineBreakpointInfo } from '@salesforce/salesforcedx-utils';
import { OutputEvent, Source, StackFrame, StoppedEvent, ThreadEvent } from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import * as AsyncLock from 'async-lock';
import * as os from 'node:os';
import { URI } from 'vscode-uri';
import {
  ApexDebugStackFrameInfo,
  ApexVariable,
  ApexVariableKind,
  LaunchRequestArguments,
  SetExceptionBreakpointsArguments
} from '../../../src/adapter/apexDebug';
import { LineBreakpointsInTyperef } from '../../../src/breakpoints/lineBreakpoint';
import { RunCommand, StateCommand, StepIntoCommand, StepOutCommand, StepOverCommand } from '../../../src/commands';
import {
  DEFAULT_CONNECTION_TIMEOUT_MS,
  DEFAULT_IDLE_TIMEOUT_MS,
  DEFAULT_IDLE_WARN1_MS,
  DEFAULT_IDLE_WARN2_MS,
  DEFAULT_IDLE_WARN3_MS,
  EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS,
  EXCEPTION_BREAKPOINT_BREAK_MODE_NEVER,
  EXCEPTION_BREAKPOINT_REQUEST,
  HOTSWAP_REQUEST,
  LIST_EXCEPTION_BREAKPOINTS_REQUEST,
  SALESFORCE_EXCEPTION_PREFIX,
  SHOW_MESSAGE_EVENT,
  TRIGGER_EXCEPTION_PREFIX
} from '../../../src/constants';
import {
  ApexDebuggerEventType,
  BreakpointService,
  DebuggerMessage,
  SessionService,
  StreamingClientInfo,
  StreamingEvent,
  StreamingService
} from '../../../src/core';
import { VscodeDebuggerMessage, VscodeDebuggerMessageType, WorkspaceSettings } from '../../../src/index';
import { nls } from '../../../src/messages';
import { RequestService } from '../../../src/requestService/requestService';
import { ApexDebugForTest } from './apexDebugForTest';
import { DummyContainer, newStringValue } from './apexDebugVariablesHandling.test';

jest.setTimeout(30_000);

describe('Interactive debugger adapter - unit', () => {
  let adapter: ApexDebugForTest;
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
    adapter = new ApexDebugForTest(new RequestService());
  });

  afterEach(() => {
    adapter?.clearIdleTimers();
  });

  describe('Attach', () => {
    let response: DebugProtocol.AttachResponse;
    let args: DebugProtocol.AttachRequestArguments;

    beforeEach(() => {
      response = {
        command: '',
        success: true,
        request_seq: 0,
        seq: 0,
        type: 'response'
      };
      args = {};
    });

    it('Should not attach', () => {
      adapter.attachReq(response, args);
      const actualResp: DebugProtocol.Response = adapter.getResponse(0);
      expect(actualResp.success).toBe(false);
    });
  });

  describe('Launch', () => {
    let sessionStartSpy: jest.SpyInstance;
    let sessionPrintToDebugSpy: jest.SpyInstance;
    let sessionUserFilterSpy: jest.SpyInstance;
    let sessionEntryFilterSpy: jest.SpyInstance;
    let sessionRequestFilterSpy: jest.SpyInstance;
    let resetIdleTimersSpy: jest.SpyInstance;
    let configGetSpy: jest.SpyInstance;
    let args: LaunchRequestArguments;
    const lineBpInfo: LineBreakpointInfo[] = [
      {
        uri: 'classA',
        typeref: 'StaticVarsA',
        lines: [9, 10, 13]
      }
    ];

    beforeEach(() => {
      jest.spyOn(SessionService.prototype, 'forProject');
      sessionUserFilterSpy = jest.spyOn(SessionService.prototype, 'withUserFilter');
      sessionEntryFilterSpy = jest.spyOn(SessionService.prototype, 'withEntryFilter');
      sessionRequestFilterSpy = jest.spyOn(SessionService.prototype, 'withRequestFilter');
      resetIdleTimersSpy = jest.spyOn(ApexDebugForTest.prototype, 'resetIdleTimer');
      configGetSpy = jest.spyOn(ConfigAggregator, 'create').mockResolvedValue({
        getPropertyValue: () => undefined
      } as any);
      jest.spyOn(Org, 'create').mockResolvedValue({
        getConnection: () => ({
          instanceUrl: 'https://test.salesforce.com',
          accessToken: 'test-token'
        })
      } as any);
      args = {
        salesforceProject: 'project',
        userIdFilter: ['005FAKE1', '005FAKE2', '005FAKE1'],
        entryPointFilter: 'entry',
        requestTypeFilter: ['RUN_TESTS_SYNCHRONOUS', 'EXECUTE_ANONYMOUS', 'RUN_TESTS_SYNCHRONOUS'],
        workspaceSettings: {
          proxyUrl: 'http://localhost:443',
          proxyStrictSSL: false,
          proxyAuth: 'Basic 123',
          connectionTimeoutMs: 2000
        } as WorkspaceSettings,
        lineBreakpointInfo: lineBpInfo
      };
    });

    it('Should launch successfully (interactive debugger)', async () => {
      const sessionId = '07aFAKE';
      configGetSpy.mockResolvedValue({
        getPropertyValue: (key: string) => (key === 'target-org' ? 'test-org' : undefined)
      } as any);
      sessionStartSpy = jest.spyOn(SessionService.prototype, 'start').mockResolvedValue(sessionId);
      jest.spyOn(SessionService.prototype, 'isConnected').mockReturnValue(true);
      jest.spyOn(StreamingService.prototype, 'subscribe').mockResolvedValue(true);
      jest.spyOn(BreakpointService.prototype, 'hasLineNumberMapping').mockReturnValue(true);

      await adapter.launchRequest(initializedResponse, args);

      expect(sessionStartSpy).toHaveBeenCalledTimes(1);
      expect(adapter.getResponse(0).success).toBe(true);
      expect(adapter.getEvents()[0].event).toBe('sendMetric'); // launch Apex debugger
      expect(adapter.getEvents()[1].event).toBe('output');
      expect((adapter.getEvents()[1] as OutputEvent).body.output).toContain(
        nls.localize('session_started_text', sessionId)
      );
      expect(adapter.getEvents()[2].event).toBe('sendMetric'); // interactive debugger started successfully
      expect(adapter.getEvents()[3].event).toBe('initialized');
      expect(sessionUserFilterSpy).toHaveBeenCalledTimes(1);
      expect(sessionEntryFilterSpy).toHaveBeenCalledTimes(1);
      expect(sessionRequestFilterSpy).toHaveBeenCalledTimes(1);
      expect(sessionUserFilterSpy).toHaveBeenCalledWith('005FAKE1,005FAKE2');
      expect(sessionEntryFilterSpy).toHaveBeenCalledWith('entry');
      expect(sessionRequestFilterSpy).toHaveBeenCalledWith('RUN_TESTS_SYNCHRONOUS,EXECUTE_ANONYMOUS');
      expect(resetIdleTimersSpy).toHaveBeenCalledTimes(1);
    });

    it('Should not launch if ApexDebuggerSession object is not accessible', async () => {
      const rejectionReason =
        '{"message":"entity type cannot be inserted: Apex Debugger Session", "action":"Try again"}';
      configGetSpy.mockResolvedValue({
        getPropertyValue: (key: string) => (key === 'target-org' ? 'test-org' : undefined)
      } as any);
      sessionStartSpy = jest.spyOn(SessionService.prototype, 'start').mockRejectedValue(rejectionReason);
      jest.spyOn(SessionService.prototype, 'isConnected').mockReturnValue(false);
      jest.spyOn(StreamingService.prototype, 'subscribe').mockResolvedValue(true);
      jest.spyOn(BreakpointService.prototype, 'hasLineNumberMapping').mockReturnValue(true);

      await adapter.launchRequest(initializedResponse, args);

      expect(sessionStartSpy).toHaveBeenCalledTimes(1);
      expect(adapter.getResponse(0).success).toBe(false);
      expect(adapter.getResponse(0).message).toBe(nls.localize('session_no_entity_access_text'));
      expect(adapter.getEvents()[0].event).toBe('sendMetric'); // launch Apex debugger
      expect(adapter.getEvents()[1].event).toBe('output');
      expect((adapter.getEvents()[1] as OutputEvent).body.output).toContain('Try again');
      expect(resetIdleTimersSpy).not.toHaveBeenCalled();
    });

    it('Should not launch if streaming service errors out', async () => {
      const sessionId = '07aFAKE';
      sessionStartSpy = jest.spyOn(SessionService.prototype, 'start').mockResolvedValue(sessionId);
      jest.spyOn(SessionService.prototype, 'isConnected').mockReturnValue(true);
      jest.spyOn(StreamingService.prototype, 'subscribe').mockResolvedValue(false);
      jest.spyOn(BreakpointService.prototype, 'hasLineNumberMapping').mockReturnValue(true);

      await adapter.launchRequest(initializedResponse, args);

      expect(sessionStartSpy).not.toHaveBeenCalled();
      expect(adapter.getResponse(0).success).toBe(false);
      expect(adapter.getEvents().length).toBe(1); // value is 1 because the Launch Apex Debugger button is clicked
      expect(resetIdleTimersSpy).not.toHaveBeenCalled();
    });

    it('Should not launch without line number mapping', async () => {
      sessionStartSpy = jest.spyOn(SessionService.prototype, 'start').mockResolvedValue('' as any);
      jest.spyOn(SessionService.prototype, 'isConnected').mockReturnValue(false);
      jest.spyOn(StreamingService.prototype, 'subscribe').mockResolvedValue(false);
      jest.spyOn(BreakpointService.prototype, 'hasLineNumberMapping').mockReturnValue(false);

      await adapter.launchRequest(initializedResponse, args);
      expect(sessionStartSpy).not.toHaveBeenCalled();
      expect(adapter.getResponse(0).success).toBe(false);
      expect(adapter.getResponse(0).message).toBe(nls.localize('session_language_server_error_text'));
      expect(adapter.getEvents().length).toBe(1); // value is 1 because the Launch Apex Debugger button is clicked
      expect(resetIdleTimersSpy).not.toHaveBeenCalled();
    });

    it('Should launch successfully for ISV project (ISV debugger)', async () => {
      const sessionId = '07aFAKE';
      sessionStartSpy = jest.spyOn(SessionService.prototype, 'start').mockResolvedValue(sessionId);
      jest.spyOn(SessionService.prototype, 'isConnected').mockReturnValue(true);
      jest.spyOn(StreamingService.prototype, 'subscribe').mockResolvedValue(true);
      jest.spyOn(BreakpointService.prototype, 'hasLineNumberMapping').mockReturnValue(true);

      args.connectType = 'ISV_DEBUGGER';
      const config = new Map<string, string>([
        ['org-isv-debugger-sid', '123'],
        ['org-isv-debugger-url', 'instanceurl']
      ]);
      configGetSpy.mockResolvedValue({
        getPropertyValue: (key: string) => config.get(key)
      } as any);

      await adapter.launchRequest(initializedResponse, args);

      expect(adapter.getRequestService().accessToken).toBe('123');
      expect(adapter.getRequestService().instanceUrl).toBe('instanceurl');

      expect(sessionStartSpy).toHaveBeenCalledTimes(1);
      expect(adapter.getResponse(0).success).toBe(true);
      expect(adapter.getEvents()[0].event).toBe('sendMetric'); // launch Apex debugger
      expect(adapter.getEvents()[1].event).toBe('output');
      expect((adapter.getEvents()[1] as OutputEvent).body.output).toContain(
        nls.localize('session_started_text', sessionId)
      );
      expect(adapter.getEvents()[2].event).toBe('sendMetric'); // ISV debugger started successfully
      expect(adapter.getEvents()[3].event).toBe('initialized');
      expect(sessionUserFilterSpy).toHaveBeenCalledTimes(1);
      expect(sessionEntryFilterSpy).toHaveBeenCalledTimes(1);
      expect(sessionRequestFilterSpy).toHaveBeenCalledTimes(1);
      expect(sessionUserFilterSpy).toHaveBeenCalledWith('005FAKE1,005FAKE2');
      expect(sessionEntryFilterSpy).toHaveBeenCalledWith('entry');
      expect(sessionRequestFilterSpy).toHaveBeenCalledWith('RUN_TESTS_SYNCHRONOUS,EXECUTE_ANONYMOUS');
      expect(resetIdleTimersSpy).toHaveBeenCalledTimes(1);
    });

    it('Should popup error message when org-isv-debugger-sid and/or org-isv-debugger-url config variables are not set (ISV debugger)', async () => {
      const sessionId = '07aFAKE';
      sessionStartSpy = jest.spyOn(SessionService.prototype, 'start').mockResolvedValue(sessionId);
      jest.spyOn(SessionService.prototype, 'isConnected').mockReturnValue(true);
      jest.spyOn(StreamingService.prototype, 'subscribe').mockResolvedValue(true);
      jest.spyOn(BreakpointService.prototype, 'hasLineNumberMapping').mockReturnValue(true);

      args.connectType = 'ISV_DEBUGGER';
      const config = new Map<string, string>([
        ['nonexistent-sid', '123'],
        ['nonexistent-url', 'instanceurl']
      ]);
      configGetSpy.mockResolvedValue({
        getPropertyValue: (key: string) => config.get(key)
      } as any);

      await adapter.launchRequest(initializedResponse, args);

      expect(adapter.getRequestService().accessToken).toBeUndefined();
      expect(adapter.getRequestService().instanceUrl).toBeUndefined();

      expect(sessionStartSpy).not.toHaveBeenCalled(); // false because the session doesn't start if the error message pops up
      expect(adapter.getResponse(0).success).toBe(false);
      expect(adapter.getResponse(0).message).toBe(nls.localize('invalid_isv_project_config'));
      expect(adapter.getEvents()[0].event).toBe('sendMetric'); // launch Apex debugger
      expect(adapter.getEvents()[1].event).toBe('sendMetric'); // ISV debugger failed to launch because nonexistent config variables were set

      expect(resetIdleTimersSpy).not.toHaveBeenCalled();
    });

    // Testing an expired forceIde:// URL would require StreamingClient to invoke subscribeReject(), which is not feasible in Jest. Therefore, the test for the expired session is indistinguishable from the success case.

    // The test case for org-isv-debugger-url config variable set to the wrong value cannot be realized by Jest because Jest cannot validate whether the org-isv-debugger-sid and org-isv-debugger-url config variables are set to the correct values. Therefore, Jest cannot distinguish this case from the case where ISV Debugger starts successfully.

    it('Should configure tracing with boolean', async () => {
      const sessionId = '07aFAKE';
      sessionPrintToDebugSpy = jest.spyOn(ApexDebugForTest.prototype, 'printToDebugConsole').mockImplementation(() => {});
      sessionStartSpy = jest.spyOn(SessionService.prototype, 'start').mockResolvedValue(sessionId);
      jest.spyOn(SessionService.prototype, 'isConnected').mockReturnValue(true);
      jest.spyOn(StreamingService.prototype, 'subscribe').mockResolvedValue(true);
      jest.spyOn(BreakpointService.prototype, 'hasLineNumberMapping').mockReturnValue(true);

      // given
      args.trace = true;
      await adapter.launchRequest(initializedResponse, args);
      sessionPrintToDebugSpy.mockClear();

      // when
      adapter.log('variables', 'message');

      // then
      expect(sessionPrintToDebugSpy).toHaveBeenCalledTimes(1);
    });

    it('Should not do any tracing by default', async () => {
      const sessionId = '07aFAKE';
      sessionPrintToDebugSpy = jest.spyOn(ApexDebugForTest.prototype, 'printToDebugConsole').mockImplementation(() => {});
      sessionStartSpy = jest.spyOn(SessionService.prototype, 'start').mockResolvedValue(sessionId);
      jest.spyOn(SessionService.prototype, 'isConnected').mockReturnValue(true);
      jest.spyOn(StreamingService.prototype, 'subscribe').mockResolvedValue(true);
      jest.spyOn(BreakpointService.prototype, 'hasLineNumberMapping').mockReturnValue(true);

      // given
      await adapter.launchRequest(initializedResponse, args);
      sessionPrintToDebugSpy.mockClear();

      // when
      adapter.log('variables', 'message');

      // then
      expect(sessionPrintToDebugSpy).toHaveBeenCalledTimes(0);
    });

    it('Should configure tracing for specific category only', async () => {
      const sessionId = '07aFAKE';
      sessionPrintToDebugSpy = jest.spyOn(ApexDebugForTest.prototype, 'printToDebugConsole').mockImplementation(() => {});
      sessionStartSpy = jest.spyOn(SessionService.prototype, 'start').mockResolvedValue(sessionId);
      jest.spyOn(SessionService.prototype, 'isConnected').mockReturnValue(true);
      jest.spyOn(StreamingService.prototype, 'subscribe').mockResolvedValue(true);
      jest.spyOn(BreakpointService.prototype, 'hasLineNumberMapping').mockReturnValue(true);

      // given
      args.trace = 'variables, launch, protocol';
      await adapter.launchRequest(initializedResponse, args);
      sessionPrintToDebugSpy.mockClear();

      // when
      adapter.log('variables', 'message');
      adapter.log('launch', 'message');
      adapter.log('protocol', 'message');

      // then
      expect(sessionPrintToDebugSpy).toHaveBeenCalledTimes(3);
    });

    it('Should configure tracing for all categories', async () => {
      const sessionId = '07aFAKE';
      sessionPrintToDebugSpy = jest.spyOn(ApexDebugForTest.prototype, 'printToDebugConsole').mockImplementation(() => {});
      sessionStartSpy = jest.spyOn(SessionService.prototype, 'start').mockResolvedValue(sessionId);
      jest.spyOn(SessionService.prototype, 'isConnected').mockReturnValue(true);
      jest.spyOn(StreamingService.prototype, 'subscribe').mockResolvedValue(true);
      jest.spyOn(BreakpointService.prototype, 'hasLineNumberMapping').mockReturnValue(true);

      // given
      args.trace = 'all';
      await adapter.launchRequest(initializedResponse, args);
      sessionPrintToDebugSpy.mockClear();

      // when
      adapter.log('variables', 'message');
      adapter.log('launch', 'message');
      adapter.log('protocol', 'message');

      // then
      expect(sessionPrintToDebugSpy).toHaveBeenCalledTimes(3);
    });

    it('Should return empty string with null launch array', () => {
      expect(adapter.toCommaSeparatedString()).toBe('');
    });

    it('Should return empty string with empty launch array', () => {
      expect(adapter.toCommaSeparatedString([])).toBe('');
    });
  });

  describe('Workspace settings', () => {
    let configGetSpy: jest.SpyInstance;
    let orgCreateSpy: jest.SpyInstance;

    let requestService: RequestService;
    let args: LaunchRequestArguments;
    const lineBpInfo: LineBreakpointInfo[] = [
      {
        uri: 'classA',
        typeref: 'StaticVarsA',
        lines: [9, 10, 13]
      }
    ];

    beforeEach(() => {
      requestService = new RequestService();
      adapter = new ApexDebugForTest(requestService);
      configGetSpy = jest.spyOn(ConfigAggregator, 'create').mockResolvedValue({
        getPropertyValue: () => undefined
      } as any);
      orgCreateSpy = jest.spyOn(Org, 'create').mockResolvedValue({
        getConnection: () => ({
          instanceUrl: 'https://test.salesforce.com',
          accessToken: 'test-token'
        })
      } as any);
    });

    it('Should save proxy settings', async () => {
      const sessionId = '07aFAKE';
      configGetSpy.mockResolvedValue({
        getPropertyValue: (key: string) => (key === 'target-org' ? 'test-org' : undefined)
      } as any);
      orgCreateSpy.mockResolvedValue({
        getConnection: () => ({
          instanceUrl: 'https://na15.salesforce.com',
          accessToken: '00DxxFaK3T0ken'
        })
      } as any);
      jest.spyOn(SessionService.prototype, 'start').mockResolvedValue(sessionId);
      jest.spyOn(SessionService.prototype, 'isConnected').mockReturnValue(true);
      jest.spyOn(StreamingService.prototype, 'subscribe').mockResolvedValue(true);
      jest.spyOn(BreakpointService.prototype, 'hasLineNumberMapping').mockReturnValue(true);

      args = {
        salesforceProject: 'some/project/path',
        workspaceSettings: {
          proxyUrl: 'http://localhost:443',
          proxyStrictSSL: false,
          proxyAuth: 'Basic 123'
        } as WorkspaceSettings,
        lineBreakpointInfo: lineBpInfo
      };

      await adapter.launchRequest(initializedResponse, args);

      expect(requestService.proxyUrl).toBe('http://localhost:443');
      expect(requestService.proxyStrictSSL).toBe(false);
      expect(requestService.proxyAuthorization).toBe('Basic 123');
      expect(requestService.connectionTimeoutMs).toBe(DEFAULT_CONNECTION_TIMEOUT_MS);
      expect(requestService.instanceUrl).toBe('https://na15.salesforce.com');
      expect(requestService.accessToken).toBe('00DxxFaK3T0ken');
    });

    it(
      'Should save connection settings',
      async () => {
        configGetSpy.mockResolvedValue({
          getPropertyValue: (key: string) => (key === 'target-org' ? 'test-org' : undefined)
        } as any);
        args = {
          salesforceProject: 'some/project/path',
          workspaceSettings: {
            connectionTimeoutMs: 60_000
          } as WorkspaceSettings,
          lineBreakpointInfo: lineBpInfo
        };

        await adapter.launchRequest(initializedResponse, args);

        expect(requestService.proxyUrl).toBeUndefined();
        expect(requestService.proxyStrictSSL).toBeUndefined();
        expect(requestService.proxyAuthorization).toBeUndefined();
        expect(requestService.connectionTimeoutMs).toBe(60_000);
      },
      60_000
    );
  });

  describe('Line breakpoint info', () => {
    let args: LaunchRequestArguments;
    let setValidLinesSpy: jest.SpyInstance;
    let configGetSpy: jest.SpyInstance;

    beforeEach(() => {
      adapter.initializeReq(initializedResponse, {} as DebugProtocol.InitializeRequestArguments);
      configGetSpy = jest.spyOn(ConfigAggregator, 'create').mockResolvedValue({
        getPropertyValue: () => undefined
      } as any);
      jest.spyOn(Org, 'create').mockResolvedValue({
        getConnection: () => ({
          instanceUrl: 'https://test.salesforce.com',
          accessToken: 'test-token'
        })
      } as any);
      setValidLinesSpy = jest.spyOn(BreakpointService.prototype, 'setValidLines');
      jest.spyOn(SessionService.prototype, 'start').mockResolvedValue('07aFAKE');
      jest.spyOn(SessionService.prototype, 'isConnected').mockReturnValue(true);
      jest.spyOn(StreamingService.prototype, 'subscribe').mockResolvedValue(true);
    });

    it('Should not save line number mapping', async () => {
      args = {
        salesforceProject: 'some/project/path',
        workspaceSettings: {
          proxyUrl: 'http://localhost:443',
          proxyStrictSSL: false,
          proxyAuth: 'Basic 123'
        } as WorkspaceSettings
      };

      await adapter.launchRequest(initializedResponse, args);

      expect(setValidLinesSpy).not.toHaveBeenCalled();
      expect(adapter.getResponse(0).success).toBe(false);
      expect(adapter.getResponse(0).message).toBe(nls.localize('session_language_server_error_text'));
    });

    it('Should save line number mapping', async () => {
      configGetSpy.mockResolvedValue({
        getPropertyValue: (key: string) => (key === 'target-org' ? 'test-org' : undefined)
      } as any);
      const info: LineBreakpointInfo[] = [
        { uri: 'file:///foo.cls', typeref: 'foo', lines: [1, 2, 3] },
        { uri: 'file:///foo.cls', typeref: 'foo$inner', lines: [4, 5, 6] },
        { uri: 'file:///bar.cls', typeref: 'bar', lines: [1, 2, 3] },
        { uri: 'file:///bar.cls', typeref: 'bar$inner', lines: [4, 5, 6] }
      ];
      const expectedLineNumberMapping: Map<string, LineBreakpointsInTyperef[]> = new Map();
      const expectedTyperefMapping: Map<string, string> = new Map();
      expectedLineNumberMapping.set('file:///foo.cls', [
        { typeref: 'foo', lines: [1, 2, 3] },
        { typeref: 'foo$inner', lines: [4, 5, 6] }
      ]);
      expectedLineNumberMapping.set('file:///bar.cls', [
        { typeref: 'bar', lines: [1, 2, 3] },
        { typeref: 'bar$inner', lines: [4, 5, 6] }
      ]);
      expectedTyperefMapping.set('foo', 'file:///foo.cls');
      expectedTyperefMapping.set('foo$inner', 'file:///foo.cls');
      expectedTyperefMapping.set('bar', 'file:///bar.cls');
      expectedTyperefMapping.set('bar$inner', 'file:///bar.cls');

      args.lineBreakpointInfo = info;
      await adapter.launchRequest(initializedResponse, args);

      expect(setValidLinesSpy).toHaveBeenCalledTimes(1);
      expect(setValidLinesSpy).toHaveBeenCalledWith(expectedLineNumberMapping, expectedTyperefMapping);
      expect(adapter.getResponse(0)).toEqual(initializedResponse);
      expect(adapter.getResponse(1).success).toBe(true);
    });
  });

  describe('Idle session', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('Should clear idle timers', () => {
      adapter.getIdleTimers().push(
        setTimeout(() => {
          // Do nothing
        }, 10_000)
      );

      adapter.clearIdleTimers();

      expect(adapter.getIdleTimers().length).toBe(0);
    });

    it('Should create idle timers', () => {
      adapter.resetIdleTimer();

      setTimeout(() => {
        expect(adapter.getEvents()[0].event).toBe('output');
        expect((adapter.getEvents()[0] as OutputEvent).body.output).toContain(
          nls.localize(
            'idle_warn_text',
            DEFAULT_IDLE_WARN1_MS / 60_000,
            (DEFAULT_IDLE_TIMEOUT_MS - DEFAULT_IDLE_WARN1_MS) / 60_000
          )
        );
      }, DEFAULT_IDLE_WARN1_MS);
      jest.advanceTimersByTime(DEFAULT_IDLE_WARN1_MS + 1);

      setTimeout(() => {
        expect(adapter.getEvents()[1].event).toBe('output');
        expect((adapter.getEvents()[1] as OutputEvent).body.output).toContain(
          nls.localize(
            'idle_warn_text',
            DEFAULT_IDLE_WARN2_MS / 60_000,
            (DEFAULT_IDLE_TIMEOUT_MS - DEFAULT_IDLE_WARN2_MS) / 60_000
          )
        );
      }, DEFAULT_IDLE_WARN2_MS);
      jest.advanceTimersByTime(DEFAULT_IDLE_WARN2_MS + 1);

      setTimeout(() => {
        expect(adapter.getEvents()[2].event).toBe('output');
        expect((adapter.getEvents()[2] as OutputEvent).body.output).toContain(
          nls.localize(
            'idle_warn_text',
            DEFAULT_IDLE_WARN3_MS / 60_000,
            (DEFAULT_IDLE_TIMEOUT_MS - DEFAULT_IDLE_WARN3_MS) / 60_000
          )
        );
      }, DEFAULT_IDLE_WARN3_MS);
      jest.advanceTimersByTime(DEFAULT_IDLE_WARN3_MS + 1);

      setTimeout(() => {
        expect(adapter.getEvents()[3].event).toBe('output');
        expect((adapter.getEvents()[3] as OutputEvent).body.output).toContain(
          nls.localize('idle_terminated_text', DEFAULT_IDLE_TIMEOUT_MS / 60_000)
        );
        expect(adapter.getEvents()[4].event).toBe('terminated');
      }, DEFAULT_IDLE_TIMEOUT_MS);
      jest.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS + 1);
    });
  });

  describe('Disconnect', () => {
    let sessionStopSpy: jest.SpyInstance;
    let streamingDisconnectSpy: jest.SpyInstance;
    let clearIdleTimersSpy: jest.SpyInstance;
    let response: DebugProtocol.DisconnectResponse;
    let args: DebugProtocol.DisconnectArguments;

    beforeEach(() => {
      streamingDisconnectSpy = jest.spyOn(StreamingService.prototype, 'disconnect').mockImplementation(() => {});
      clearIdleTimersSpy = jest.spyOn(ApexDebugForTest.prototype, 'clearIdleTimers');
      response = {
        command: '',
        success: true,
        request_seq: 0,
        seq: 0,
        type: 'response'
      };
      args = {};
    });

    it('Should not use session service if not connected', async () => {
      jest.spyOn(SessionService.prototype, 'isConnected').mockReturnValue(false);

      await adapter.disconnectReq(response, args);

      expect(adapter.getResponse(0)).toEqual(response);
      expect(streamingDisconnectSpy).toHaveBeenCalledTimes(1);
      expect(clearIdleTimersSpy).toHaveBeenCalledTimes(1);
    });

    it('Should try to disconnect and stop', async () => {
      const sessionId = '07aFAKE';
      sessionStopSpy = jest.spyOn(SessionService.prototype, 'stop').mockResolvedValue(sessionId);
      jest.spyOn(SessionService.prototype, 'isConnected')
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      await adapter.disconnectReq(response, args);

      expect(sessionStopSpy).toHaveBeenCalledTimes(1);
      expect(adapter.getResponse(0)).toEqual(response);
      expect((adapter.getEvents()[0] as OutputEvent).body.output).toContain(
        nls.localize('session_terminated_text', sessionId)
      );
      expect(streamingDisconnectSpy).toHaveBeenCalledTimes(1);
      expect(clearIdleTimersSpy).toHaveBeenCalledTimes(1);
    });

    it('Should try to disconnect and not stop', async () => {
      sessionStopSpy = jest
        .spyOn(SessionService.prototype, 'stop')
        .mockRejectedValue('{"message":"There was an error", "action":"Try again"}');
      jest.spyOn(SessionService.prototype, 'isConnected')
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true);

      await adapter.disconnectReq(response, args);

      expect(sessionStopSpy).toHaveBeenCalledTimes(1);
      expect(adapter.getResponse(0).success).toBe(false);
      expect(adapter.getResponse(0).message).toBe('There was an error');
      expect(adapter.getEvents()[0].event).toBe('output');
      expect((adapter.getEvents()[0] as OutputEvent).body.output).toContain('Try again');
      expect(streamingDisconnectSpy).toHaveBeenCalledTimes(1);
      expect(clearIdleTimersSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Line breakpoint request', () => {
    let breakpointReconcileSpy: jest.SpyInstance;
    let breakpointGetSpy: jest.SpyInstance;
    let breakpointGetTyperefSpy: jest.SpyInstance;
    let breakpointCreateSpy: jest.SpyInstance;
    let breakpointCacheSpy: jest.SpyInstance;
    let lockSpy: jest.SpyInstance;

    beforeEach(() => {
      breakpointGetSpy = jest.spyOn(BreakpointService.prototype, 'getBreakpointsFor');
      breakpointGetTyperefSpy = jest.spyOn(BreakpointService.prototype, 'getTyperefFor');
      breakpointCreateSpy = jest.spyOn(BreakpointService.prototype, 'createLineBreakpoint');
      breakpointCacheSpy = jest.spyOn(BreakpointService.prototype, 'cacheLineBreakpoint');
      jest.spyOn(SessionService.prototype, 'getSessionId').mockReturnValue('07aFAKE');
      lockSpy = jest.spyOn(AsyncLock.prototype, 'acquire');
    });

    it('Should create breakpoint', async () => {
      const bpLines = [1, 2];
      breakpointReconcileSpy = jest
        .spyOn(BreakpointService.prototype, 'reconcileLineBreakpoints')
        .mockResolvedValue(new Set<number>([1]));
      adapter.setSalesforceProject('someProjectPath');

      await adapter.setBreakPointsReq({} as DebugProtocol.SetBreakpointsResponse, {
        source: {
          path: 'foo.cls'
        },
        lines: bpLines
      });

      expect(lockSpy).toHaveBeenCalledTimes(1);
      expect(lockSpy.mock.calls[0][0]).toBe('breakpoint-file:///foo.cls');
      expect(breakpointReconcileSpy).toHaveBeenCalledTimes(1);
      expect(breakpointReconcileSpy).toHaveBeenCalledWith('someProjectPath', 'file:///foo.cls', '07aFAKE', bpLines);
      expect(breakpointGetSpy).not.toHaveBeenCalled();
      expect(breakpointGetTyperefSpy).not.toHaveBeenCalled();
      expect(breakpointCreateSpy).not.toHaveBeenCalled();
      expect(breakpointCacheSpy).not.toHaveBeenCalled();

      const expectedResp = {
        success: true,
        body: {
          breakpoints: [
            {
              verified: true,
              source: {
                path: 'foo.cls'
              },
              line: 1
            },
            {
              verified: false,
              source: {
                path: 'foo.cls'
              },
              line: 2
            }
          ]
        }
      } as DebugProtocol.SetBreakpointsResponse;
      expect(adapter.getResponse(0)).toEqual(expectedResp);
    });

    it('Should not create breakpoint without source argument', async () => {
      const bpLines = [1, 2];
      breakpointReconcileSpy = jest
        .spyOn(BreakpointService.prototype, 'reconcileLineBreakpoints')
        .mockResolvedValue(bpLines as any);
      adapter.setSalesforceProject('someProjectPath');

      await adapter.setBreakPointsReq({} as DebugProtocol.SetBreakpointsResponse, {
        source: {
          path: undefined
        },
        lines: bpLines
      });

      expect(breakpointReconcileSpy).not.toHaveBeenCalled();
      expect(breakpointGetTyperefSpy).not.toHaveBeenCalled();
      expect(breakpointCreateSpy).not.toHaveBeenCalled();
      expect(breakpointCacheSpy).not.toHaveBeenCalled();

      const expectedResp = {
        success: true
      } as DebugProtocol.SetBreakpointsResponse;
      expect(adapter.getResponse(0)).toEqual(expectedResp);
    });

    it('Should not create breakpoint without lines argument', async () => {
      const bpLines = [1, 2];
      breakpointReconcileSpy = jest
        .spyOn(BreakpointService.prototype, 'reconcileLineBreakpoints')
        .mockResolvedValue(bpLines as any);
      adapter.setSalesforceProject('someProjectPath');

      await adapter.setBreakPointsReq({} as DebugProtocol.SetBreakpointsResponse, {
        source: {
          path: 'foo.cls'
        },
        lines: undefined
      });

      expect(breakpointReconcileSpy).not.toHaveBeenCalled();
      expect(breakpointGetTyperefSpy).not.toHaveBeenCalled();
      expect(breakpointCreateSpy).not.toHaveBeenCalled();
      expect(breakpointCacheSpy).not.toHaveBeenCalled();

      const expectedResp = {
        success: true
      } as DebugProtocol.SetBreakpointsResponse;
      expect(adapter.getResponse(0)).toEqual(expectedResp);
    });
  });

  describe('Continue request', () => {
    let runSpy: jest.SpyInstance;

    beforeEach(() => {
      adapter.setSalesforceProject('someProjectPath');
      adapter.addRequestThread('07cFAKE');
    });

    it('Should continue successfully', async () => {
      runSpy = jest.spyOn(RequestService.prototype, 'execute').mockResolvedValue('');

      await adapter.continueReq(
        {} as DebugProtocol.ContinueResponse,
        { threadId: 1 } as DebugProtocol.ContinueArguments
      );

      expect(adapter.getResponse(0).success).toBe(true);
      expect(adapter.getResponse(0).body.allThreadsContinued).toBe(false);
      expect(runSpy).toHaveBeenCalledTimes(1);
      expect(runSpy.mock.calls[0][0]).toBeInstanceOf(RunCommand);
    });

    it('Should not continue unknown thread', async () => {
      runSpy = jest.spyOn(RequestService.prototype, 'execute').mockResolvedValue('');

      await adapter.continueReq(
        {} as DebugProtocol.ContinueResponse,
        { threadId: 2 } as DebugProtocol.ContinueArguments
      );

      adapter.clearIdleTimers();
      expect(adapter.getResponse(0).success).toBe(false);
      expect(runSpy).not.toHaveBeenCalled();
    });

    it('Should handle run command error response', async () => {
      runSpy = jest
        .spyOn(RequestService.prototype, 'execute')
        .mockRejectedValue({ message: 'There was an error', action: 'Try again' });

      await adapter.continueReq(
        {} as DebugProtocol.ContinueResponse,
        { threadId: 1 } as DebugProtocol.ContinueArguments
      );

      expect(adapter.getResponse(0).success).toBe(false);
      expect(adapter.getResponse(0).message).toBe('There was an error');
      expect(runSpy).toHaveBeenCalled();
    });
  });

  describe('Stepping', () => {
    let stepSpy: jest.SpyInstance;

    beforeEach(() => {
      adapter.setSalesforceProject('someProjectPath');
      adapter.addRequestThread('07cFAKE');
    });

    it('Step into should call proper command', async () => {
      stepSpy = jest.spyOn(RequestService.prototype, 'execute').mockResolvedValue('');

      await adapter.stepInRequest({} as DebugProtocol.StepInResponse, { threadId: 1 } as DebugProtocol.StepInArguments);

      expect(adapter.getResponse(0).success).toBe(true);
      expect(stepSpy).toHaveBeenCalledTimes(1);
      expect(stepSpy.mock.calls[0][0]).toBeInstanceOf(StepIntoCommand);
    });

    it('Step out should send proper command', async () => {
      stepSpy = jest.spyOn(RequestService.prototype, 'execute').mockResolvedValue('');

      await adapter.stepOutRequest(
        {} as DebugProtocol.StepOutResponse,
        { threadId: 1 } as DebugProtocol.StepOutArguments
      );

      expect(adapter.getResponse(0).success).toBe(true);
      expect(stepSpy).toHaveBeenCalledTimes(1);
      expect(stepSpy.mock.calls[0][0]).toBeInstanceOf(StepOutCommand);
    });

    it('Step over should send proper command', async () => {
      stepSpy = jest.spyOn(RequestService.prototype, 'execute').mockResolvedValue('');

      await adapter.nextRequest({} as DebugProtocol.NextResponse, { threadId: 1 } as DebugProtocol.NextArguments);

      expect(adapter.getResponse(0).success).toBe(true);
      expect(stepSpy).toHaveBeenCalledTimes(1);
      expect(stepSpy.mock.calls[0][0]).toBeInstanceOf(StepOverCommand);
    });
  });

  describe('Threads request', () => {
    it('Should return known debugged requests', () => {
      adapter.addRequestThread('07cFAKE1');
      adapter.addRequestThread('07cFAKE2');

      adapter.threadsReq({} as DebugProtocol.ThreadsResponse);

      expect(adapter.getResponses().length).toBe(1);
      expect(adapter.getResponse(0).success).toBe(true);
      const response = adapter.getResponse(0) as DebugProtocol.ThreadsResponse;
      expect(response.body.threads).toEqual([
        { id: 1, name: 'Request ID: 07cFAKE1' },
        { id: 2, name: 'Request ID: 07cFAKE2' }
      ]);
    });

    it('Should not return any debugged requests', () => {
      adapter.threadsReq({} as DebugProtocol.ThreadsResponse);

      expect(adapter.getResponses().length).toBe(1);
      expect(adapter.getResponse(0).success).toBe(true);
      const response = adapter.getResponse(0) as DebugProtocol.ThreadsResponse;
      expect(response.body.threads.length).toBe(0);
    });
  });

  describe('Stacktrace request', () => {
    let stateSpy: jest.SpyInstance;
    let lockSpy: jest.SpyInstance;

    beforeEach(() => {
      adapter.setSalesforceProject('someProjectPath');
      adapter.addRequestThread('07cFAKE');
      lockSpy = jest.spyOn(AsyncLock.prototype, 'acquire');
    });

    it('Should not get state of unknown thread', async () => {
      stateSpy = jest.spyOn(RequestService.prototype, 'execute').mockResolvedValue('{}');

      await adapter.stackTraceRequest(
        {} as DebugProtocol.StackTraceResponse,
        { threadId: 2 } as DebugProtocol.StackTraceArguments
      );

      expect(adapter.getResponse(0).success).toBe(false);
      expect(stateSpy).not.toHaveBeenCalled();
    });

    it('Should return response with empty stackframes', async () => {
      stateSpy = jest
        .spyOn(RequestService.prototype, 'execute')
        .mockResolvedValue('{"stateResponse":{"state":{"stack":{"stackFrame":[]}}}}');

      await adapter.stackTraceRequest(
        {} as DebugProtocol.StackTraceResponse,
        { threadId: 1 } as DebugProtocol.StackTraceArguments
      );

      expect(stateSpy).toHaveBeenCalled();
      const response = adapter.getResponse(0) as DebugProtocol.StackTraceResponse;
      expect(response.success).toBe(true);
      expect(response.body.stackFrames.length).toBe(0);
    });

    it('Should process stack frame with local source', async () => {
      stateSpy = jest
        .spyOn(RequestService.prototype, 'execute')
        .mockResolvedValue(
          '{"stateResponse":{"state":{"stack":{"stackFrame":[{"typeRef":"FooDebug","fullName":"FooDebug.test()","lineNumber":1,"frameNumber":0},{"typeRef":"BarDebug","fullName":"BarDebug.test()","lineNumber":2,"frameNumber":1}]}}}}'
        );
      const fileUri = 'file:///foo.cls';
      jest.spyOn(BreakpointService.prototype, 'getSourcePathFromTyperef').mockReturnValue(fileUri);

      await adapter.stackTraceRequest(
        {} as DebugProtocol.StackTraceResponse,
        { threadId: 1 } as DebugProtocol.StackTraceArguments
      );

      expect(lockSpy).toHaveBeenCalledTimes(1);
      expect(lockSpy.mock.calls[0][0]).toBe('stacktrace');
      expect(stateSpy).toHaveBeenCalled();
      expect(stateSpy.mock.calls[0][0]).toBeInstanceOf(StateCommand);
      const response = adapter.getResponse(0) as DebugProtocol.StackTraceResponse;
      expect(response.success).toBe(true);
      const stackFrames = response.body.stackFrames;
      expect(stackFrames.length).toBe(2);
      expect(stackFrames[0]).toEqual(
        new StackFrame(1000, 'FooDebug.test()', new Source('foo.cls', URI.parse(fileUri).fsPath), 1, 0)
      );
      expect(stackFrames[1]).toEqual(
        new StackFrame(1001, 'BarDebug.test()', new Source('foo.cls', URI.parse(fileUri).fsPath), 2, 0)
      );
    });

    it('Should process stack frame with unknown source', async () => {
      stateSpy = jest
        .spyOn(RequestService.prototype, 'execute')
        .mockResolvedValue(
          '{"stateResponse":{"state":{"stack":{"stackFrame":[{"typeRef":"anon","fullName":"anon.execute()","lineNumber":2,"frameNumber":0}]}}}}'
        );

      await adapter.stackTraceRequest(
        {} as DebugProtocol.StackTraceResponse,
        { threadId: 1 } as DebugProtocol.StackTraceArguments
      );

      expect(stateSpy).toHaveBeenCalled();
      const response = adapter.getResponse(0) as DebugProtocol.StackTraceResponse;
      expect(response.success).toBe(true);
      const stackFrames = response.body.stackFrames;
      expect(stackFrames.length).toBe(1);
      expect(stackFrames[0]).toEqual(new StackFrame(1000, 'anon.execute()', undefined, 2, 0));
    });

    it('Should handle state command error response', async () => {
      stateSpy = jest
        .spyOn(RequestService.prototype, 'execute')
        .mockRejectedValue({ message: 'There was an error', action: 'Try again' });

      await adapter.stackTraceRequest(
        {} as DebugProtocol.StackTraceResponse,
        { threadId: 1 } as DebugProtocol.StackTraceArguments
      );

      expect(adapter.getResponse(0).success).toBe(false);
      expect(adapter.getResponse(0).message).toBe('There was an error');
      expect(stateSpy).toHaveBeenCalled();
    });
  });

  describe('Custom request', () => {
    describe('Hotswap warning', () => {
      it('Should log warning to debug console', async () => {
        await adapter.customRequest(HOTSWAP_REQUEST, {} as DebugProtocol.Response, undefined);

        expect(adapter.getEvents().length).toBe(1);
        expect(adapter.getEvents()[0].event).toBe('output');
        const outputEvent = adapter.getEvents()[0] as DebugProtocol.OutputEvent;
        expect(outputEvent.body.output).toContain(nls.localize('hotswap_warn_text'));
        expect(outputEvent.body.category).toBe('console');
      });
    });

    describe('Exception breakpoint request', () => {
      let lockSpy: jest.SpyInstance;
      let reconcileExceptionBreakpointSpy: jest.SpyInstance;

      beforeEach(() => {
        adapter.setSalesforceProject('someProjectPath');
        lockSpy = jest.spyOn(AsyncLock.prototype, 'acquire');
        reconcileExceptionBreakpointSpy = jest
          .spyOn(BreakpointService.prototype, 'reconcileExceptionBreakpoints')
          .mockResolvedValue(undefined as any);
        jest.spyOn(SessionService.prototype, 'getSessionId').mockReturnValue('07aFAKE');
      });

      it('Should create exception breakpoint', async () => {
        const requestArg = {
          exceptionInfo: {
            typeref: 'fooexception',
            label: 'fooexception',
            breakMode: EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS,
            uri: 'file:///fooexception.cls'
          }
        } as SetExceptionBreakpointsArguments;
        await adapter.customRequest(EXCEPTION_BREAKPOINT_REQUEST, {} as DebugProtocol.Response, requestArg);

        expect(lockSpy).toHaveBeenCalledTimes(1);
        expect(lockSpy.mock.calls[0][0]).toBe('exception-breakpoint');
        expect(reconcileExceptionBreakpointSpy).toHaveBeenCalledTimes(1);
        expect(reconcileExceptionBreakpointSpy.mock.calls[0].length).toBe(3);
        expect(reconcileExceptionBreakpointSpy.mock.calls[0][0]).toBe('someProjectPath');
        expect(reconcileExceptionBreakpointSpy.mock.calls[0][1]).toBe('07aFAKE');
        expect(reconcileExceptionBreakpointSpy.mock.calls[0][2]).toEqual(requestArg.exceptionInfo);
        expect(adapter.getEvents()[0].event).toBe('output');
        expect((adapter.getEvents()[0] as OutputEvent).body.output).toContain(
          nls.localize('created_exception_breakpoint_text', 'fooexception')
        );
      });

      it('Should remove exception breakpoint', async () => {
        const requestArg = {
          exceptionInfo: {
            typeref: 'fooexception',
            label: 'fooexception',
            breakMode: EXCEPTION_BREAKPOINT_BREAK_MODE_NEVER,
            uri: 'file:///fooexception.cls'
          }
        } as SetExceptionBreakpointsArguments;

        await adapter.customRequest(EXCEPTION_BREAKPOINT_REQUEST, {} as DebugProtocol.Response, requestArg);

        expect(lockSpy).toHaveBeenCalledTimes(1);
        expect(lockSpy.mock.calls[0][0]).toBe('exception-breakpoint');
        expect(reconcileExceptionBreakpointSpy).toHaveBeenCalledTimes(1);
        expect(reconcileExceptionBreakpointSpy.mock.calls[0].length).toBe(3);
        expect(reconcileExceptionBreakpointSpy.mock.calls[0][0]).toBe('someProjectPath');
        expect(reconcileExceptionBreakpointSpy.mock.calls[0][1]).toBe('07aFAKE');
        expect(reconcileExceptionBreakpointSpy.mock.calls[0][2]).toEqual(requestArg.exceptionInfo);
        expect(adapter.getEvents()[0].event).toBe('output');
        expect((adapter.getEvents()[0] as OutputEvent).body.output).toContain(
          nls.localize('removed_exception_breakpoint_text', 'fooexception')
        );
      });

      it('Should ignore unknown break mode', async () => {
        const requestArg = {
          exceptionInfo: {
            typeref: 'fooexception',
            label: 'fooexception',
            breakMode: 'unhandled',
            uri: 'file:///fooexception.cls'
          }
        } as SetExceptionBreakpointsArguments;

        await adapter.customRequest(EXCEPTION_BREAKPOINT_REQUEST, {} as DebugProtocol.Response, requestArg);

        expect(lockSpy).toHaveBeenCalledTimes(1);
        expect(lockSpy.mock.calls[0][0]).toBe('exception-breakpoint');
        expect(reconcileExceptionBreakpointSpy).toHaveBeenCalledTimes(1);
        expect(reconcileExceptionBreakpointSpy.mock.calls[0].length).toBe(3);
        expect(reconcileExceptionBreakpointSpy.mock.calls[0][0]).toBe('someProjectPath');
        expect(reconcileExceptionBreakpointSpy.mock.calls[0][1]).toBe('07aFAKE');
        expect(reconcileExceptionBreakpointSpy.mock.calls[0][2]).toEqual(requestArg.exceptionInfo);
        expect(adapter.getEvents().length).toBe(0);
      });

      it('Should not call breakpoint service with undefined request args', async () => {
        await adapter.customRequest(EXCEPTION_BREAKPOINT_REQUEST, {} as DebugProtocol.Response, undefined);

        expect(lockSpy).not.toHaveBeenCalled();
        expect(reconcileExceptionBreakpointSpy).not.toHaveBeenCalled();
      });

      it('Should not call breakpoint service with undefined exception info', async () => {
        await adapter.customRequest(
          EXCEPTION_BREAKPOINT_REQUEST,
          {} as DebugProtocol.Response,
          {} as SetExceptionBreakpointsArguments
        );

        expect(lockSpy).not.toHaveBeenCalled();
        expect(reconcileExceptionBreakpointSpy).not.toHaveBeenCalled();
      });
    });

    describe('List exception breakpoints', () => {
      let getExceptionBreakpointCacheSpy: jest.SpyInstance;
      const knownExceptionBreakpoints: Map<string, string> = new Map([
        ['fooexception', '07bFAKE1'],
        ['barexception', '07bFAKE2']
      ]);

      beforeEach(() => {
        getExceptionBreakpointCacheSpy = jest
          .spyOn(BreakpointService.prototype, 'getExceptionBreakpointCache')
          .mockReturnValue(knownExceptionBreakpoints);
      });

      it('Should return list of breakpoint typerefs', async () => {
        await adapter.customRequest(LIST_EXCEPTION_BREAKPOINTS_REQUEST, {} as DebugProtocol.Response, undefined);

        expect(getExceptionBreakpointCacheSpy).toHaveBeenCalledTimes(1);
        expect(adapter.getResponse(0).success).toBe(true);
        expect(adapter.getResponse(0).body.typerefs).toEqual(
          expect.arrayContaining(['fooexception', 'barexception'])
        );
      });
    });
  });

  describe('Logging', () => {
    let breakpointService: BreakpointService;
    let response: DebugProtocol.Response;
    const lineNumberMapping: Map<string, LineBreakpointsInTyperef[]> = new Map();
    const typerefMapping: Map<string, string> = new Map();
    const fooUri = 'file:///foo.cls';
    lineNumberMapping.set(fooUri, [
      { typeref: 'foo', lines: [1, 2] },
      { typeref: 'foo$inner', lines: [3, 4] }
    ]);
    lineNumberMapping.set('file:///bar.cls', [{ typeref: 'bar', lines: [3, 4] }]);
    typerefMapping.set('foo', fooUri);
    typerefMapping.set('foo$inner', fooUri);
    typerefMapping.set('bar', 'file:///bar.cls');

    beforeEach(() => {
      response = {
        command: '',
        success: true,
        request_seq: 0,
        seq: 0,
        type: 'response'
      };
      breakpointService = adapter.getBreakpointService();
      breakpointService.setValidLines(lineNumberMapping, typerefMapping);
    });

    it('Should not log without an error', () => {
      adapter.tryToParseSfError({} as DebugProtocol.Response);

      expect(adapter.getEvents().length).toBe(0);
    });

    it('Should not log error without an error message', () => {
      adapter.tryToParseSfError(response, {});
      expect(response.message).toBe(nls.localize('unexpected_error_help_text'));
    });

    it('Should error to console with unexpected error schema', () => {
      adapter.tryToParseSfError({} as DebugProtocol.Response, '{"subject":"There was an error", "action":"Try again"}');

      expect(adapter.getEvents()[0].event).toBe('output');
      expect((adapter.getEvents()[0] as OutputEvent).body.output).toContain(
        '{"subject":"There was an error", "action":"Try again"}'
      );
    });

    it('Should error to console with non JSON', () => {
      adapter.tryToParseSfError({} as DebugProtocol.Response, 'There was an error"}');

      expect(adapter.getEvents()[0].event).toBe('output');
      expect((adapter.getEvents()[0] as OutputEvent).body.output).toContain('There was an error');
    });

    it('Should log debugger event to console', () => {
      const msg: DebuggerMessage = {
        event: {
          createdDate: new Date().toUTCString(),
          replayId: 0,
          type: 'foo'
        },
        sobject: {
          SessionId: '07aFAKE',
          BreakpointId: '07bFAKE',
          RequestId: '07cFAKE',
          Type: 'Debug',
          Line: 5,
          Description: 'inner[4]|A user debug message',
          Stacktrace: 'A stacktrace'
        }
      };

      adapter.logEvent(msg);
      expect(adapter.getEvents()[0].event).toBe('output');
      const outputEvent = adapter.getEvents()[0] as DebugProtocol.OutputEvent;
      expect(outputEvent.body.output).toContain(
        `${msg.event.createdDate} | ${msg.sobject.Type} | Request: ${msg.sobject.RequestId} | Breakpoint: ${msg.sobject.BreakpointId} | Line: ${msg.sobject.Line} | ${msg.sobject.Description} |${os.EOL}${msg.sobject.Stacktrace}`
      );
      expect(outputEvent.body.source!.path).toBe(URI.parse(fooUri).fsPath);
      expect(outputEvent.body.line).toBe(4);
    });
  });

  describe('Streaming', () => {
    let streamingSubscribeSpy: jest.SpyInstance;

    beforeEach(() => {
      streamingSubscribeSpy = jest.spyOn(StreamingService.prototype, 'subscribe').mockResolvedValue(undefined as any);
    });

    it('Should call streaming service subscribe', async () => {
      await adapter.connectStreaming('foo');

      expect(streamingSubscribeSpy).toHaveBeenCalledTimes(1);
      expect(streamingSubscribeSpy.mock.calls[0].length).toBe(4);
      expect(streamingSubscribeSpy.mock.calls[0][0]).toBe('foo');
      expect(streamingSubscribeSpy.mock.calls[0][1]).toBe(adapter.getRequestService());
      for (const obj of [streamingSubscribeSpy.mock.calls[0][2], streamingSubscribeSpy.mock.calls[0][3]]) {
        expect(obj).toBeInstanceOf(StreamingClientInfo);
        const clientInfo = obj as StreamingClientInfo;
        expect([StreamingService.SYSTEM_EVENT_CHANNEL, StreamingService.USER_EVENT_CHANNEL]).toContain(
          clientInfo.channel
        );

        expect(clientInfo.connectedHandler).toBeDefined();
        expect(clientInfo.disconnectedHandler).toBeDefined();
        expect(clientInfo.errorHandler).toBeDefined();
        expect(clientInfo.messageHandler).toBeDefined();
      }
    });
  });

  describe('Debugger events', () => {
    let sessionConnectedSpy: jest.SpyInstance;
    let sessionStopSpy: jest.SpyInstance;
    let markEventProcessedSpy: jest.SpyInstance;
    const knownExceptionBreakpoints: Map<string, string> = new Map([
      [`${SALESFORCE_EXCEPTION_PREFIX}AssertException`, '07bFAKE1'],
      ['namespace/fooexception', '07bFAKE2'],
      ['namespace/MyClass$InnerException', '07bFAKE3'],
      [`${TRIGGER_EXCEPTION_PREFIX}namespace/MyTrigger$InnerException`, '07bFAKE4']
    ]);

    beforeEach(() => {
      jest.spyOn(BreakpointService.prototype, 'getExceptionBreakpointCache').mockReturnValue(knownExceptionBreakpoints);
      sessionStopSpy = jest.spyOn(SessionService.prototype, 'forceStop');
      sessionConnectedSpy = jest.spyOn(SessionService.prototype, 'isConnected').mockReturnValue(true);
      jest.spyOn(SessionService.prototype, 'getSessionId').mockReturnValue('07aFAKE');
      jest.spyOn(StreamingService.prototype, 'hasProcessedEvent').mockReturnValue(false);
      markEventProcessedSpy = jest.spyOn(StreamingService.prototype, 'markEventProcessed');
    });

    it('[SessionTerminated] - Should stop session service', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'SessionTerminated',
          Description: 'foo'
        }
      };

      adapter.handleEvent(message);

      expect(sessionStopSpy).toHaveBeenCalledTimes(1);
      expect(adapter.getEvents().length).toBe(3);
      expect(adapter.getEvents()[0].event).toBe('output');
      expect((adapter.getEvents()[0] as OutputEvent).body.output).toContain('foo');
      expect(adapter.getEvents()[1].event).toBe(SHOW_MESSAGE_EVENT);
      const showMessageEvent = adapter.getEvents()[1];
      expect(showMessageEvent.body).toEqual({
        type: VscodeDebuggerMessageType.Error,
        message: 'foo'
      } as VscodeDebuggerMessage);
      expect(adapter.getEvents()[2].event).toBe('terminated');
    });

    it('[SessionTerminated] - Should not stop session service if session IDs do not match', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '456',
          Type: 'SessionTerminated',
          Description: 'foo'
        }
      };

      adapter.handleEvent(message);

      expect(sessionStopSpy).not.toHaveBeenCalled();
      expect(adapter.getEvents().length).toBe(0);
    });

    it('[SessionTerminated] - Should not stop session service if it is not connected', () => {
      sessionConnectedSpy.mockReturnValue(false);
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'SessionTerminated',
          Description: 'foo'
        }
      };

      adapter.handleEvent(message);

      expect(sessionStopSpy).not.toHaveBeenCalled();
      expect(adapter.getEvents().length).toBe(0);
    });

    it('[RequestStarted] - Should create new request thread', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'RequestStarted',
          RequestId: '07cFAKE'
        }
      };

      adapter.handleEvent(message);

      expect(adapter.getRequestThreads().size).toBe(1);
      expect(adapter.getRequestThreads().get(1)).toBe('07cFAKE');
      expect(adapter.getEvents().length).toBe(1);
      expect(adapter.getEvents()[0].event).toBe('output');
    });

    it('[RequestFinished] - Should delete request thread', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'RequestFinished',
          RequestId: '07cFAKE1'
        }
      };
      adapter.addRequestThread('07cFAKE1');
      adapter.addRequestThread('07cFAKE2');
      const variables = [
        new ApexVariable(newStringValue('var1'), ApexVariableKind.Static),
        new ApexVariable(newStringValue('var2'), ApexVariableKind.Global)
      ];
      const variableReference = adapter.createVariableContainer(new DummyContainer(variables));
      adapter.getVariableContainerReferenceByApexId().set(0, variableReference);
      const frameInfo = new ApexDebugStackFrameInfo('07cFAKE1', 0);
      const frameId = adapter.createStackFrameInfo(frameInfo);

      adapter.handleEvent(message);

      expect(adapter.getRequestThreads().size).toBe(1);
      expect(adapter.getEvents().length).toBe(2);
      expect(adapter.getEvents()[0].event).toBe('output');
      expect(adapter.getEvents()[1].event).toBe('thread');
      const threadEvent = adapter.getEvents()[1] as ThreadEvent;
      expect(threadEvent.body.reason).toBe('exited');
      expect(threadEvent.body.threadId).toBe(1);

      expect(adapter.getVariableContainer(variableReference)).toBeDefined();
      expect(adapter.getStackFrameInfo(frameId)).toBeDefined();

      expect(adapter.getVariableContainerReferenceByApexId().has(0)).toBe(true);
    });

    it('[RequestFinished] - Should not handle unknown request', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'RequestFinished',
          RequestId: '07cFAKE123'
        }
      };
      adapter.addRequestThread('07cFAKE');

      adapter.handleEvent(message);

      expect(adapter.getRequestThreads().size).toBe(1);
      expect(adapter.getEvents().length).toBe(0);
    });

    it('[RequestFinished] - Should clear variable handles', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'RequestFinished',
          RequestId: '07cFAKE1'
        }
      };
      adapter.addRequestThread('07cFAKE1');
      const variables = [
        new ApexVariable(newStringValue('var1'), ApexVariableKind.Static),
        new ApexVariable(newStringValue('var2'), ApexVariableKind.Global)
      ];
      const variableReference = adapter.createVariableContainer(new DummyContainer(variables));
      adapter.getVariableContainerReferenceByApexId().set(0, variableReference);
      const frameInfo = new ApexDebugStackFrameInfo('07cFAKE1', 0);
      const frameId = adapter.createStackFrameInfo(frameInfo);

      adapter.handleEvent(message);

      expect(adapter.getRequestThreads().size).toBe(0);
      expect(adapter.getEvents().length).toBe(2);

      expect(adapter.getVariableContainer(variableReference)).toBeUndefined();
      expect(adapter.getStackFrameInfo(frameId)).toBeUndefined();

      expect(adapter.getVariableContainerReferenceByApexId().has(0)).toBe(false);
    });

    it('[Resumed] - Should send continued event', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'Resumed',
          RequestId: '07cFAKE'
        }
      };
      adapter.addRequestThread('07cFAKE');

      adapter.handleEvent(message);

      expect(adapter.getRequestThreads().size).toBe(1);
      expect(adapter.getEvents().length).toBe(1);
      expect(adapter.getEvents()[0].event).toBe('output');
    });

    it('[Resumed] - Should not handle unknown request', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'Resumed',
          RequestId: '07cFAKE123'
        }
      };
      adapter.addRequestThread('07cFAKE');

      adapter.handleEvent(message);

      expect(adapter.getRequestThreads().size).toBe(1);
      expect(adapter.getEvents().length).toBe(0);
    });

    it('[Stopped] - Should send breakpoint stopped event', () => {
      const message: DebuggerMessage = {
        event: {
          replayId: 0
        } as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'Stopped',
          RequestId: '07cFAKE',
          BreakpointId: '07bFAKE'
        }
      };
      adapter.addRequestThread('07cFAKE');
      const variables = [
        new ApexVariable(newStringValue('var1'), ApexVariableKind.Static),
        new ApexVariable(newStringValue('var2'), ApexVariableKind.Global)
      ];
      const variableReference = adapter.createVariableContainer(new DummyContainer(variables));
      adapter.getVariableContainerReferenceByApexId().set(0, variableReference);
      const frameInfo = new ApexDebugStackFrameInfo('07cFAKE', 0);
      const frameId = adapter.createStackFrameInfo(frameInfo);

      adapter.handleEvent(message);

      expect(adapter.getRequestThreads().size).toBe(1);
      expect(adapter.getEvents().length).toBe(2);
      expect(adapter.getEvents()[0].event).toBe('output');
      expect(adapter.getEvents()[1].event).toBe('stopped');
      const stoppedEvent = adapter.getEvents()[1] as StoppedEvent;
      expect(stoppedEvent.body).toEqual({
        threadId: 1,
        reason: ''
      });
      expect(markEventProcessedSpy).toHaveBeenCalledTimes(1);
      expect(markEventProcessedSpy).toHaveBeenCalledWith('Stopped' satisfies ApexDebuggerEventType, 0);

      expect(adapter.getVariableContainer(variableReference)).toBeUndefined();
      expect(adapter.getStackFrameInfo(frameId)).toBeUndefined();

      expect(adapter.getVariableContainerReferenceByApexId().has(0)).toBe(false);
    });

    it('[Stopped] - Should display exception type when stopped on exception breakpoint', () => {
      const message: DebuggerMessage = {
        event: {
          replayId: 0
        } as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'Stopped',
          RequestId: '07cFAKE',
          BreakpointId: '07bFAKE1'
        }
      };
      adapter.addRequestThread('07cFAKE');
      adapter.handleEvent(message);

      const stoppedEvent = adapter.getEvents()[1] as StoppedEvent;
      expect(stoppedEvent.body).toEqual({
        threadId: 1,
        reason: 'AssertException'
      });
    });

    it('[Stopped] - Should display exception for namespaced orgs', () => {
      const message: DebuggerMessage = {
        event: {
          replayId: 0
        } as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'Stopped',
          RequestId: '07cFAKE',
          BreakpointId: '07bFAKE2'
        }
      };
      adapter.addRequestThread('07cFAKE');
      adapter.handleEvent(message);

      const stoppedEvent = adapter.getEvents()[1] as StoppedEvent;
      expect(stoppedEvent.body).toEqual({
        threadId: 1,
        reason: 'namespace.fooexception'
      });
    });

    it('[Stopped] - Should display exception for namespaced org with exception as inner class', () => {
      const message: DebuggerMessage = {
        event: {
          replayId: 0
        } as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'Stopped',
          RequestId: '07cFAKE',
          BreakpointId: '07bFAKE3'
        }
      };
      adapter.addRequestThread('07cFAKE');
      adapter.handleEvent(message);

      const stoppedEvent = adapter.getEvents()[1] as StoppedEvent;
      expect(stoppedEvent.body).toEqual({
        threadId: 1,
        reason: 'namespace.MyClass.InnerException'
      });
    });

    it('[Stopped] - Should display exception for namespaced org with exception as inner class in a trigger', () => {
      const message: DebuggerMessage = {
        event: {
          replayId: 0
        } as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'Stopped',
          RequestId: '07cFAKE',
          BreakpointId: '07bFAKE4'
        }
      };
      adapter.addRequestThread('07cFAKE');
      adapter.handleEvent(message);

      const stoppedEvent = adapter.getEvents()[1] as StoppedEvent;
      expect(stoppedEvent.body).toEqual({
        threadId: 1,
        reason: 'namespace.MyTrigger.InnerException'
      });
    });

    it('[Stopped] - Should send stepping stopped event', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'Stopped',
          RequestId: '07cFAKE-without-breakpoint'
        }
      };
      adapter.addRequestThread('07cFAKE-without-breakpoint');

      adapter.handleEvent(message);

      expect(adapter.getRequestThreads().size).toBe(1);
      expect(adapter.getEvents().length).toBe(2);
      expect(adapter.getEvents()[0].event).toBe('output');
      expect(adapter.getEvents()[1].event).toBe('stopped');
      const threadEvent = adapter.getEvents()[1] as ThreadEvent;
      expect(threadEvent.body.reason).toBe('');
      expect(threadEvent.body.threadId).toBe(1);
    });

    it('[Stopped] - Should not handle without request ID', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'Stopped'
        }
      };

      adapter.handleEvent(message);

      expect(adapter.getRequestThreads().size).toBe(0); // must have no registered request thread
      expect(adapter.getEvents().length).toBe(0); // must not handle an event without a request id
    });

    it('[Stopped] - Should not clear variable handles', () => {
      const message: DebuggerMessage = {
        event: {
          replayId: 0
        } as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'Stopped',
          RequestId: '07cFAKE1',
          BreakpointId: '07bFAKE'
        }
      };
      adapter.addRequestThread('07cFAKE1');
      adapter.addRequestThread('07cFAKE2');
      const variables = [
        new ApexVariable(newStringValue('var1'), ApexVariableKind.Static),
        new ApexVariable(newStringValue('var2'), ApexVariableKind.Global)
      ];
      const variableReference = adapter.createVariableContainer(new DummyContainer(variables));
      adapter.getVariableContainerReferenceByApexId().set(0, variableReference);
      const frameInfo = new ApexDebugStackFrameInfo('07cFAKE2', 0);
      const frameId = adapter.createStackFrameInfo(frameInfo);

      adapter.handleEvent(message);

      expect(adapter.getRequestThreads().size).toBe(2);
      expect(adapter.getEvents().length).toBe(2);

      expect(adapter.getVariableContainer(variableReference)).toBeDefined();
      expect(adapter.getStackFrameInfo(frameId)).toBeDefined();

      expect(adapter.getVariableContainerReferenceByApexId().has(0)).toBe(true);
    });

    it('[SystemWarning] - Should send events with description', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'SystemWarning',
          Description: 'foo'
        }
      };

      adapter.handleEvent(message);

      expect(adapter.getEvents().length).toBe(2);
      expect(adapter.getEvents()[0].event).toBe('output');
      expect(adapter.getEvents()[1].event).toBe(SHOW_MESSAGE_EVENT);
      const showMessageEvent = adapter.getEvents()[1];
      expect(showMessageEvent.body).toEqual({
        type: VscodeDebuggerMessageType.Warning,
        message: 'foo'
      } as VscodeDebuggerMessage);
    });

    it('[SystemWarning] - Should not send event without description', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'SystemWarning'
        }
      };

      adapter.handleEvent(message);

      expect(adapter.getEvents().length).toBe(1);
      expect(adapter.getEvents()[0].event).toBe('output');
    });

    it('[SystemGack] - Should send events with description', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'SystemGack',
          Description: 'foo'
        }
      };

      adapter.handleEvent(message);

      expect(adapter.getEvents().length).toBe(2);
      expect(adapter.getEvents()[0].event).toBe('output');
      expect(adapter.getEvents()[1].event).toBe(SHOW_MESSAGE_EVENT);
      const showMessageEvent = adapter.getEvents()[1];
      expect(showMessageEvent.body).toEqual({
        type: VscodeDebuggerMessageType.Error,
        message: 'foo'
      } as VscodeDebuggerMessage);
    });

    it('[SystemGack] - Should not send event without description', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'SystemGack'
        }
      };

      adapter.handleEvent(message);

      expect(adapter.getEvents().length).toBe(1);
      expect(adapter.getEvents()[0].event).toBe('output');
    });

    it('[ApexException] - Should log event', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'ApexException',
          Description: 'foo'
        }
      };

      adapter.handleEvent(message);

      expect(adapter.getEvents().length).toBe(1);
      expect(adapter.getEvents()[0].event).toBe('output');
    });

    it('[Debug] - Should log event', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'Debug',
          Description: 'foo[8]|real message'
        }
      };

      adapter.handleEvent(message);

      expect(adapter.getEvents().length).toBe(1);
      expect(adapter.getEvents()[0].event).toBe('output');
    });

    it('[SystemInfo] - Should log event', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'SystemInfo',
          Description: 'Request will not be debugged'
        }
      };

      adapter.handleEvent(message);

      expect(adapter.getEvents().length).toBe(1);
      expect(adapter.getEvents()[0].event).toBe('output');
    });
  });
});
