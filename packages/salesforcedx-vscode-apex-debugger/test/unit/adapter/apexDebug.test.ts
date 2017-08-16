/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { OutputEvent } from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { LaunchRequestArguments } from '../../../src/adapter/apexDebug';
import {
  ApexDebuggerEvent,
  DebuggerMessage,
  SessionService,
  StreamingClientInfo,
  StreamingEvent,
  StreamingService
} from '../../../src/core';
import { nls } from '../../../src/messages';
import { CommandOutput } from '../../../src/utils/commandOutput';
import { ApexDebugForTest } from './apexDebugForTest';

describe('Debugger adapter - unit', () => {
  let adapter: ApexDebugForTest;

  describe('Initialize', () => {
    let response: DebugProtocol.InitializeResponse;
    let args: DebugProtocol.InitializeRequestArguments;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService()
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

    it('Should send InitializedEvent', async () => {
      adapter.initializeReq(response, args);
      expect(adapter.getEvents()[0].event).to.equal('initialized');
    });
  });

  describe('Attach', () => {
    let response: DebugProtocol.AttachResponse;
    let args: DebugProtocol.AttachRequestArguments;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService()
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
      const actualResp: DebugProtocol.Response = adapter.getResponse();
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
    let streamingSubscribeSpy: sinon.SinonStub;
    let response: DebugProtocol.LaunchResponse;
    let args: LaunchRequestArguments;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService()
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
    });

    it('Should launch successfully', async () => {
      const cmdResponse = new CommandOutput();
      cmdResponse.setId('07aFAKE');
      sessionStartSpy = sinon
        .stub(SessionService.prototype, 'start')
        .returns(Promise.resolve(cmdResponse));
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(true);
      streamingSubscribeSpy = sinon
        .stub(StreamingService.prototype, 'subscribe')
        .returns(Promise.resolve(true));

      await adapter.launchReq(response, args);

      expect(sessionStartSpy.calledOnce).to.equal(true);
      expect(adapter.getResponse().success).to.equal(true);
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(
        (adapter.getEvents()[0] as OutputEvent).body.output
      ).to.have.string(
        nls.localize('session_started_text', cmdResponse.getId())
      );
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

      await adapter.launchReq(response, args);

      expect(sessionStartSpy.calledOnce).to.equal(true);
      expect(adapter.getResponse().success).to.equal(false);
      expect(adapter.getResponse().message).to.equal('There was an error');
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(
        (adapter.getEvents()[0] as OutputEvent).body.output
      ).to.have.string('Try again');
    });

    it('Should not launch if streaming service errors out', async () => {
      const cmdResponse = new CommandOutput();
      cmdResponse.setId('07aFAKE');
      sessionStartSpy = sinon
        .stub(SessionService.prototype, 'start')
        .returns(Promise.resolve(cmdResponse));
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(true);
      streamingSubscribeSpy = sinon
        .stub(StreamingService.prototype, 'subscribe')
        .returns(Promise.resolve(false));

      await adapter.launchReq(response, args);

      expect(sessionStartSpy.called).to.equal(false);
      expect(adapter.getResponse().success).to.equal(false);
      expect(adapter.getEvents().length).to.equal(0);
    });
  });

  describe('Disconnect', () => {
    let sessionStopSpy: sinon.SinonStub;
    let sessionConnectedSpy: sinon.SinonStub;
    let streamingDisconnectSpy: sinon.SinonStub;
    let response: DebugProtocol.DisconnectResponse;
    let args: DebugProtocol.DisconnectArguments;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService()
      );
      streamingDisconnectSpy = sinon.stub(
        StreamingService.prototype,
        'disconnect'
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
    });

    it('Should not use session service if not connected', async () => {
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(false);

      await adapter.disconnectReq(response, args);

      expect(adapter.getResponse()).to.deep.equal(response);
      expect(streamingDisconnectSpy.calledOnce).to.equal(true);
    });

    it('Should try to disconnect and stop', async () => {
      const cmdResponse = new CommandOutput();
      cmdResponse.setId('07aFAKE');
      sessionStopSpy = sinon
        .stub(SessionService.prototype, 'stop')
        .returns(Promise.resolve(cmdResponse));
      sessionConnectedSpy = sinon.stub(SessionService.prototype, 'isConnected');
      sessionConnectedSpy.onCall(0).returns(true);
      sessionConnectedSpy.onCall(1).returns(false);

      await adapter.disconnectReq(response, args);

      expect(sessionStopSpy.calledOnce).to.equal(true);
      expect(adapter.getResponse()).to.deep.equal(response);
      expect(
        (adapter.getEvents()[0] as OutputEvent).body.output
      ).to.have.string(
        nls.localize('session_terminated_text', cmdResponse.getId())
      );
      expect(streamingDisconnectSpy.calledOnce).to.equal(true);
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
      expect(adapter.getResponse().success).to.equal(false);
      expect(adapter.getResponse().message).to.equal('There was an error');
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(
        (adapter.getEvents()[0] as OutputEvent).body.output
      ).to.have.string('Try again');
      expect(streamingDisconnectSpy.calledOnce).to.equal(true);
    });
  });

  describe('Logging', () => {
    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService()
      );
    });

    it('Should not log without an error', () => {
      adapter.tryToParseSfdxError(<DebugProtocol.Response>{});

      expect(adapter.getEvents().length).to.equal(0);
    });

    it('Should error to console with unexpected error schema', () => {
      adapter.tryToParseSfdxError(
        <DebugProtocol.Response>{},
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
        <DebugProtocol.Response>{},
        'There was an error"}'
      );

      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(
        (adapter.getEvents()[0] as OutputEvent).body.output
      ).to.have.string('There was an error');
    });
  });

  describe('Streaming', () => {
    let streamingSubscribeSpy: sinon.SinonStub;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService()
      );
      streamingSubscribeSpy = sinon
        .stub(StreamingService.prototype, 'subscribe')
        .returns(Promise.resolve());
    });

    afterEach(() => {
      streamingSubscribeSpy.restore();
    });

    it('Should call streaming service subscribe', () => {
      adapter.connectStreaming('foo');

      expect(streamingSubscribeSpy.calledOnce).to.equal(true);
      expect(streamingSubscribeSpy.getCall(0).args.length).to.equal(2);
      expect(streamingSubscribeSpy.getCall(0).args[0]).to.equal('foo');
      expect(streamingSubscribeSpy.getCall(0).args[1].length).to.equal(2);
      for (const obj of streamingSubscribeSpy.getCall(0).args[1]) {
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
    let sessionService: SessionService;
    let sessionConnectedSpy: sinon.SinonStub;
    let sessionIdSpy: sinon.SinonSpy;
    let sessionStopSpy: sinon.SinonSpy;

    beforeEach(() => {
      sessionService = new SessionService();
      adapter = new ApexDebugForTest(sessionService, new StreamingService());
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
      const message = <DebuggerMessage>{
        event: <StreamingEvent>{},
        sobject: <ApexDebuggerEvent>{
          SessionId: '123',
          Type: 'SessionTerminated',
          Description: 'foo'
        }
      };

      adapter.handleEvent(message);

      expect(sessionStopSpy.calledOnce).to.equal(true);
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
      const message = <DebuggerMessage>{
        event: <StreamingEvent>{},
        sobject: <ApexDebuggerEvent>{
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
      const message = <DebuggerMessage>{
        event: <StreamingEvent>{},
        sobject: <ApexDebuggerEvent>{
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
});
