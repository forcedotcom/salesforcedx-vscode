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
import { SessionService } from '../../../src/core/sessionService';
import { nls } from '../../../src/messages';
import { CommandOutput } from '../../../src/utils/commandOutput';
import { ApexDebugForTest } from './apexDebugForTest';

describe('Debugger adapter - unit', () => {
  let adapter: ApexDebugForTest;

  describe('Initialize', () => {
    let response: DebugProtocol.InitializeResponse;
    let args: DebugProtocol.InitializeRequestArguments;

    beforeEach(() => {
      adapter = new ApexDebugForTest(new SessionService());
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
      adapter = new ApexDebugForTest(new SessionService());
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
    let response: DebugProtocol.LaunchResponse;
    let args: LaunchRequestArguments;

    beforeEach(() => {
      adapter = new ApexDebugForTest(new SessionService());
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
    });

    it('Should launch and connect', async () => {
      const cmdResponse = new CommandOutput();
      cmdResponse.setId('07aFAKE');
      sessionStartSpy = sinon
        .stub(SessionService.prototype, 'start')
        .returns(Promise.resolve(cmdResponse));
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(true);

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

    it('Should launch and not connect', async () => {
      const cmdResponse = new CommandOutput();
      cmdResponse.setCmdMsg('There was an error');
      cmdResponse.setCmdAction('Try again');
      sessionStartSpy = sinon
        .stub(SessionService.prototype, 'start')
        .returns(Promise.resolve(cmdResponse));
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(false);

      await adapter.launchReq(response, args);

      expect(sessionStartSpy.calledOnce).to.equal(true);
      expect(adapter.getResponse().success).to.equal(false);
      expect(adapter.getResponse().message).to.equal('There was an error');
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(
        (adapter.getEvents()[0] as OutputEvent).body.output
      ).to.have.string('Try again');
    });
  });

  describe('Disconnect', () => {
    let sessionStopSpy: sinon.SinonStub;
    let sessionConnectedSpy: sinon.SinonStub;
    let response: DebugProtocol.DisconnectResponse;
    let args: DebugProtocol.DisconnectArguments;

    beforeEach(() => {
      adapter = new ApexDebugForTest(new SessionService());
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
    });

    it('Should not use session service if not connected', async () => {
      sessionConnectedSpy = sinon
        .stub(SessionService.prototype, 'isConnected')
        .returns(false);

      await adapter.disconnectReq(response, args);

      expect(adapter.getResponse()).to.deep.equal(response);
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
    });

    it('Should try to disconnect and not stop', async () => {
      const cmdResponse = new CommandOutput();
      cmdResponse.setCmdMsg('This was an error');
      cmdResponse.setCmdAction('Try again');
      sessionStopSpy = sinon
        .stub(SessionService.prototype, 'stop')
        .returns(Promise.resolve(cmdResponse));
      sessionConnectedSpy = sinon.stub(SessionService.prototype, 'isConnected');
      sessionConnectedSpy.onCall(0).returns(true);
      sessionConnectedSpy.onCall(1).returns(true);

      await adapter.disconnectReq(response, args);

      expect(sessionStopSpy.calledOnce).to.equal(true);
      expect(adapter.getResponse().success).to.equal(false);
      expect(adapter.getResponse().message).to.equal('This was an error');
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(
        (adapter.getEvents()[0] as OutputEvent).body.output
      ).to.have.string('Try again');
    });
  });
});
