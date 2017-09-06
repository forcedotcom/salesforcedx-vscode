/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

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
import { LaunchRequestArguments } from '../../../src/adapter/apexDebug';
import {
  LineBreakpointInfo,
  LineBreakpointsInTyperef
} from '../../../src/breakpoints/lineBreakpoint';
import {
  ForceOrgDisplay,
  OrgInfo,
  RunCommand,
  StateCommand,
  StepIntoCommand,
  StepOutCommand,
  StepOverCommand
} from '../../../src/commands';
import {
  GET_LINE_BREAKPOINT_INFO_EVENT,
  LINE_BREAKPOINT_INFO_REQUEST,
  SHOW_MESSAGE_EVENT
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
  VscodeDebuggerMessageType
} from '../../../src/index';
import { nls } from '../../../src/messages';
import { ApexDebugForTest } from './apexDebugForTest';

describe('Debugger adapter - unit', () => {
  let adapter: ApexDebugForTest;

  describe('Initialize', () => {
    let breakpointClearSpy: sinon.SinonSpy;
    let response: DebugProtocol.InitializeResponse;
    let args: DebugProtocol.InitializeRequestArguments;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService()
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
    });

    afterEach(() => {
      breakpointClearSpy.restore();
    });

    it('Should only send custom event to fetch breakpoint info', async () => {
      adapter.initializeReq(response, args);

      expect(breakpointClearSpy.calledOnce).to.equal(true);
      expect(adapter.getEvents().length).to.equal(1);
      expect(adapter.getEvents()[0].event).to.equal(
        GET_LINE_BREAKPOINT_INFO_EVENT
      );
    });
  });

  describe('Attach', () => {
    let response: DebugProtocol.AttachResponse;
    let args: DebugProtocol.AttachRequestArguments;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService()
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
    let sessionProjectSpy: sinon.SinonSpy;
    let sessionUserFilterSpy: sinon.SinonSpy;
    let sessionEntryFilterSpy: sinon.SinonSpy;
    let sessionRequestFilterSpy: sinon.SinonSpy;
    let sessionConnectedSpy: sinon.SinonStub;
    let breakpointHasLineNumberMappingSpy: sinon.SinonStub;
    let streamingSubscribeSpy: sinon.SinonStub;
    let orgInfoSpy: sinon.SinonStub;
    let response: DebugProtocol.LaunchResponse;
    let args: LaunchRequestArguments;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService()
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
        userIdFilter: 'user',
        entryPointFilter: 'entry',
        requestTypeFilter: 'request'
      };
    });

    afterEach(() => {
      sessionStartSpy.restore();
      sessionProjectSpy.restore();
      sessionUserFilterSpy.restore();
      sessionEntryFilterSpy.restore();
      sessionRequestFilterSpy.restore();
      sessionConnectedSpy.restore();
      streamingSubscribeSpy.restore();
      breakpointHasLineNumberMappingSpy.restore();
      orgInfoSpy.restore();
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
    });
  });

  describe('Disconnect', () => {
    let sessionStopSpy: sinon.SinonStub;
    let sessionConnectedSpy: sinon.SinonStub;
    let streamingDisconnectSpy: sinon.SinonStub;
    let breakpointClearSpy: sinon.SinonSpy;
    let response: DebugProtocol.DisconnectResponse;
    let args: DebugProtocol.DisconnectArguments;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService()
      );
      streamingDisconnectSpy = sinon.stub(
        StreamingService.prototype,
        'disconnect'
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
      args = {};
    });

    afterEach(() => {
      if (sessionStopSpy) {
        sessionStopSpy.restore();
      }
      sessionConnectedSpy.restore();
      streamingDisconnectSpy.restore();
      breakpointClearSpy.restore();
    });

    it('Should not use session service if not connected', async () => {
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(false);

      await adapter.disconnectReq(response, args);

      expect(adapter.getResponse(0)).to.deep.equal(response);
      expect(streamingDisconnectSpy.calledOnce).to.equal(true);
      expect(breakpointClearSpy.called).to.equal(false);
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
    });
  });

  describe('Line breakpoint request', () => {
    let breakpointReconcileSpy: sinon.SinonStub;
    let breakpointGetSpy: sinon.SinonSpy;
    let breakpointGetTyperefSpy: sinon.SinonStub;
    let breakpointCreateSpy: sinon.SinonStub;
    let breakpointCacheSpy: sinon.SinonSpy;
    let sessionIdSpy: sinon.SinonStub;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService()
      );
      breakpointGetSpy = sinon.spy(
        BreakpointService.prototype,
        'getBreakpointsFor'
      );
      breakpointCacheSpy = sinon.spy(
        BreakpointService.prototype,
        'cacheBreakpoint'
      );
      sessionIdSpy = sinon
        .stub(SessionService.prototype, 'getSessionId')
        .returns('07aFAKE');
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
    });

    it('Should create breakpoint', async () => {
      const breakpointId = '07bFAKE';
      const bpLines = [1, 2];
      breakpointReconcileSpy = sinon
        .stub(BreakpointService.prototype, 'reconcileBreakpoints')
        .returns(Promise.resolve(bpLines));
      breakpointGetTyperefSpy = sinon
        .stub(BreakpointService.prototype, 'getTyperefFor')
        .returns('namespace/foo$inner');
      breakpointCreateSpy = sinon
        .stub(BreakpointService.prototype, 'createLineBreakpoint')
        .returns(breakpointId);
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

      expect(breakpointReconcileSpy.calledOnce).to.equal(true);
      expect(breakpointReconcileSpy.getCall(0).args).to.deep.equal([
        'someProjectPath',
        '07aFAKE',
        'file:///foo.cls',
        bpLines
      ]);
      expect(breakpointGetSpy.calledOnce).to.equal(true);
      expect(breakpointGetSpy.getCall(0).args).to.have.same.members([
        'file:///foo.cls'
      ]);
      expect(breakpointGetTyperefSpy.calledTwice).to.equal(true);
      expect(breakpointCreateSpy.calledTwice).to.equal(true);
      expect(breakpointCacheSpy.calledTwice).to.equal(true);

      for (let i = 0; i < bpLines.length; i++) {
        expect(breakpointGetTyperefSpy.getCall(i).args).to.have.same.members([
          'file:///foo.cls',
          bpLines[i]
        ]);
        expect(breakpointCreateSpy.getCall(i).args).to.have.same.members([
          'someProjectPath',
          '07aFAKE',
          'namespace/foo$inner',
          bpLines[i]
        ]);
        expect(breakpointCacheSpy.getCall(i).args).to.have.same.members([
          'file:///foo.cls',
          bpLines[i],
          '07bFAKE'
        ]);
      }

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
              verified: true,
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

    it('Should not create breakpoint', async () => {
      const bpLines = [1, 2];
      breakpointReconcileSpy = sinon
        .stub(BreakpointService.prototype, 'reconcileBreakpoints')
        .returns(Promise.resolve(bpLines));
      breakpointGetTyperefSpy = sinon
        .stub(BreakpointService.prototype, 'getTyperefFor')
        .returns('');
      breakpointCreateSpy = sinon.stub(
        BreakpointService.prototype,
        'createLineBreakpoint'
      );
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

      expect(breakpointReconcileSpy.calledOnce).to.equal(true);
      expect(breakpointReconcileSpy.getCall(0).args).to.deep.equal([
        'someProjectPath',
        '07aFAKE',
        'file:///foo.cls',
        bpLines
      ]);
      expect(breakpointGetTyperefSpy.calledTwice).to.equal(true);
      expect(breakpointCreateSpy.called).to.equal(false);
      expect(breakpointCacheSpy.called).to.equal(false);

      for (let i = 0; i < bpLines.length; i++) {
        expect(breakpointGetTyperefSpy.getCall(i).args).to.have.same.members([
          'file:///foo.cls',
          bpLines[i]
        ]);
      }

      const expectedResp = {
        success: true,
        body: {
          breakpoints: [
            {
              verified: false,
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

    it('Should output error', async () => {
      const bpLines = [1, 2];
      breakpointReconcileSpy = sinon
        .stub(BreakpointService.prototype, 'reconcileBreakpoints')
        .returns(
          Promise.reject(
            '{"message":"There was an error", "action":"Try again"}'
          )
        );
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

      expect(breakpointReconcileSpy.calledOnce).to.equal(true);
      expect(breakpointReconcileSpy.getCall(0).args).to.deep.equal([
        'someProjectPath',
        '07aFAKE',
        'file:///foo.cls',
        bpLines
      ]);
      expect(adapter.getResponse(0).success).to.equal(false);
      expect(adapter.getResponse(0).message).to.equal('There was an error');
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(
        (adapter.getEvents()[0] as OutputEvent).body.output
      ).to.have.string('Try again');
    });
  });

  describe('Continue request', () => {
    let runSpy: sinon.SinonStub;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService()
      );
      adapter.setSfdxProject('someProjectPath');
      adapter.setOrgInfo({
        instanceUrl: 'https://www.salesforce.com',
        accessToken: '123'
      } as OrgInfo);
      adapter.addRequestThread('07cFAKE');
    });

    afterEach(() => {
      runSpy.restore();
    });

    it('Should continue successfully', async () => {
      runSpy = sinon
        .stub(RunCommand.prototype, 'execute')
        .returns(Promise.resolve(''));

      await adapter.continueReq(
        {} as DebugProtocol.ContinueResponse,
        { threadId: 0 } as DebugProtocol.ContinueArguments
      );

      expect(adapter.getResponse(0).success).to.equal(true);
      expect(adapter.getResponse(0).body.allThreadsContinued).to.equal(false);
      expect(runSpy.calledOnce).to.equal(true);
    });

    it('Should not continue unknown thread', async () => {
      runSpy = sinon
        .stub(RunCommand.prototype, 'execute')
        .returns(Promise.resolve(''));

      await adapter.continueReq(
        {} as DebugProtocol.ContinueResponse,
        { threadId: 1 } as DebugProtocol.ContinueArguments
      );

      expect(adapter.getResponse(0).success).to.equal(false);
      expect(runSpy.called).to.equal(false);
    });

    it('Should handle run command error response', async () => {
      runSpy = sinon
        .stub(RunCommand.prototype, 'execute')
        .returns(
          Promise.reject(
            '{"message":"There was an error", "action":"Try again"}'
          )
        );

      await adapter.continueReq(
        {} as DebugProtocol.ContinueResponse,
        { threadId: 0 } as DebugProtocol.ContinueArguments
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
        new BreakpointService()
      );
      adapter.setSfdxProject('someProjectPath');
      adapter.setOrgInfo({
        instanceUrl: 'https://www.salesforce.com',
        accessToken: '123'
      } as OrgInfo);
      adapter.addRequestThread('07cFAKE');
    });

    afterEach(() => {
      stepSpy.restore();
    });

    it('Step into should call proper command', async () => {
      stepSpy = sinon
        .stub(StepIntoCommand.prototype, 'execute')
        .returns(Promise.resolve(''));

      await adapter.stepInRequest(
        {} as DebugProtocol.StepInResponse,
        { threadId: 0 } as DebugProtocol.StepInArguments
      );

      expect(adapter.getResponse(0).success).to.equal(true);
      expect(stepSpy.calledOnce).to.equal(true);
    });

    it('Step out should send proper command', async () => {
      stepSpy = sinon
        .stub(StepOutCommand.prototype, 'execute')
        .returns(Promise.resolve(''));

      await adapter.stepOutRequest(
        {} as DebugProtocol.StepOutResponse,
        { threadId: 0 } as DebugProtocol.StepOutArguments
      );

      expect(adapter.getResponse(0).success).to.equal(true);
      expect(stepSpy.calledOnce).to.equal(true);
    });

    it('Step over should send proper command', async () => {
      stepSpy = sinon
        .stub(StepOverCommand.prototype, 'execute')
        .returns(Promise.resolve(''));

      await adapter.nextRequest(
        {} as DebugProtocol.NextResponse,
        { threadId: 0 } as DebugProtocol.NextArguments
      );

      expect(adapter.getResponse(0).success).to.equal(true);
      expect(stepSpy.calledOnce).to.equal(true);
    });
  });

  describe('Threads request', () => {
    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService()
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
        { id: 0, name: 'Request ID: 07cFAKE1' },
        { id: 1, name: 'Request ID: 07cFAKE2' }
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

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService()
      );
      adapter.setSfdxProject('someProjectPath');
      adapter.setOrgInfo({
        instanceUrl: 'https://www.salesforce.com',
        accessToken: '123'
      } as OrgInfo);
      adapter.addRequestThread('07cFAKE');
    });

    afterEach(() => {
      stateSpy.restore();
      if (sourcePathSpy) {
        sourcePathSpy.restore();
      }
    });

    it('Should not get state of unknown thread', async () => {
      stateSpy = sinon
        .stub(StateCommand.prototype, 'execute')
        .returns(Promise.resolve('{}'));

      await adapter.stackTraceReq(
        {} as DebugProtocol.StackTraceResponse,
        { threadId: 1 } as DebugProtocol.StackTraceArguments
      );

      expect(adapter.getResponse(0).success).to.equal(false);
      expect(stateSpy.called).to.equal(false);
    });

    it('Should return response with empty stackframes', async () => {
      stateSpy = sinon
        .stub(StateCommand.prototype, 'execute')
        .returns(
          Promise.resolve(
            '{"stateResponse":{"state":{"stack":{"stackFrame":[]}}}}'
          )
        );

      await adapter.stackTraceReq(
        {} as DebugProtocol.StackTraceResponse,
        { threadId: 0 } as DebugProtocol.StackTraceArguments
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
        .stub(StateCommand.prototype, 'execute')
        .returns(
          Promise.resolve(
            '{"stateResponse":{"state":{"stack":{"stackFrame":[{"typeRef":"FooDebug","fullName":"FooDebug.test()","lineNumber":1,"frameNumber":0},{"typeRef":"BarDebug","fullName":"BarDebug.test()","lineNumber":2,"frameNumber":1}]}}}}'
          )
        );
      sourcePathSpy = sinon
        .stub(BreakpointService.prototype, 'getSourcePathFromTyperef')
        .returns('file:///foo.cls');

      await adapter.stackTraceReq(
        {} as DebugProtocol.StackTraceResponse,
        { threadId: 0 } as DebugProtocol.StackTraceArguments
      );

      expect(stateSpy.called).to.equal(true);
      const response = adapter.getResponse(
        0
      ) as DebugProtocol.StackTraceResponse;
      expect(response.success).to.equal(true);
      const stackFrames = response.body.stackFrames;
      expect(stackFrames.length).to.equal(2);
      expect(stackFrames[0]).to.deep.equal(
        new StackFrame(
          0,
          'FooDebug.test()',
          new Source('foo.cls', '/foo.cls'),
          1,
          0
        )
      );
      expect(stackFrames[1]).to.deep.equal(
        new StackFrame(
          1,
          'BarDebug.test()',
          new Source('foo.cls', '/foo.cls'),
          2,
          0
        )
      );
    });

    it('Should process stack frame with unknown source', async () => {
      stateSpy = sinon
        .stub(StateCommand.prototype, 'execute')
        .returns(
          Promise.resolve(
            '{"stateResponse":{"state":{"stack":{"stackFrame":[{"typeRef":"anon","fullName":"anon.execute()","lineNumber":2,"frameNumber":0}]}}}}'
          )
        );

      await adapter.stackTraceReq(
        {} as DebugProtocol.StackTraceResponse,
        { threadId: 0 } as DebugProtocol.StackTraceArguments
      );

      expect(stateSpy.called).to.equal(true);
      const response = adapter.getResponse(
        0
      ) as DebugProtocol.StackTraceResponse;
      expect(response.success).to.equal(true);
      const stackFrames = response.body.stackFrames;
      expect(stackFrames.length).to.equal(1);
      expect(stackFrames[0]).to.deep.equal(
        new StackFrame(0, 'anon.execute()', undefined, 2, 0)
      );
    });

    it('Should handle state command error response', async () => {
      stateSpy = sinon
        .stub(StateCommand.prototype, 'execute')
        .returns(
          Promise.reject(
            '{"message":"There was an error", "action":"Try again"}'
          )
        );

      await adapter.stackTraceReq(
        {} as DebugProtocol.StackTraceResponse,
        { threadId: 0 } as DebugProtocol.StackTraceArguments
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
          supportsDelayedStackTraceLoading: false
        }
      } as DebugProtocol.InitializeResponse;

      beforeEach(() => {
        adapter = new ApexDebugForTest(
          new SessionService(),
          new StreamingService(),
          new BreakpointService()
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
  });

  describe('Logging', () => {
    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService()
      );
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
          Type: 'Stopped',
          Line: 5,
          Description: 'Request was stopped'
        }
      };

      adapter.logEvent(msg);
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(
        (adapter.getEvents()[0] as OutputEvent).body.output
      ).to.have.string(
        `${msg.event.createdDate} | ${msg.sobject.Type} | Request: ${msg.sobject
          .RequestId} | Breakpoint: ${msg.sobject.BreakpointId} | Line: ${msg
          .sobject.Line} | Request was stopped`
      );
    });
  });

  describe('Streaming', () => {
    let streamingSubscribeSpy: sinon.SinonStub;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService()
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

  describe('Debugger event SessionTerminated', () => {
    let sessionConnectedSpy: sinon.SinonStub;
    let sessionIdSpy: sinon.SinonStub;
    let sessionStopSpy: sinon.SinonSpy;
    let eventProcessedSpy: sinon.SinonStub;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService()
      );
      sessionStopSpy = sinon.spy(SessionService.prototype, 'forceStop');
    });

    afterEach(() => {
      sessionConnectedSpy.restore();
      sessionIdSpy.restore();
      sessionStopSpy.restore();
      eventProcessedSpy.restore();
    });

    it('Should stop session service', () => {
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(true);
      sessionIdSpy = sinon
        .stub(SessionService.prototype, 'getSessionId')
        .returns('123');
      eventProcessedSpy = sinon
        .stub(StreamingService.prototype, 'hasProcessedEvent')
        .returns(false);
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '123',
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

    it('Should not stop session service if session IDs do not match', () => {
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(true);
      sessionIdSpy = sinon
        .stub(SessionService.prototype, 'getSessionId')
        .returns('123');
      eventProcessedSpy = sinon
        .stub(StreamingService.prototype, 'hasProcessedEvent')
        .returns(false);
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

    it('Should not stop session service if it is not connected', () => {
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(false);
      sessionIdSpy = sinon
        .stub(SessionService.prototype, 'getSessionId')
        .returns('123');
      eventProcessedSpy = sinon
        .stub(StreamingService.prototype, 'hasProcessedEvent')
        .returns(false);
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '123',
          Type: 'SessionTerminated',
          Description: 'foo'
        }
      };

      adapter.handleEvent(message);

      expect(sessionStopSpy.called).to.equal(false);
      expect(adapter.getEvents().length).to.equal(0);
    });
  });

  describe('Debugger event RequestStarted', () => {
    let sessionConnectedSpy: sinon.SinonStub;
    let sessionIdSpy: sinon.SinonStub;
    let eventProcessedSpy: sinon.SinonStub;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService()
      );
      eventProcessedSpy = sinon
        .stub(StreamingService.prototype, 'hasProcessedEvent')
        .returns(false);
    });

    afterEach(() => {
      sessionConnectedSpy.restore();
      sessionIdSpy.restore();
      eventProcessedSpy.restore();
    });

    it('Should create new request thread', () => {
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(true);
      sessionIdSpy = sinon
        .stub(SessionService.prototype, 'getSessionId')
        .returns('123');
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '123',
          Type: 'RequestStarted',
          RequestId: '07cFAKE'
        }
      };

      adapter.handleEvent(message);

      expect(adapter.getRequestThreads().length).to.equal(1);
      expect(adapter.getRequestThreads()[0]).to.equal('07cFAKE');
      expect(adapter.getEvents().length).to.equal(1);
      expect(adapter.getEvents()[0].event).to.equal('output');
    });
  });

  describe('Debugger event RequestFinished', () => {
    let sessionConnectedSpy: sinon.SinonStub;
    let sessionIdSpy: sinon.SinonStub;
    let eventProcessedSpy: sinon.SinonStub;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService()
      );
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(true);
      sessionIdSpy = sinon
        .stub(SessionService.prototype, 'getSessionId')
        .returns('123');
      eventProcessedSpy = sinon
        .stub(StreamingService.prototype, 'hasProcessedEvent')
        .returns(false);
    });

    afterEach(() => {
      sessionConnectedSpy.restore();
      sessionIdSpy.restore();
      eventProcessedSpy.restore();
    });

    it('Should delete request thread', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '123',
          Type: 'RequestFinished',
          RequestId: '07cFAKE1'
        }
      };
      adapter.addRequestThread('07cFAKE1');
      adapter.addRequestThread('07cFAKE2');

      adapter.handleEvent(message);

      expect(adapter.getRequestThreads().length).to.equal(1);
      expect(adapter.getEvents().length).to.equal(3);
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(adapter.getEvents()[1].event).to.equal('thread');
      const threadEvent = adapter.getEvents()[1] as ThreadEvent;
      expect(threadEvent.body.reason).to.equal('exited');
      expect(threadEvent.body.threadId).to.equal(0);
      expect(adapter.getEvents()[2].event).to.equal('stopped');
      const stoppedEvent = adapter.getEvents()[2] as StoppedEvent;
      expect(stoppedEvent.body).to.deep.equal({
        threadId: 0,
        reason: 'breakpoint'
      });
    });

    it('Should not handle unknown request', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '123',
          Type: 'RequestFinished',
          RequestId: '07cFAKE123'
        }
      };
      adapter.addRequestThread('07cFAKE');

      adapter.handleEvent(message);

      expect(adapter.getRequestThreads().length).to.equal(1);
      expect(adapter.getEvents().length).to.equal(0);
    });
  });

  describe('Debugger event Resumed', () => {
    let sessionConnectedSpy: sinon.SinonStub;
    let sessionIdSpy: sinon.SinonStub;
    let eventProcessedSpy: sinon.SinonStub;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService()
      );
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(true);
      sessionIdSpy = sinon
        .stub(SessionService.prototype, 'getSessionId')
        .returns('123');
      eventProcessedSpy = sinon
        .stub(StreamingService.prototype, 'hasProcessedEvent')
        .returns(false);
    });

    afterEach(() => {
      sessionConnectedSpy.restore();
      sessionIdSpy.restore();
      eventProcessedSpy.restore();
    });

    it('Should send continued event', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '123',
          Type: 'Resumed',
          RequestId: '07cFAKE'
        }
      };
      adapter.addRequestThread('07cFAKE');

      adapter.handleEvent(message);

      expect(adapter.getRequestThreads().length).to.equal(1);
      expect(adapter.getEvents().length).to.equal(1);
      expect(adapter.getEvents()[0].event).to.equal('output');
    });

    it('Should not handle unknown request', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '123',
          Type: 'Resumed',
          RequestId: '07cFAKE123'
        }
      };
      adapter.addRequestThread('07cFAKE');

      adapter.handleEvent(message);

      expect(adapter.getRequestThreads().length).to.equal(1);
      expect(adapter.getEvents().length).to.equal(0);
    });
  });

  describe('Debugger event Stopped', () => {
    let sessionConnectedSpy: sinon.SinonStub;
    let sessionIdSpy: sinon.SinonStub;
    let eventProcessedSpy: sinon.SinonStub;
    let markEventProcessedSpy: sinon.SinonSpy;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService()
      );
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(true);
      sessionIdSpy = sinon
        .stub(SessionService.prototype, 'getSessionId')
        .returns('123');
      markEventProcessedSpy = sinon.spy(
        StreamingService.prototype,
        'markEventProcessed'
      );
    });

    afterEach(() => {
      sessionConnectedSpy.restore();
      sessionIdSpy.restore();
      eventProcessedSpy.restore();
      markEventProcessedSpy.restore();
    });

    it('Should send breakpoint stopped event', () => {
      eventProcessedSpy = sinon
        .stub(StreamingService.prototype, 'hasProcessedEvent')
        .returns(false);
      const message: DebuggerMessage = {
        event: {
          replayId: 0
        } as StreamingEvent,
        sobject: {
          SessionId: '123',
          Type: 'Stopped',
          RequestId: '07cFAKE',
          BreakpointId: '07bFAKE'
        }
      };
      adapter.addRequestThread('07cFAKE');

      adapter.handleEvent(message);

      expect(adapter.getRequestThreads().length).to.equal(1);
      expect(adapter.getEvents().length).to.equal(2);
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(adapter.getEvents()[1].event).to.equal('stopped');
      const stoppedEvent = adapter.getEvents()[1] as StoppedEvent;
      expect(stoppedEvent.body).to.deep.equal({
        threadId: 0,
        reason: 'breakpoint',
        allThreadsStopped: true
      });
      expect(markEventProcessedSpy.calledOnce).to.equal(true);
      expect(markEventProcessedSpy.getCall(0).args).to.have.same.members([
        ApexDebuggerEventType.Stopped,
        0
      ]);
    });

    it('Should send stepping stopped event', () => {
      eventProcessedSpy = sinon
        .stub(StreamingService.prototype, 'hasProcessedEvent')
        .returns(false);
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '123',
          Type: 'Stopped',
          RequestId: '07cFAKE-without-breakpoint'
        }
      };
      adapter.addRequestThread('07cFAKE-without-breakpoint');

      adapter.handleEvent(message);

      expect(adapter.getRequestThreads().length).to.equal(1);
      expect(adapter.getEvents().length).to.equal(2);
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(adapter.getEvents()[1].event).to.equal('stopped');
      const threadEvent = adapter.getEvents()[1] as StoppedEvent;
      expect(threadEvent.body.reason).to.equal('step');
      expect(threadEvent.body.threadId).to.equal(0);
    });

    it('Should not handle without request ID', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '123',
          Type: 'Stopped'
        }
      };

      adapter.handleEvent(message);

      expect(
        adapter.getRequestThreads().length,
        'must have no registered request thread'
      ).to.equal(0);
      expect(
        adapter.getEvents().length,
        'must not handle an event without a request id'
      ).to.equal(0);
    });
  });

  describe('Debugger event SystemWarning', () => {
    let sessionConnectedSpy: sinon.SinonStub;
    let sessionIdSpy: sinon.SinonStub;
    let eventProcessedSpy: sinon.SinonStub;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService()
      );
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(true);
      sessionIdSpy = sinon
        .stub(SessionService.prototype, 'getSessionId')
        .returns('123');
      eventProcessedSpy = sinon
        .stub(StreamingService.prototype, 'hasProcessedEvent')
        .returns(false);
      adapter.addRequestThread('07cFAKE');
    });

    afterEach(() => {
      sessionConnectedSpy.restore();
      sessionIdSpy.restore();
      eventProcessedSpy.restore();
    });

    it('Should send events with description', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '123',
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

    it('Should not send event without description', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '123',
          Type: 'SystemWarning'
        }
      };

      adapter.handleEvent(message);

      expect(adapter.getEvents().length).to.equal(1);
      expect(adapter.getEvents()[0].event).to.equal('output');
    });
  });
});
