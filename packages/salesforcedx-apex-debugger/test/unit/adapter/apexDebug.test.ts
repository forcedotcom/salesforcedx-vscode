/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CommandOutput } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  ContinuedEvent,
  OutputEvent,
  StoppedEvent,
  ThreadEvent
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { LaunchRequestArguments } from '../../../src/adapter/apexDebug';
import {
  LineBreakpointInfo,
  LineBreakpointsInTyperef
} from '../../../src/breakpoints/lineBreakpoint';
import { ForceOrgDisplay, OrgInfo, RunCommand } from '../../../src/commands';
import {
  BreakpointService,
  DebuggerMessage,
  SessionService,
  StreamingClientInfo,
  StreamingEvent,
  StreamingService
} from '../../../src/core';
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
      expect(adapter.getEvents()[0].event).to.equal('getLineBreakpointInfo');
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

    it('Should not launch if session service errors out', async () => {
      sessionStartSpy = sinon
        .stub(SessionService.prototype, 'start')
        .returns(
          Promise.reject(
            '{"message":"There was an error", "action":"Try again"}'
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
      expect(adapter.getResponse(0).message).to.equal('There was an error');
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
        { id: 0, name: '07cFAKE1' },
        { id: 1, name: '07cFAKE2' }
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

  describe('Custom request', () => {
    describe('Line breakpoint info', () => {
      let setValidLinesSpy: sinon.SinonSpy;
      const initializedResponse = {
        request_seq: 1,
        seq: 0,
        success: true,
        type: 'response'
      } as DebugProtocol.InitializeResponse;

      beforeEach(() => {
        adapter = new ApexDebugForTest(
          new SessionService(),
          new StreamingService(),
          new BreakpointService()
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
          'lineBreakpointInfo',
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
        const expected: Map<string, LineBreakpointsInTyperef[]> = new Map();
        expected.set('file:///foo.cls', [
          { typeref: 'foo', lines: [1, 2, 3] },
          { typeref: 'foo$inner', lines: [4, 5, 6] }
        ]);
        expected.set('file:///bar.cls', [
          { typeref: 'bar', lines: [1, 2, 3] },
          { typeref: 'bar$inner', lines: [4, 5, 6] }
        ]);

        adapter.customRequest(
          'lineBreakpointInfo',
          {} as DebugProtocol.Response,
          info
        );

        expect(setValidLinesSpy.calledOnce).to.equal(true);
        expect(setValidLinesSpy.getCall(0).args.length).to.equal(1);
        expect(setValidLinesSpy.getCall(0).args[0]).to.deep.equal(expected);
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
          Line: 5
        }
      };

      adapter.logEvent(msg);
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(
        (adapter.getEvents()[0] as OutputEvent).body.output
      ).to.have.string(
        `${msg.event.createdDate} | ${msg.sobject.Type} | Request: ${msg.sobject
          .RequestId} | Breakpoint: ${msg.sobject.BreakpointId} | Line: ${msg
          .sobject.Line}`
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
      expect(streamingSubscribeSpy.getCall(0).args.length).to.equal(4);
      expect(streamingSubscribeSpy.getCall(0).args[0]).to.equal('foo');
      expect(streamingSubscribeSpy.getCall(0).args[1]).to.equal(
        'https://www.salesforce.com'
      );
      expect(streamingSubscribeSpy.getCall(0).args[2]).to.equal('123');
      expect(streamingSubscribeSpy.getCall(0).args[3].length).to.equal(2);
      for (const obj of streamingSubscribeSpy.getCall(0).args[3]) {
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

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService()
      );
    });

    afterEach(() => {
      sessionConnectedSpy.restore();
      sessionIdSpy.restore();
      sessionStopSpy.restore();
    });

    it('Should stop session service', () => {
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(true);
      sessionIdSpy = sinon
        .stub(SessionService.prototype, 'getSessionId')
        .returns('123');
      sessionStopSpy = sinon.spy(SessionService.prototype, 'forceStop');
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
      expect(adapter.getEvents().length).to.equal(2);
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(
        (adapter.getEvents()[0] as OutputEvent).body.output
      ).to.have.string('foo');
      expect(adapter.getEvents()[1].event).to.equal('terminated');
    });

    it('Should not stop session service if session IDs do not match', () => {
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(true);
      sessionIdSpy = sinon
        .stub(SessionService.prototype, 'getSessionId')
        .returns('123');
      sessionStopSpy = sinon.spy(SessionService.prototype, 'forceStop');
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
      sessionStopSpy = sinon.spy(SessionService.prototype, 'forceStop');
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

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService()
      );
    });

    afterEach(() => {
      sessionConnectedSpy.restore();
      sessionIdSpy.restore();
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
      expect(adapter.getEvents().length).to.equal(2);
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(adapter.getEvents()[1].event).to.equal('thread');
      const threadEvent = adapter.getEvents()[1] as ThreadEvent;
      expect(threadEvent.body.reason).to.equal('started');
      expect(threadEvent.body.threadId).to.equal(0);
    });
  });

  describe('Debugger event RequestFinished', () => {
    let sessionConnectedSpy: sinon.SinonStub;
    let sessionIdSpy: sinon.SinonStub;

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
    });

    afterEach(() => {
      sessionConnectedSpy.restore();
      sessionIdSpy.restore();
    });

    it('Should delete request thread', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '123',
          Type: 'RequestFinished',
          RequestId: '07cFAKE'
        }
      };
      adapter.addRequestThread('07cFAKE');

      adapter.handleEvent(message);

      expect(adapter.getRequestThreads().length).to.equal(0);
      expect(adapter.getEvents().length).to.equal(2);
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(adapter.getEvents()[1].event).to.equal('thread');
      const threadEvent = adapter.getEvents()[1] as ThreadEvent;
      expect(threadEvent.body.reason).to.equal('exited');
      expect(threadEvent.body.threadId).to.equal(0);
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
    });

    afterEach(() => {
      sessionConnectedSpy.restore();
      sessionIdSpy.restore();
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
      expect(adapter.getEvents().length).to.equal(2);
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(adapter.getEvents()[1].event).to.equal('continued');
      const threadEvent = adapter.getEvents()[1] as ContinuedEvent;
      expect(threadEvent.body.threadId).to.equal(0);
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
    });

    afterEach(() => {
      sessionConnectedSpy.restore();
      sessionIdSpy.restore();
    });

    it('Should send stopped event', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
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
      const threadEvent = adapter.getEvents()[1] as StoppedEvent;
      expect(threadEvent.body.reason).to.equal('breakpoint');
      expect(threadEvent.body.threadId).to.equal(0);
    });

    it('Should not handle without breakpoint ID', () => {
      const message: DebuggerMessage = {
        event: {} as StreamingEvent,
        sobject: {
          SessionId: '123',
          Type: 'Stopped',
          RequestId: '07cFAKE'
        }
      };
      adapter.addRequestThread('07cFAKE');

      adapter.handleEvent(message);

      expect(adapter.getRequestThreads().length).to.equal(1);
      expect(adapter.getEvents().length).to.equal(0);
    });
  });
});
