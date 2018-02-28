/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as AsyncLock from 'async-lock';
import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  OutputEvent,
  Source,
  StackFrame,
  StoppedEvent,
  ThreadEvent
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import Uri from 'vscode-uri';
import {
  ApexDebugStackFrameInfo,
  ApexVariable,
  ApexVariableKind,
  LaunchRequestArguments,
  SetExceptionBreakpointsArguments
} from '../../../src/adapter/apexDebug';
import {
  LineBreakpointInfo,
  LineBreakpointsInTyperef
} from '../../../src/breakpoints/lineBreakpoint';
import {
  ForceOrgDisplay,
  OrgInfo,
  RequestService,
  RunCommand,
  StateCommand,
  StepIntoCommand,
  StepOutCommand,
  StepOverCommand
} from '../../../src/commands';
import {
  DEFAULT_CONNECTION_TIMEOUT_MS,
  DEFAULT_IDLE_TIMEOUT_MS,
  DEFAULT_IDLE_WARN1_MS,
  DEFAULT_IDLE_WARN2_MS,
  DEFAULT_IDLE_WARN3_MS,
  DEFAULT_INITIALIZE_TIMEOUT_MS,
  EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS,
  EXCEPTION_BREAKPOINT_BREAK_MODE_NEVER,
  EXCEPTION_BREAKPOINT_REQUEST,
  GET_LINE_BREAKPOINT_INFO_EVENT,
  GET_WORKSPACE_SETTINGS_EVENT,
  HOTSWAP_REQUEST,
  LINE_BREAKPOINT_INFO_REQUEST,
  LIST_EXCEPTION_BREAKPOINTS_REQUEST,
  SALESFORCE_EXCEPTION_PREFIX,
  SHOW_MESSAGE_EVENT,
  TRIGGER_EXCEPTION_PREFIX,
  WORKSPACE_SETTINGS_REQUEST
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
import {
  VscodeDebuggerMessage,
  VscodeDebuggerMessageType,
  WorkspaceSettings
} from '../../../src/index';
import { nls } from '../../../src/messages';
import { ApexDebugForTest } from './apexDebugForTest';
import {
  DummyContainer,
  newStringValue
} from './apexDebugVariablesHandling.test';
import os = require('os');

describe('Interactive debugger adapter - unit', () => {
  let adapter: ApexDebugForTest;

  describe('Initialize', () => {
    let breakpointClearSpy: sinon.SinonSpy;
    let breakpointHasLineNumberMappingSpy: sinon.SinonStub;
    let response: DebugProtocol.InitializeResponse;
    let args: DebugProtocol.InitializeRequestArguments;
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService(),
        new RequestService()
      );
      breakpointClearSpy = sinon.spy(
        BreakpointService.prototype,
        'clearSavedBreakpoints'
      );
      response = {
        command: '',
        success: true,
        request_seq: 0,
        seq: 0,
        type: 'response'
      };
      args = {
        adapterID: ''
      };
      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      breakpointClearSpy.restore();
      breakpointHasLineNumberMappingSpy.restore();
      clock.restore();
    });

    it('Should send successful initialized response', async () => {
      breakpointHasLineNumberMappingSpy = sinon
        .stub(BreakpointService.prototype, 'hasLineNumberMapping')
        .returns(true);

      adapter.initializeReq(response, args);

      setTimeout(() => {
        expect(adapter.getResponses().length).to.equal(0);
        expect(breakpointClearSpy.calledOnce).to.equal(true);
        expect(adapter.getEvents().length).to.equal(2);
        expect(adapter.getEvents()[0].event).to.equal(
          GET_WORKSPACE_SETTINGS_EVENT
        );
        expect(adapter.getEvents()[1].event).to.equal(
          GET_LINE_BREAKPOINT_INFO_EVENT
        );
      }, DEFAULT_INITIALIZE_TIMEOUT_MS);
      clock.tick(DEFAULT_INITIALIZE_TIMEOUT_MS + 1);
    });

    it('Should send language server error message', async () => {
      breakpointHasLineNumberMappingSpy = sinon
        .stub(BreakpointService.prototype, 'hasLineNumberMapping')
        .returns(false);

      adapter.initializeReq(response, args);

      setTimeout(() => {
        const actualInitializedResponse: DebugProtocol.InitializeResponse = adapter.getResponse(
          0
        );
        expect(actualInitializedResponse.success).to.equal(false);
        expect(actualInitializedResponse.message).to.equal(
          nls.localize('session_language_server_error_text')
        );
        expect(breakpointClearSpy.calledOnce).to.equal(true);
        expect(adapter.getEvents().length).to.equal(2);
        expect(adapter.getEvents()[0].event).to.equal(
          GET_WORKSPACE_SETTINGS_EVENT
        );
        expect(adapter.getEvents()[1].event).to.equal(
          GET_LINE_BREAKPOINT_INFO_EVENT
        );
      }, DEFAULT_INITIALIZE_TIMEOUT_MS);
      clock.tick(DEFAULT_INITIALIZE_TIMEOUT_MS + 1);
    });
  });

  describe('Attach', () => {
    let response: DebugProtocol.AttachResponse;
    let args: DebugProtocol.AttachRequestArguments;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService(),
        new RequestService()
      );
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
      expect(actualResp.success).to.equal(false);
    });
  });

  describe('Launch', () => {
    let sessionStartSpy: sinon.SinonStub;
    let sessionPrintToDebugSpy: sinon.SinonSpy;
    let sessionProjectSpy: sinon.SinonSpy;
    let sessionUserFilterSpy: sinon.SinonSpy;
    let sessionEntryFilterSpy: sinon.SinonSpy;
    let sessionRequestFilterSpy: sinon.SinonSpy;
    let sessionConnectedSpy: sinon.SinonStub;
    let resetIdleTimersSpy: sinon.SinonSpy;
    let breakpointHasLineNumberMappingSpy: sinon.SinonStub;
    let streamingSubscribeSpy: sinon.SinonStub;
    let orgInfoSpy: sinon.SinonStub;
    let response: DebugProtocol.LaunchResponse;
    let args: LaunchRequestArguments;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService(),
        new RequestService()
      );
      sessionProjectSpy = sinon.spy(SessionService.prototype, 'forProject');
      sessionUserFilterSpy = sinon.spy(
        SessionService.prototype,
        'withUserFilter'
      );
      sessionEntryFilterSpy = sinon.spy(
        SessionService.prototype,
        'withEntryFilter'
      );
      sessionRequestFilterSpy = sinon.spy(
        SessionService.prototype,
        'withRequestFilter'
      );
      resetIdleTimersSpy = sinon.spy(
        ApexDebugForTest.prototype,
        'resetIdleTimer'
      );
      orgInfoSpy = sinon
        .stub(ForceOrgDisplay.prototype, 'getOrgInfo')
        .returns({} as OrgInfo);
      response = {
        command: '',
        success: true,
        request_seq: 0,
        seq: 0,
        type: 'response'
      };
      args = {
        sfdxProject: 'project',
        userIdFilter: ['005FAKE1', '005FAKE2', '005FAKE1'],
        entryPointFilter: 'entry',
        requestTypeFilter: [
          'RUN_TESTS_SYNCHRONOUS',
          'EXECUTE_ANONYMOUS',
          'RUN_TESTS_SYNCHRONOUS'
        ]
      };
    });

    afterEach(() => {
      sessionStartSpy.restore();
      sessionProjectSpy.restore();
      sessionUserFilterSpy.restore();
      sessionEntryFilterSpy.restore();
      sessionRequestFilterSpy.restore();
      sessionConnectedSpy.restore();
      resetIdleTimersSpy.restore();
      streamingSubscribeSpy.restore();
      breakpointHasLineNumberMappingSpy.restore();
      orgInfoSpy.restore();
      if (sessionPrintToDebugSpy) {
        sessionPrintToDebugSpy.restore();
      }
    });

    it('Should launch successfully', async () => {
      const sessionId = '07aFAKE';
      sessionStartSpy = sinon
        .stub(SessionService.prototype, 'start')
        .returns(Promise.resolve(sessionId));
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(true);
      streamingSubscribeSpy = sinon
        .stub(StreamingService.prototype, 'subscribe')
        .returns(Promise.resolve(true));
      breakpointHasLineNumberMappingSpy = sinon
        .stub(BreakpointService.prototype, 'hasLineNumberMapping')
        .returns(true);

      await adapter.launchReq(response, args);

      expect(sessionStartSpy.calledOnce).to.equal(true);
      expect(adapter.getResponse(0).success).to.equal(true);
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(
        (adapter.getEvents()[0] as OutputEvent).body.output
      ).to.have.string(nls.localize('session_started_text', sessionId));
      expect(adapter.getEvents()[1].event).to.equal('initialized');
      expect(sessionUserFilterSpy.calledOnce).to.equal(true);
      expect(sessionEntryFilterSpy.calledOnce).to.equal(true);
      expect(sessionRequestFilterSpy.calledOnce).to.equal(true);
      expect(sessionUserFilterSpy.getCall(0).args).to.have.same.members([
        '005FAKE1,005FAKE2'
      ]);
      expect(sessionEntryFilterSpy.getCall(0).args).to.have.same.members([
        'entry'
      ]);
      expect(sessionRequestFilterSpy.getCall(0).args).to.have.same.members([
        'RUN_TESTS_SYNCHRONOUS,EXECUTE_ANONYMOUS'
      ]);
      expect(resetIdleTimersSpy.calledOnce).to.equal(true);
    });

    it('Should not launch if ApexDebuggerSession object is not accessible', async () => {
      sessionStartSpy = sinon
        .stub(SessionService.prototype, 'start')
        .returns(
          Promise.reject(
            '{"message":"entity type cannot be inserted: Apex Debugger Session", "action":"Try again"}'
          )
        );
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(false);
      streamingSubscribeSpy = sinon
        .stub(StreamingService.prototype, 'subscribe')
        .returns(Promise.resolve(true));
      breakpointHasLineNumberMappingSpy = sinon
        .stub(BreakpointService.prototype, 'hasLineNumberMapping')
        .returns(true);

      await adapter.launchReq(response, args);

      expect(sessionStartSpy.calledOnce).to.equal(true);
      expect(adapter.getResponse(0).success).to.equal(false);
      expect(adapter.getResponse(0).message).to.equal(
        nls.localize('session_no_entity_access_text')
      );
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(
        (adapter.getEvents()[0] as OutputEvent).body.output
      ).to.have.string('Try again');
      expect(resetIdleTimersSpy.called).to.equal(false);
    });

    it('Should not launch if streaming service errors out', async () => {
      const sessionId = '07aFAKE';
      sessionStartSpy = sinon
        .stub(SessionService.prototype, 'start')
        .returns(Promise.resolve(sessionId));
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(true);
      streamingSubscribeSpy = sinon
        .stub(StreamingService.prototype, 'subscribe')
        .returns(Promise.resolve(false));
      breakpointHasLineNumberMappingSpy = sinon
        .stub(BreakpointService.prototype, 'hasLineNumberMapping')
        .returns(true);

      await adapter.launchReq(response, args);

      expect(sessionStartSpy.called).to.equal(false);
      expect(adapter.getResponse(0).success).to.equal(false);
      expect(adapter.getEvents().length).to.equal(0);
      expect(resetIdleTimersSpy.called).to.equal(false);
    });

    it('Should not launch without line number mapping', async () => {
      sessionStartSpy = sinon.stub(SessionService.prototype, 'start');
      sessionConnectedSpy = sinon.stub(SessionService.prototype, 'isConnected');
      streamingSubscribeSpy = sinon.stub(
        StreamingService.prototype,
        'subscribe'
      );
      breakpointHasLineNumberMappingSpy = sinon
        .stub(BreakpointService.prototype, 'hasLineNumberMapping')
        .returns(false);

      await adapter.launchReq(response, args);
      expect(sessionStartSpy.called).to.equal(false);
      expect(adapter.getResponse(0).success).to.equal(false);
      expect(adapter.getResponse(0).message).to.equal(
        nls.localize('session_language_server_error_text')
      );
      expect(adapter.getEvents().length).to.equal(0);
      expect(resetIdleTimersSpy.called).to.equal(false);
    });

    it('Should configure tracing with boolean', async () => {
      const sessionId = '07aFAKE';
      sessionPrintToDebugSpy = sinon
        .stub(ApexDebugForTest.prototype, 'printToDebugConsole')
        .returns(Promise.resolve());
      sessionStartSpy = sinon
        .stub(SessionService.prototype, 'start')
        .returns(Promise.resolve(sessionId));
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(true);
      streamingSubscribeSpy = sinon
        .stub(StreamingService.prototype, 'subscribe')
        .returns(Promise.resolve(true));
      breakpointHasLineNumberMappingSpy = sinon
        .stub(BreakpointService.prototype, 'hasLineNumberMapping')
        .returns(true);

      // given
      args.trace = true;
      await adapter.launchReq(response, args);
      sessionPrintToDebugSpy.reset();

      // when
      adapter.log('variables', 'message');

      // then
      expect(sessionPrintToDebugSpy.callCount).to.equal(1);
    });

    it('Should not do any tracing by default', async () => {
      const sessionId = '07aFAKE';
      sessionPrintToDebugSpy = sinon
        .stub(ApexDebugForTest.prototype, 'printToDebugConsole')
        .returns(Promise.resolve());
      sessionStartSpy = sinon
        .stub(SessionService.prototype, 'start')
        .returns(Promise.resolve(sessionId));
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(true);
      streamingSubscribeSpy = sinon
        .stub(StreamingService.prototype, 'subscribe')
        .returns(Promise.resolve(true));
      breakpointHasLineNumberMappingSpy = sinon
        .stub(BreakpointService.prototype, 'hasLineNumberMapping')
        .returns(true);

      // given
      await adapter.launchReq(response, args);
      sessionPrintToDebugSpy.reset();

      // when
      adapter.log('variables', 'message');

      // then
      expect(sessionPrintToDebugSpy.callCount).to.equal(0);
    });

    it('Should configure tracing for specific category only', async () => {
      const sessionId = '07aFAKE';
      sessionPrintToDebugSpy = sinon
        .stub(ApexDebugForTest.prototype, 'printToDebugConsole')
        .returns(Promise.resolve());
      sessionStartSpy = sinon
        .stub(SessionService.prototype, 'start')
        .returns(Promise.resolve(sessionId));
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(true);
      streamingSubscribeSpy = sinon
        .stub(StreamingService.prototype, 'subscribe')
        .returns(Promise.resolve(true));
      breakpointHasLineNumberMappingSpy = sinon
        .stub(BreakpointService.prototype, 'hasLineNumberMapping')
        .returns(true);

      // given
      args.trace = 'variables, launch, protocol';
      await adapter.launchReq(response, args);
      sessionPrintToDebugSpy.reset();

      // when
      adapter.log('variables', 'message');
      adapter.log('launch', 'message');
      adapter.log('protocol', 'message');

      // then
      expect(sessionPrintToDebugSpy.callCount).to.equal(3);
    });

    it('Should configure tracing for all categories', async () => {
      const sessionId = '07aFAKE';
      sessionPrintToDebugSpy = sinon
        .stub(ApexDebugForTest.prototype, 'printToDebugConsole')
        .returns(Promise.resolve());
      sessionStartSpy = sinon
        .stub(SessionService.prototype, 'start')
        .returns(Promise.resolve(sessionId));
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(true);
      streamingSubscribeSpy = sinon
        .stub(StreamingService.prototype, 'subscribe')
        .returns(Promise.resolve(true));
      breakpointHasLineNumberMappingSpy = sinon
        .stub(BreakpointService.prototype, 'hasLineNumberMapping')
        .returns(true);

      // given
      args.trace = 'all';
      await adapter.launchReq(response, args);
      sessionPrintToDebugSpy.reset();

      // when
      adapter.log('variables', 'message');
      adapter.log('launch', 'message');
      adapter.log('protocol', 'message');

      // then
      expect(sessionPrintToDebugSpy.callCount).to.equal(3);
    });

    it('Should return empty string with null launch array', () => {
      expect(adapter.toCommaSeparatedString()).to.equal('');
    });

    it('Should return empty string with empty launch array', () => {
      expect(adapter.toCommaSeparatedString([])).to.equal('');
    });
  });

  describe('Idle session', () => {
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService(),
        new RequestService()
      );
      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      clock.restore();
    });

    it('Should clear idle timers', () => {
      adapter.getIdleTimers().push(
        setTimeout(() => {
          // Do nothing
        }, 10000)
      );

      adapter.clearIdleTimers();

      expect(adapter.getIdleTimers().length).to.equal(0);
    });

    it('Should create idle timers', () => {
      adapter.resetIdleTimer();

      setTimeout(() => {
        expect(adapter.getEvents()[0].event).to.equal('output');
        expect(
          (adapter.getEvents()[0] as OutputEvent).body.output
        ).to.have.string(
          nls.localize(
            'idle_warn_text',
            DEFAULT_IDLE_WARN1_MS / 60000,
            (DEFAULT_IDLE_TIMEOUT_MS - DEFAULT_IDLE_WARN1_MS) / 60000
          )
        );
      }, DEFAULT_IDLE_WARN1_MS);
      clock.tick(DEFAULT_IDLE_WARN1_MS + 1);

      setTimeout(() => {
        expect(adapter.getEvents()[1].event).to.equal('output');
        expect(
          (adapter.getEvents()[1] as OutputEvent).body.output
        ).to.have.string(
          nls.localize(
            'idle_warn_text',
            DEFAULT_IDLE_WARN2_MS / 60000,
            (DEFAULT_IDLE_TIMEOUT_MS - DEFAULT_IDLE_WARN2_MS) / 60000
          )
        );
      }, DEFAULT_IDLE_WARN2_MS);
      clock.tick(DEFAULT_IDLE_WARN2_MS + 1);

      setTimeout(() => {
        expect(adapter.getEvents()[2].event).to.equal('output');
        expect(
          (adapter.getEvents()[2] as OutputEvent).body.output
        ).to.have.string(
          nls.localize(
            'idle_warn_text',
            DEFAULT_IDLE_WARN3_MS / 60000,
            (DEFAULT_IDLE_TIMEOUT_MS - DEFAULT_IDLE_WARN3_MS) / 60000
          )
        );
      }, DEFAULT_IDLE_WARN3_MS);
      clock.tick(DEFAULT_IDLE_WARN3_MS + 1);

      setTimeout(() => {
        expect(adapter.getEvents()[3].event).to.equal('output');
        expect(
          (adapter.getEvents()[3] as OutputEvent).body.output
        ).to.have.string(
          nls.localize('idle_terminated_text', DEFAULT_IDLE_TIMEOUT_MS / 60000)
        );
        expect(adapter.getEvents()[4].event).to.equal('terminated');
      }, DEFAULT_IDLE_TIMEOUT_MS);
      clock.tick(DEFAULT_IDLE_TIMEOUT_MS + 1);
    });
  });

  describe('Disconnect', () => {
    let sessionStopSpy: sinon.SinonStub;
    let sessionConnectedSpy: sinon.SinonStub;
    let streamingDisconnectSpy: sinon.SinonStub;
    let breakpointClearSpy: sinon.SinonSpy;
    let clearIdleTimersSpy: sinon.SinonSpy;
    let response: DebugProtocol.DisconnectResponse;
    let args: DebugProtocol.DisconnectArguments;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService(),
        new RequestService()
      );
      streamingDisconnectSpy = sinon.stub(
        StreamingService.prototype,
        'disconnect'
      );
      breakpointClearSpy = sinon.spy(
        BreakpointService.prototype,
        'clearSavedBreakpoints'
      );
      clearIdleTimersSpy = sinon.spy(
        ApexDebugForTest.prototype,
        'clearIdleTimers'
      );
      response = {
        command: '',
        success: true,
        request_seq: 0,
        seq: 0,
        type: 'response'
      };
      args = {};
    });

    afterEach(() => {
      if (sessionStopSpy) {
        sessionStopSpy.restore();
      }
      sessionConnectedSpy.restore();
      streamingDisconnectSpy.restore();
      breakpointClearSpy.restore();
      clearIdleTimersSpy.restore();
    });

    it('Should not use session service if not connected', async () => {
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(false);

      await adapter.disconnectReq(response, args);

      expect(adapter.getResponse(0)).to.deep.equal(response);
      expect(streamingDisconnectSpy.calledOnce).to.equal(true);
      expect(breakpointClearSpy.called).to.equal(false);
      expect(clearIdleTimersSpy.calledOnce).to.equal(true);
    });

    it('Should try to disconnect and stop', async () => {
      const sessionId = '07aFAKE';
      sessionStopSpy = sinon
        .stub(SessionService.prototype, 'stop')
        .returns(Promise.resolve(sessionId));
      sessionConnectedSpy = sinon.stub(SessionService.prototype, 'isConnected');
      sessionConnectedSpy.onCall(0).returns(true);
      sessionConnectedSpy.onCall(1).returns(false);

      await adapter.disconnectReq(response, args);

      expect(sessionStopSpy.calledOnce).to.equal(true);
      expect(adapter.getResponse(0)).to.deep.equal(response);
      expect(
        (adapter.getEvents()[0] as OutputEvent).body.output
      ).to.have.string(nls.localize('session_terminated_text', sessionId));
      expect(streamingDisconnectSpy.calledOnce).to.equal(true);
      expect(breakpointClearSpy.called).to.equal(false);
      expect(clearIdleTimersSpy.calledOnce).to.equal(true);
    });

    it('Should try to disconnect and not stop', async () => {
      sessionStopSpy = sinon
        .stub(SessionService.prototype, 'stop')
        .returns(
          Promise.reject(
            '{"message":"There was an error", "action":"Try again"}'
          )
        );
      sessionConnectedSpy = sinon.stub(SessionService.prototype, 'isConnected');
      sessionConnectedSpy.onCall(0).returns(true);
      sessionConnectedSpy.onCall(1).returns(true);

      await adapter.disconnectReq(response, args);

      expect(sessionStopSpy.calledOnce).to.equal(true);
      expect(adapter.getResponse(0).success).to.equal(false);
      expect(adapter.getResponse(0).message).to.equal('There was an error');
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(
        (adapter.getEvents()[0] as OutputEvent).body.output
      ).to.have.string('Try again');
      expect(streamingDisconnectSpy.calledOnce).to.equal(true);
      expect(breakpointClearSpy.called).to.equal(false);
      expect(clearIdleTimersSpy.calledOnce).to.equal(true);
    });
  });

  describe('Line breakpoint request', () => {
    let breakpointReconcileSpy: sinon.SinonStub;
    let breakpointGetSpy: sinon.SinonSpy;
    let breakpointGetTyperefSpy: sinon.SinonSpy;
    let breakpointCreateSpy: sinon.SinonSpy;
    let breakpointCacheSpy: sinon.SinonSpy;
    let sessionIdSpy: sinon.SinonStub;
    let lockSpy: sinon.SinonSpy;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService(),
        new RequestService()
      );
      breakpointGetSpy = sinon.spy(
        BreakpointService.prototype,
        'getBreakpointsFor'
      );
      breakpointGetTyperefSpy = sinon.spy(
        BreakpointService.prototype,
        'getTyperefFor'
      );
      breakpointCreateSpy = sinon.spy(
        BreakpointService.prototype,
        'createLineBreakpoint'
      );
      breakpointCacheSpy = sinon.spy(
        BreakpointService.prototype,
        'cacheLineBreakpoint'
      );
      sessionIdSpy = sinon
        .stub(SessionService.prototype, 'getSessionId')
        .returns('07aFAKE');
      lockSpy = sinon.spy(AsyncLock.prototype, 'acquire');
    });

    afterEach(() => {
      if (breakpointReconcileSpy) {
        breakpointReconcileSpy.restore();
      }
      if (breakpointGetSpy) {
        breakpointGetSpy.restore();
      }
      if (breakpointGetTyperefSpy) {
        breakpointGetTyperefSpy.restore();
      }
      if (breakpointCreateSpy) {
        breakpointCreateSpy.restore();
      }
      if (breakpointCacheSpy) {
        breakpointCacheSpy.restore();
      }
      sessionIdSpy.restore();
      lockSpy.restore();
    });

    it('Should create breakpoint', async () => {
      const bpLines = [1, 2];
      breakpointReconcileSpy = sinon
        .stub(BreakpointService.prototype, 'reconcileLineBreakpoints')
        .returns(Promise.resolve(new Set().add(1)));
      adapter.setSfdxProject('someProjectPath');

      await adapter.setBreakPointsReq(
        {} as DebugProtocol.SetBreakpointsResponse,
        {
          source: {
            path: 'foo.cls'
          },
          lines: bpLines
        }
      );

      expect(lockSpy.calledOnce).to.equal(true);
      expect(lockSpy.getCall(0).args[0]).to.equal('breakpoint-file:///foo.cls');
      expect(breakpointReconcileSpy.calledOnce).to.equal(true);
      expect(breakpointReconcileSpy.getCall(0).args).to.deep.equal([
        'someProjectPath',
        'file:///foo.cls',
        '07aFAKE',
        bpLines
      ]);
      expect(breakpointGetSpy.called).to.equal(false);
      expect(breakpointGetTyperefSpy.called).to.equal(false);
      expect(breakpointCreateSpy.called).to.equal(false);
      expect(breakpointCacheSpy.called).to.equal(false);

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
      expect(adapter.getResponse(0)).to.deep.equal(expectedResp);
    });

    it('Should not create breakpoint without source argument', async () => {
      const bpLines = [1, 2];
      breakpointReconcileSpy = sinon
        .stub(BreakpointService.prototype, 'reconcileLineBreakpoints')
        .returns(Promise.resolve(bpLines));
      adapter.setSfdxProject('someProjectPath');

      await adapter.setBreakPointsReq(
        {} as DebugProtocol.SetBreakpointsResponse,
        {
          source: {
            path: undefined
          },
          lines: bpLines
        }
      );

      expect(breakpointReconcileSpy.called).to.equal(false);
      expect(breakpointGetTyperefSpy.called).to.equal(false);
      expect(breakpointCreateSpy.called).to.equal(false);
      expect(breakpointCacheSpy.called).to.equal(false);

      const expectedResp = {
        success: true
      } as DebugProtocol.SetBreakpointsResponse;
      expect(adapter.getResponse(0)).to.deep.equal(expectedResp);
    });

    it('Should not create breakpoint without lines argument', async () => {
      const bpLines = [1, 2];
      breakpointReconcileSpy = sinon
        .stub(BreakpointService.prototype, 'reconcileLineBreakpoints')
        .returns(Promise.resolve(bpLines));
      adapter.setSfdxProject('someProjectPath');

      await adapter.setBreakPointsReq(
        {} as DebugProtocol.SetBreakpointsResponse,
        {
          source: {
            path: 'foo.cls'
          },
          lines: undefined
        }
      );

      expect(breakpointReconcileSpy.called).to.equal(false);
      expect(breakpointGetTyperefSpy.called).to.equal(false);
      expect(breakpointCreateSpy.called).to.equal(false);
      expect(breakpointCacheSpy.called).to.equal(false);

      const expectedResp = {
        success: true
      } as DebugProtocol.SetBreakpointsResponse;
      expect(adapter.getResponse(0)).to.deep.equal(expectedResp);
    });
  });

  describe('Continue request', () => {
    let runSpy: sinon.SinonStub;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService(),
        new RequestService()
      );
      adapter.setSfdxProject('someProjectPath');
      adapter.addRequestThread('07cFAKE');
    });

    afterEach(() => {
      runSpy.restore();
    });

    it('Should continue successfully', async () => {
      runSpy = sinon
        .stub(RequestService.prototype, 'execute')
        .returns(Promise.resolve(''));

      await adapter.continueReq(
        {} as DebugProtocol.ContinueResponse,
        { threadId: 1 } as DebugProtocol.ContinueArguments
      );

      expect(adapter.getResponse(0).success).to.equal(true);
      expect(adapter.getResponse(0).body.allThreadsContinued).to.equal(false);
      expect(runSpy.calledOnce).to.equal(true);
      expect(runSpy.getCall(0).args[0]).to.be.instanceof(RunCommand);
    });

    it('Should not continue unknown thread', async () => {
      runSpy = sinon
        .stub(RequestService.prototype, 'execute')
        .returns(Promise.resolve(''));

      await adapter.continueReq(
        {} as DebugProtocol.ContinueResponse,
        { threadId: 2 } as DebugProtocol.ContinueArguments
      );

      expect(adapter.getResponse(0).success).to.equal(false);
      expect(runSpy.called).to.equal(false);
    });

    it('Should handle run command error response', async () => {
      runSpy = sinon
        .stub(RequestService.prototype, 'execute')
        .returns(
          Promise.reject(
            '{"message":"There was an error", "action":"Try again"}'
          )
        );

      await adapter.continueReq(
        {} as DebugProtocol.ContinueResponse,
        { threadId: 1 } as DebugProtocol.ContinueArguments
      );

      expect(adapter.getResponse(0).success).to.equal(false);
      expect(adapter.getResponse(0).message).to.equal(
        '{"message":"There was an error", "action":"Try again"}'
      );
      expect(runSpy.called).to.equal(true);
    });
  });

  describe('Stepping', () => {
    let stepSpy: sinon.SinonStub;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService(),
        new RequestService()
      );
      adapter.setSfdxProject('someProjectPath');
      adapter.addRequestThread('07cFAKE');
    });

    afterEach(() => {
      stepSpy.restore();
    });

    it('Step into should call proper command', async () => {
      stepSpy = sinon
        .stub(RequestService.prototype, 'execute')
        .returns(Promise.resolve(''));

      await adapter.stepInRequest(
        {} as DebugProtocol.StepInResponse,
        { threadId: 1 } as DebugProtocol.StepInArguments
      );

      expect(adapter.getResponse(0).success).to.equal(true);
      expect(stepSpy.calledOnce).to.equal(true);
      expect(stepSpy.getCall(0).args[0]).to.be.instanceof(StepIntoCommand);
    });

    it('Step out should send proper command', async () => {
      stepSpy = sinon
        .stub(RequestService.prototype, 'execute')
        .returns(Promise.resolve(''));

      await adapter.stepOutRequest(
        {} as DebugProtocol.StepOutResponse,
        { threadId: 1 } as DebugProtocol.StepOutArguments
      );

      expect(adapter.getResponse(0).success).to.equal(true);
      expect(stepSpy.calledOnce).to.equal(true);
      expect(stepSpy.getCall(0).args[0]).to.be.instanceof(StepOutCommand);
    });

    it('Step over should send proper command', async () => {
      stepSpy = sinon
        .stub(RequestService.prototype, 'execute')
        .returns(Promise.resolve(''));

      await adapter.nextRequest(
        {} as DebugProtocol.NextResponse,
        { threadId: 1 } as DebugProtocol.NextArguments
      );

      expect(adapter.getResponse(0).success).to.equal(true);
      expect(stepSpy.calledOnce).to.equal(true);
      expect(stepSpy.getCall(0).args[0]).to.be.instanceof(StepOverCommand);
    });
  });

  describe('Threads request', () => {
    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService(),
        new RequestService()
      );
    });

    it('Should return known debugged requests', () => {
      adapter.addRequestThread('07cFAKE1');
      adapter.addRequestThread('07cFAKE2');

      adapter.threadsReq({} as DebugProtocol.ThreadsResponse);

      expect(adapter.getResponses().length).to.equal(1);
      expect(adapter.getResponse(0).success).to.equal(true);
      const response = adapter.getResponse(0) as DebugProtocol.ThreadsResponse;
      expect(response.body.threads).to.deep.equal([
        { id: 1, name: 'Request ID: 07cFAKE1' },
        { id: 2, name: 'Request ID: 07cFAKE2' }
      ]);
    });

    it('Should not return any debugged requests', () => {
      adapter.threadsReq({} as DebugProtocol.ThreadsResponse);

      expect(adapter.getResponses().length).to.equal(1);
      expect(adapter.getResponse(0).success).to.equal(true);
      const response = adapter.getResponse(0) as DebugProtocol.ThreadsResponse;
      expect(response.body.threads.length).to.equal(0);
    });
  });

  describe('Stacktrace request', () => {
    let stateSpy: sinon.SinonStub;
    let sourcePathSpy: sinon.SinonStub;
    let lockSpy: sinon.SinonSpy;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService(),
        new RequestService()
      );
      adapter.setSfdxProject('someProjectPath');
      adapter.addRequestThread('07cFAKE');
      lockSpy = sinon.spy(AsyncLock.prototype, 'acquire');
    });

    afterEach(() => {
      stateSpy.restore();
      if (sourcePathSpy) {
        sourcePathSpy.restore();
      }
      lockSpy.restore();
    });

    it('Should not get state of unknown thread', async () => {
      stateSpy = sinon
        .stub(RequestService.prototype, 'execute')
        .returns(Promise.resolve('{}'));

      await adapter.stackTraceRequest(
        {} as DebugProtocol.StackTraceResponse,
        { threadId: 2 } as DebugProtocol.StackTraceArguments
      );

      expect(adapter.getResponse(0).success).to.equal(false);
      expect(stateSpy.called).to.equal(false);
    });

    it('Should return response with empty stackframes', async () => {
      stateSpy = sinon
        .stub(RequestService.prototype, 'execute')
        .returns(
          Promise.resolve(
            '{"stateResponse":{"state":{"stack":{"stackFrame":[]}}}}'
          )
        );

      await adapter.stackTraceRequest(
        {} as DebugProtocol.StackTraceResponse,
        { threadId: 1 } as DebugProtocol.StackTraceArguments
      );

      expect(stateSpy.called).to.equal(true);
      const response = adapter.getResponse(
        0
      ) as DebugProtocol.StackTraceResponse;
      expect(response.success).to.equal(true);
      expect(response.body.stackFrames.length).to.equal(0);
    });

    it('Should process stack frame with local source', async () => {
      stateSpy = sinon
        .stub(RequestService.prototype, 'execute')
        .returns(
          Promise.resolve(
            '{"stateResponse":{"state":{"stack":{"stackFrame":[{"typeRef":"FooDebug","fullName":"FooDebug.test()","lineNumber":1,"frameNumber":0},{"typeRef":"BarDebug","fullName":"BarDebug.test()","lineNumber":2,"frameNumber":1}]}}}}'
          )
        );
      const fileUri = 'file:///foo.cls';
      sourcePathSpy = sinon
        .stub(BreakpointService.prototype, 'getSourcePathFromTyperef')
        .returns(fileUri);

      await adapter.stackTraceRequest(
        {} as DebugProtocol.StackTraceResponse,
        { threadId: 1 } as DebugProtocol.StackTraceArguments
      );

      expect(lockSpy.calledOnce).to.equal(true);
      expect(lockSpy.getCall(0).args[0]).to.equal('stacktrace');
      expect(stateSpy.called).to.equal(true);
      expect(stateSpy.getCall(0).args[0]).to.be.instanceof(StateCommand);
      const response = adapter.getResponse(
        0
      ) as DebugProtocol.StackTraceResponse;
      expect(response.success).to.equal(true);
      const stackFrames = response.body.stackFrames;
      expect(stackFrames.length).to.equal(2);
      expect(stackFrames[0]).to.deep.equal(
        new StackFrame(
          1000,
          'FooDebug.test()',
          new Source('foo.cls', Uri.parse(fileUri).fsPath),
          1,
          0
        )
      );
      expect(stackFrames[1]).to.deep.equal(
        new StackFrame(
          1001,
          'BarDebug.test()',
          new Source('foo.cls', Uri.parse(fileUri).fsPath),
          2,
          0
        )
      );
    });

    it('Should process stack frame with unknown source', async () => {
      stateSpy = sinon
        .stub(RequestService.prototype, 'execute')
        .returns(
          Promise.resolve(
            '{"stateResponse":{"state":{"stack":{"stackFrame":[{"typeRef":"anon","fullName":"anon.execute()","lineNumber":2,"frameNumber":0}]}}}}'
          )
        );

      await adapter.stackTraceRequest(
        {} as DebugProtocol.StackTraceResponse,
        { threadId: 1 } as DebugProtocol.StackTraceArguments
      );

      expect(stateSpy.called).to.equal(true);
      const response = adapter.getResponse(
        0
      ) as DebugProtocol.StackTraceResponse;
      expect(response.success).to.equal(true);
      const stackFrames = response.body.stackFrames;
      expect(stackFrames.length).to.equal(1);
      expect(stackFrames[0]).to.deep.equal(
        new StackFrame(1000, 'anon.execute()', undefined, 2, 0)
      );
    });

    it('Should handle state command error response', async () => {
      stateSpy = sinon
        .stub(RequestService.prototype, 'execute')
        .returns(
          Promise.reject(
            '{"message":"There was an error", "action":"Try again"}'
          )
        );

      await adapter.stackTraceRequest(
        {} as DebugProtocol.StackTraceResponse,
        { threadId: 1 } as DebugProtocol.StackTraceArguments
      );

      expect(adapter.getResponse(0).success).to.equal(false);
      expect(adapter.getResponse(0).message).to.equal(
        '{"message":"There was an error", "action":"Try again"}'
      );
      expect(stateSpy.called).to.equal(true);
    });
  });

  describe('Custom request', () => {
    describe('Line breakpoint info', () => {
      let setValidLinesSpy: sinon.SinonSpy;
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
        adapter = new ApexDebugForTest(
          new SessionService(),
          new StreamingService(),
          new BreakpointService(),
          new RequestService()
        );
        adapter.initializeReq(
          initializedResponse,
          {} as DebugProtocol.InitializeRequestArguments
        );
        setValidLinesSpy = sinon.spy(
          BreakpointService.prototype,
          'setValidLines'
        );
      });

      afterEach(() => {
        setValidLinesSpy.restore();
      });

      it('Should not save line number mapping', () => {
        adapter.customRequest(
          LINE_BREAKPOINT_INFO_REQUEST,
          {} as DebugProtocol.Response,
          null
        );

        expect(setValidLinesSpy.called).to.equal(false);
        expect(adapter.getResponse(0)).to.deep.equal(initializedResponse);
        expect(adapter.getResponse(1).success).to.equal(true);
      });

      it('Should save line number mapping', () => {
        const info: LineBreakpointInfo[] = [
          { uri: 'file:///foo.cls', typeref: 'foo', lines: [1, 2, 3] },
          { uri: 'file:///foo.cls', typeref: 'foo$inner', lines: [4, 5, 6] },
          { uri: 'file:///bar.cls', typeref: 'bar', lines: [1, 2, 3] },
          { uri: 'file:///bar.cls', typeref: 'bar$inner', lines: [4, 5, 6] }
        ];
        const expectedLineNumberMapping: Map<
          string,
          LineBreakpointsInTyperef[]
        > = new Map();
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

        adapter.customRequest(
          LINE_BREAKPOINT_INFO_REQUEST,
          {} as DebugProtocol.Response,
          info
        );

        expect(setValidLinesSpy.calledOnce).to.equal(true);
        expect(setValidLinesSpy.getCall(0).args.length).to.equal(2);
        expect(setValidLinesSpy.getCall(0).args[0]).to.deep.equal(
          expectedLineNumberMapping
        );
        expect(setValidLinesSpy.getCall(0).args[1]).to.deep.equal(
          expectedTyperefMapping
        );
        expect(adapter.getResponse(0)).to.deep.equal(initializedResponse);
        expect(adapter.getResponse(1).success).to.equal(true);
      });
    });

    describe('Hotswap warning', () => {
      beforeEach(() => {
        adapter = new ApexDebugForTest(
          new SessionService(),
          new StreamingService(),
          new BreakpointService(),
          new RequestService()
        );
      });

      it('Should log warning to debug console', () => {
        adapter.customRequest(
          HOTSWAP_REQUEST,
          {} as DebugProtocol.Response,
          undefined
        );

        expect(adapter.getEvents().length).to.equal(1);
        expect(adapter.getEvents()[0].event).to.equal('output');
        const outputEvent = adapter.getEvents()[0] as DebugProtocol.OutputEvent;
        expect(outputEvent.body.output).to.have.string(
          nls.localize('hotswap_warn_text')
        );
        expect(outputEvent.body.category).to.equal('console');
      });
    });

    describe('Workspace settings', () => {
      let requestService: RequestService;

      beforeEach(() => {
        requestService = new RequestService();
        adapter = new ApexDebugForTest(
          new SessionService(),
          new StreamingService(),
          new BreakpointService(),
          requestService
        );
      });

      it('Should save proxy settings', () => {
        adapter.customRequest(
          WORKSPACE_SETTINGS_REQUEST,
          {} as DebugProtocol.Response,
          {
            proxyUrl: 'http://localhost:443',
            proxyStrictSSL: false,
            proxyAuth: 'Basic 123'
          } as WorkspaceSettings
        );

        expect(requestService.proxyUrl).to.equal('http://localhost:443');
        expect(requestService.proxyStrictSSL).to.equal(false);
        expect(requestService.proxyAuthorization).to.equal('Basic 123');
        expect(requestService.connectionTimeoutMs).to.equal(
          DEFAULT_CONNECTION_TIMEOUT_MS
        );
      });

      it('Should save connection settings', () => {
        adapter.customRequest(
          WORKSPACE_SETTINGS_REQUEST,
          {} as DebugProtocol.Response,
          {
            connectionTimeoutMs: 60000
          } as WorkspaceSettings
        );

        // tslint:disable:no-unused-expression
        expect(requestService.proxyUrl).to.be.undefined;
        expect(requestService.proxyStrictSSL).to.be.undefined;
        expect(requestService.proxyAuthorization).to.be.undefined;
        expect(requestService.connectionTimeoutMs).to.equal(60000);
        // tslint:enable:no-unused-expression
      });
    });

    describe('Exception breakpoint request', () => {
      let lockSpy: sinon.SinonSpy;
      let reconcileExceptionBreakpointSpy: sinon.SinonStub;
      let sessionIdSpy: sinon.SinonStub;

      beforeEach(() => {
        adapter = new ApexDebugForTest(
          new SessionService(),
          new StreamingService(),
          new BreakpointService(),
          new RequestService()
        );
        adapter.setSfdxProject('someProjectPath');
        lockSpy = sinon.spy(AsyncLock.prototype, 'acquire');
        reconcileExceptionBreakpointSpy = sinon
          .stub(BreakpointService.prototype, 'reconcileExceptionBreakpoints')
          .returns(Promise.resolve());
        sessionIdSpy = sinon
          .stub(SessionService.prototype, 'getSessionId')
          .returns('07aFAKE');
      });

      afterEach(() => {
        lockSpy.restore();
        reconcileExceptionBreakpointSpy.restore();
        sessionIdSpy.restore();
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
        await adapter.customRequest(
          EXCEPTION_BREAKPOINT_REQUEST,
          {} as DebugProtocol.Response,
          requestArg
        );

        expect(lockSpy.calledOnce).to.equal(true);
        expect(lockSpy.getCall(0).args[0]).to.equal('exception-breakpoint');
        expect(reconcileExceptionBreakpointSpy.calledOnce).to.equal(true);
        expect(reconcileExceptionBreakpointSpy.getCall(0).args.length).to.equal(
          3
        );
        expect(reconcileExceptionBreakpointSpy.getCall(0).args[0]).to.equal(
          'someProjectPath'
        );
        expect(reconcileExceptionBreakpointSpy.getCall(0).args[1]).to.equal(
          '07aFAKE'
        );
        expect(
          reconcileExceptionBreakpointSpy.getCall(0).args[2]
        ).to.deep.equal(requestArg.exceptionInfo);
        expect(adapter.getEvents()[0].event).to.equal('output');
        expect(
          (adapter.getEvents()[0] as OutputEvent).body.output
        ).to.have.string(
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

        await adapter.customRequest(
          EXCEPTION_BREAKPOINT_REQUEST,
          {} as DebugProtocol.Response,
          requestArg
        );

        expect(lockSpy.calledOnce).to.equal(true);
        expect(lockSpy.getCall(0).args[0]).to.equal('exception-breakpoint');
        expect(reconcileExceptionBreakpointSpy.calledOnce).to.equal(true);
        expect(reconcileExceptionBreakpointSpy.getCall(0).args.length).to.equal(
          3
        );
        expect(reconcileExceptionBreakpointSpy.getCall(0).args[0]).to.equal(
          'someProjectPath'
        );
        expect(reconcileExceptionBreakpointSpy.getCall(0).args[1]).to.equal(
          '07aFAKE'
        );
        expect(
          reconcileExceptionBreakpointSpy.getCall(0).args[2]
        ).to.deep.equal(requestArg.exceptionInfo);
        expect(adapter.getEvents()[0].event).to.equal('output');
        expect(
          (adapter.getEvents()[0] as OutputEvent).body.output
        ).to.have.string(
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

        await adapter.customRequest(
          EXCEPTION_BREAKPOINT_REQUEST,
          {} as DebugProtocol.Response,
          requestArg
        );

        expect(lockSpy.calledOnce).to.equal(true);
        expect(lockSpy.getCall(0).args[0]).to.equal('exception-breakpoint');
        expect(reconcileExceptionBreakpointSpy.calledOnce).to.equal(true);
        expect(reconcileExceptionBreakpointSpy.getCall(0).args.length).to.equal(
          3
        );
        expect(reconcileExceptionBreakpointSpy.getCall(0).args[0]).to.equal(
          'someProjectPath'
        );
        expect(reconcileExceptionBreakpointSpy.getCall(0).args[1]).to.equal(
          '07aFAKE'
        );
        expect(
          reconcileExceptionBreakpointSpy.getCall(0).args[2]
        ).to.deep.equal(requestArg.exceptionInfo);
        expect(adapter.getEvents().length).to.equal(0);
      });

      it('Should not call breakpoint service with undefined request args', async () => {
        await adapter.customRequest(
          EXCEPTION_BREAKPOINT_REQUEST,
          {} as DebugProtocol.Response,
          undefined
        );

        expect(lockSpy.called).to.equal(false);
        expect(reconcileExceptionBreakpointSpy.called).to.equal(false);
      });

      it('Should not call breakpoint service with undefined exception info', async () => {
        await adapter.customRequest(
          EXCEPTION_BREAKPOINT_REQUEST,
          {} as DebugProtocol.Response,
          {} as SetExceptionBreakpointsArguments
        );

        expect(lockSpy.called).to.equal(false);
        expect(reconcileExceptionBreakpointSpy.called).to.equal(false);
      });
    });

    describe('List exception breakpoints', () => {
      let getExceptionBreakpointCacheSpy: sinon.SinonStub;
      const knownExceptionBreakpoints: Map<string, string> = new Map([
        ['fooexception', '07bFAKE1'],
        ['barexception', '07bFAKE2']
      ]);

      beforeEach(() => {
        adapter = new ApexDebugForTest(
          new SessionService(),
          new StreamingService(),
          new BreakpointService(),
          new RequestService()
        );
        getExceptionBreakpointCacheSpy = sinon
          .stub(BreakpointService.prototype, 'getExceptionBreakpointCache')
          .returns(knownExceptionBreakpoints);
      });

      afterEach(() => {
        getExceptionBreakpointCacheSpy.restore();
      });

      it('Should return list of breakpoint typerefs', async () => {
        await adapter.customRequest(
          LIST_EXCEPTION_BREAKPOINTS_REQUEST,
          {} as DebugProtocol.Response,
          undefined
        );

        expect(getExceptionBreakpointCacheSpy.calledOnce).to.equal(true);
        expect(adapter.getResponse(0).success).to.equal(true);
        expect(adapter.getResponse(0).body.typerefs).to.have.same.members([
          'fooexception',
          'barexception'
        ]);
      });
    });
  });

  describe('Logging', () => {
    let breakpointService: BreakpointService;
    const lineNumberMapping: Map<
      string,
      LineBreakpointsInTyperef[]
    > = new Map();
    const typerefMapping: Map<string, string> = new Map();
    const fooUri = 'file:///foo.cls';
    lineNumberMapping.set(fooUri, [
      { typeref: 'foo', lines: [1, 2] },
      { typeref: 'foo$inner', lines: [3, 4] }
    ]);
    lineNumberMapping.set('file:///bar.cls', [
      { typeref: 'bar', lines: [3, 4] }
    ]);
    typerefMapping.set('foo', fooUri);
    typerefMapping.set('foo$inner', fooUri);
    typerefMapping.set('bar', 'file:///bar.cls');

    beforeEach(() => {
      breakpointService = new BreakpointService();
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        breakpointService,
        new RequestService()
      );
      breakpointService.setValidLines(lineNumberMapping, typerefMapping);
    });

    it('Should not log without an error', () => {
      adapter.tryToParseSfdxError({} as DebugProtocol.Response);

      expect(adapter.getEvents().length).to.equal(0);
    });

    it('Should error to console with unexpected error schema', () => {
      adapter.tryToParseSfdxError(
        {} as DebugProtocol.Response,
        '{"subject":"There was an error", "action":"Try again"}'
      );

      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(
        (adapter.getEvents()[0] as OutputEvent).body.output
      ).to.have.string(
        '{"subject":"There was an error", "action":"Try again"}'
      );
    });

    it('Should error to console with non JSON', () => {
      adapter.tryToParseSfdxError(
        {} as DebugProtocol.Response,
        'There was an error"}'
      );

      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(
        (adapter.getEvents()[0] as OutputEvent).body.output
      ).to.have.string('There was an error');
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
      expect(adapter.getEvents()[0].event).to.equal('output');
      const outputEvent = adapter.getEvents()[0] as DebugProtocol.OutputEvent;
      expect(outputEvent.body.output).to.have.string(
        `${msg.event.createdDate} | ${msg.sobject.Type} | Request: ${msg.sobject
          .RequestId} | Breakpoint: ${msg.sobject.BreakpointId} | Line: ${msg
          .sobject.Line} | ${msg.sobject.Description} |${os.EOL}${msg.sobject
          .Stacktrace}`
      );
      expect(outputEvent.body.source!.path).to.equal(Uri.parse(fooUri).fsPath);
      expect(outputEvent.body.line).to.equal(4);
    });
  });

  describe('Streaming', () => {
    let streamingSubscribeSpy: sinon.SinonStub;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService(),
        new RequestService()
      );
      streamingSubscribeSpy = sinon
        .stub(StreamingService.prototype, 'subscribe')
        .returns(Promise.resolve());
    });

    afterEach(() => {
      streamingSubscribeSpy.restore();
    });

    it('Should call streaming service subscribe', () => {
      adapter.connectStreaming('foo', 'https://www.salesforce.com', '123');

      expect(streamingSubscribeSpy.calledOnce).to.equal(true);
      expect(streamingSubscribeSpy.getCall(0).args.length).to.equal(5);
      expect(streamingSubscribeSpy.getCall(0).args[0]).to.equal('foo');
      expect(streamingSubscribeSpy.getCall(0).args[1]).to.equal(
        'https://www.salesforce.com'
      );
      expect(streamingSubscribeSpy.getCall(0).args[2]).to.equal('123');
      for (const index of [3, 4]) {
        const obj = streamingSubscribeSpy.getCall(0).args[index];
        expect(obj).to.be.instanceof(StreamingClientInfo);
        const clientInfo = obj as StreamingClientInfo;
        expect(clientInfo.channel).to.be.oneOf([
          StreamingService.SYSTEM_EVENT_CHANNEL,
          StreamingService.USER_EVENT_CHANNEL
        ]);
        // tslint:disable:no-unused-expression
        expect(clientInfo.connectedHandler).to.not.be.undefined;
        expect(clientInfo.disconnectedHandler).to.not.be.undefined;
        expect(clientInfo.errorHandler).to.not.be.undefined;
        expect(clientInfo.messageHandler).to.not.be.undefined;
        // tslint:enable:no-unused-expression
      }
    });
  });

  describe('Debugger events', () => {
    let sessionConnectedSpy: sinon.SinonStub;
    let sessionIdSpy: sinon.SinonStub;
    let sessionStopSpy: sinon.SinonSpy;
    let eventProcessedSpy: sinon.SinonStub;
    let markEventProcessedSpy: sinon.SinonSpy;
    let getExceptionBreakpointCacheSpy: sinon.SinonStub;
    const knownExceptionBreakpoints: Map<string, string> = new Map([
      [`${SALESFORCE_EXCEPTION_PREFIX}AssertException`, '07bFAKE1'],
      ['namespace/fooexception', '07bFAKE2'],
      ['namespace/MyClass$InnerException', '07bFAKE3'],
      [
        `${TRIGGER_EXCEPTION_PREFIX}namespace/MyTrigger$InnerException`,
        '07bFAKE4'
      ]
    ]);

    beforeEach(() => {
      getExceptionBreakpointCacheSpy = sinon
        .stub(BreakpointService.prototype, 'getExceptionBreakpointCache')
        .returns(knownExceptionBreakpoints);
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService(),
        new RequestService()
      );
      sessionStopSpy = sinon.spy(SessionService.prototype, 'forceStop');
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(true);
      sessionIdSpy = sinon
        .stub(SessionService.prototype, 'getSessionId')
        .returns('07aFAKE');
      eventProcessedSpy = sinon
        .stub(StreamingService.prototype, 'hasProcessedEvent')
        .returns(false);
      markEventProcessedSpy = sinon.spy(
        StreamingService.prototype,
        'markEventProcessed'
      );
    });

    afterEach(() => {
      sessionConnectedSpy.restore();
      sessionIdSpy.restore();
      sessionStopSpy.restore();
      eventProcessedSpy.restore();
      markEventProcessedSpy.restore();
      getExceptionBreakpointCacheSpy.restore();
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

      expect(sessionStopSpy.calledOnce).to.equal(true);
      expect(adapter.getEvents().length).to.equal(3);
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(
        (adapter.getEvents()[0] as OutputEvent).body.output
      ).to.have.string('foo');
      expect(adapter.getEvents()[1].event).to.equal(SHOW_MESSAGE_EVENT);
      const showMessageEvent = adapter.getEvents()[1] as DebugProtocol.Event;
      expect(showMessageEvent.body).to.deep.equal({
        type: VscodeDebuggerMessageType.Error,
        message: 'foo'
      } as VscodeDebuggerMessage);
      expect(adapter.getEvents()[2].event).to.equal('terminated');
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

      expect(sessionStopSpy.called).to.equal(false);
      expect(adapter.getEvents().length).to.equal(0);
    });

    it('[SessionTerminated] - Should not stop session service if it is not connected', () => {
      sessionConnectedSpy.restore();
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(false);
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '07aFAKE',
          Type: 'SessionTerminated',
          Description: 'foo'
        }
      };

      adapter.handleEvent(message);

      expect(sessionStopSpy.called).to.equal(false);
      expect(adapter.getEvents().length).to.equal(0);
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

      expect(adapter.getRequestThreads().size).to.equal(1);
      expect(adapter.getRequestThreads().get(1)).to.equal('07cFAKE');
      expect(adapter.getEvents().length).to.equal(1);
      expect(adapter.getEvents()[0].event).to.equal('output');
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
      const variableReference = adapter.createVariableContainer(
        new DummyContainer(variables)
      );
      adapter.getVariableContainerReferenceByApexId().set(0, variableReference);
      const frameInfo = new ApexDebugStackFrameInfo('07cFAKE1', 0);
      const frameId = adapter.createStackFrameInfo(frameInfo);

      adapter.handleEvent(message);

      expect(adapter.getRequestThreads().size).to.equal(1);
      expect(adapter.getEvents().length).to.equal(2);
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(adapter.getEvents()[1].event).to.equal('thread');
      const threadEvent = adapter.getEvents()[1] as ThreadEvent;
      expect(threadEvent.body.reason).to.equal('exited');
      expect(threadEvent.body.threadId).to.equal(1);
      // tslint:disable:no-unused-expression
      expect(adapter.getVariableContainer(variableReference)).to.not.be
        .undefined;
      expect(adapter.getStackFrameInfo(frameId)).to.not.be.undefined;
      // tslint:enable:no-unused-expression
      expect(adapter.getVariableContainerReferenceByApexId().has(0)).to.equal(
        true
      );
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

      expect(adapter.getRequestThreads().size).to.equal(1);
      expect(adapter.getEvents().length).to.equal(0);
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
      const variableReference = adapter.createVariableContainer(
        new DummyContainer(variables)
      );
      adapter.getVariableContainerReferenceByApexId().set(0, variableReference);
      const frameInfo = new ApexDebugStackFrameInfo('07cFAKE1', 0);
      const frameId = adapter.createStackFrameInfo(frameInfo);

      adapter.handleEvent(message);

      expect(adapter.getRequestThreads().size).to.equal(0);
      expect(adapter.getEvents().length).to.equal(2);
      // tslint:disable:no-unused-expression
      expect(adapter.getVariableContainer(variableReference)).to.be.undefined;
      expect(adapter.getStackFrameInfo(frameId)).to.be.undefined;
      // tslint:enable:no-unused-expression
      expect(adapter.getVariableContainerReferenceByApexId().has(0)).to.equal(
        false
      );
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

      expect(adapter.getRequestThreads().size).to.equal(1);
      expect(adapter.getEvents().length).to.equal(1);
      expect(adapter.getEvents()[0].event).to.equal('output');
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

      expect(adapter.getRequestThreads().size).to.equal(1);
      expect(adapter.getEvents().length).to.equal(0);
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
      const variableReference = adapter.createVariableContainer(
        new DummyContainer(variables)
      );
      adapter.getVariableContainerReferenceByApexId().set(0, variableReference);
      const frameInfo = new ApexDebugStackFrameInfo('07cFAKE', 0);
      const frameId = adapter.createStackFrameInfo(frameInfo);

      adapter.handleEvent(message);

      expect(adapter.getRequestThreads().size).to.equal(1);
      expect(adapter.getEvents().length).to.equal(2);
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(adapter.getEvents()[1].event).to.equal('stopped');
      const stoppedEvent = adapter.getEvents()[1] as StoppedEvent;
      expect(stoppedEvent.body).to.deep.equal({
        threadId: 1,
        reason: ''
      });
      expect(markEventProcessedSpy.calledOnce).to.equal(true);
      expect(markEventProcessedSpy.getCall(0).args).to.have.same.members([
        ApexDebuggerEventType.Stopped,
        0
      ]);
      // tslint:disable:no-unused-expression
      expect(adapter.getVariableContainer(variableReference)).to.be.undefined;
      expect(adapter.getStackFrameInfo(frameId)).to.be.undefined;
      // tslint:enable:no-unused-expression
      expect(adapter.getVariableContainerReferenceByApexId().has(0)).to.equal(
        false
      );
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
      expect(stoppedEvent.body).to.deep.equal({
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
      expect(stoppedEvent.body).to.deep.equal({
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
      expect(stoppedEvent.body).to.deep.equal({
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
      expect(stoppedEvent.body).to.deep.equal({
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

      expect(adapter.getRequestThreads().size).to.equal(1);
      expect(adapter.getEvents().length).to.equal(2);
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(adapter.getEvents()[1].event).to.equal('stopped');
      const threadEvent = adapter.getEvents()[1] as StoppedEvent;
      expect(threadEvent.body.reason).to.equal('');
      expect(threadEvent.body.threadId).to.equal(1);
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

      expect(
        adapter.getRequestThreads().size,
        'must have no registered request thread'
      ).to.equal(0);
      expect(
        adapter.getEvents().length,
        'must not handle an event without a request id'
      ).to.equal(0);
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
      const variableReference = adapter.createVariableContainer(
        new DummyContainer(variables)
      );
      adapter.getVariableContainerReferenceByApexId().set(0, variableReference);
      const frameInfo = new ApexDebugStackFrameInfo('07cFAKE2', 0);
      const frameId = adapter.createStackFrameInfo(frameInfo);

      adapter.handleEvent(message);

      expect(adapter.getRequestThreads().size).to.equal(2);
      expect(adapter.getEvents().length).to.equal(2);
      // tslint:disable:no-unused-expression
      expect(adapter.getVariableContainer(variableReference)).to.not.be
        .undefined;
      expect(adapter.getStackFrameInfo(frameId)).to.not.be.undefined;
      // tslint:enable:no-unused-expression
      expect(adapter.getVariableContainerReferenceByApexId().has(0)).to.equal(
        true
      );
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

      expect(adapter.getEvents().length).to.equal(2);
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(adapter.getEvents()[1].event).to.equal(SHOW_MESSAGE_EVENT);
      const showMessageEvent = adapter.getEvents()[1] as DebugProtocol.Event;
      expect(showMessageEvent.body).to.deep.equal({
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

      expect(adapter.getEvents().length).to.equal(1);
      expect(adapter.getEvents()[0].event).to.equal('output');
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

      expect(adapter.getEvents().length).to.equal(2);
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(adapter.getEvents()[1].event).to.equal(SHOW_MESSAGE_EVENT);
      const showMessageEvent = adapter.getEvents()[1] as DebugProtocol.Event;
      expect(showMessageEvent.body).to.deep.equal({
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

      expect(adapter.getEvents().length).to.equal(1);
      expect(adapter.getEvents()[0].event).to.equal('output');
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

      expect(adapter.getEvents().length).to.equal(1);
      expect(adapter.getEvents()[0].event).to.equal('output');
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

      expect(adapter.getEvents().length).to.equal(1);
      expect(adapter.getEvents()[0].event).to.equal('output');
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

      expect(adapter.getEvents().length).to.equal(1);
      expect(adapter.getEvents()[0].event).to.equal('output');
    });
  });
});
