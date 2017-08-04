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
    let sessionStartSpy: sinon.SinonSpy;
    let sessionProjectSpy: sinon.SinonSpy;
    let sessionUserFilterSpy: sinon.SinonSpy;
    let sessionEntryFilterSpy: sinon.SinonSpy;
    let sessionRequestFilterSpy: sinon.SinonSpy;
    let sessionConnectedSpy: sinon.SinonSpy;
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
      if (sessionStartSpy) {
        sessionStartSpy.restore();
      }
      sessionProjectSpy.restore();
      sessionUserFilterSpy.restore();
      sessionEntryFilterSpy.restore();
      sessionRequestFilterSpy.restore();
      if (sessionConnectedSpy) {
        sessionConnectedSpy.restore();
      }
    });

    it('Should use session service', () => {
      sessionStartSpy = sinon.stub(SessionService.prototype, 'start', () =>
        Promise.resolve(new CommandOutput())
      );

      adapter.launchReq(response, args);

      expect(sessionStartSpy.calledOnce).to.equal(true);
    });

    it('Should finalize launch and connect', () => {
      const cmdResponse = new CommandOutput();
      cmdResponse.saveId('07aFAKE');
      sessionConnectedSpy = sinon.stub(
        SessionService.prototype,
        'isConnected',
        () => {
          return true;
        }
      );

      adapter.finalizeLaunchReq(response, cmdResponse);

      expect(adapter.getResponse().success).to.equal(true);
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(
        (adapter.getEvents()[0] as OutputEvent).body.output
      ).to.have.string(
        nls.localize('session_started_text', cmdResponse.getId())
      );
    });

    it('Should finalize launch and not connect', () => {
      const cmdResponse = new CommandOutput();
      cmdResponse.saveCmdMsg('There was an error');
      cmdResponse.saveCmdAction('Try again');
      sessionConnectedSpy = sinon.stub(
        SessionService.prototype,
        'isConnected',
        () => {
          return false;
        }
      );

      adapter.finalizeLaunchReq(response, cmdResponse);

      expect(adapter.getResponse().success).to.equal(false);
      expect(adapter.getResponse().message).to.equal('There was an error');
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(
        (adapter.getEvents()[0] as OutputEvent).body.output
      ).to.have.string('Try again');
    });
  });

  describe('Disconnect', () => {
    let sessionStopSpy: sinon.SinonSpy;
    let sessionConnectedSpy: sinon.SinonSpy;
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
      sessionStopSpy.restore();
      sessionConnectedSpy.restore();
    });

    it('Should use session service if connected', () => {
      sessionConnectedSpy = sinon.stub(
        SessionService.prototype,
        'isConnected',
        () => {
          return true;
        }
      );
      sessionStopSpy = sinon.stub(SessionService.prototype, 'stop', () =>
        Promise.resolve(new CommandOutput())
      );

      adapter.disconnectReq(response, args);

      expect(sessionStopSpy.calledOnce).to.equal(true);
    });

    it('Should not use session service if not connected', () => {
      sessionConnectedSpy = sinon.stub(
        SessionService.prototype,
        'isConnected',
        () => {
          return false;
        }
      );
      sessionStopSpy = sinon.spy(SessionService.prototype, 'stop');

      adapter.disconnectReq(response, args);

      expect(sessionStopSpy.calledOnce).to.equal(false);
      expect(adapter.getResponse()).to.deep.equal(response);
    });

    it('Should finalize disconnect and stop', () => {
      const cmdResponse = new CommandOutput();
      cmdResponse.saveId('07aFAKE');
      sessionConnectedSpy = sinon.stub(
        SessionService.prototype,
        'isConnected',
        () => {
          return false;
        }
      );

      adapter.finalizeDisconnectReq(response, cmdResponse);

      expect(adapter.getResponse()).to.deep.equal(response);
      expect(
        (adapter.getEvents()[0] as OutputEvent).body.output
      ).to.have.string(
        nls.localize('session_terminated_text', cmdResponse.getId())
      );
    });

    it('Should finalize disconnect and not stop', () => {
      const cmdResponse = new CommandOutput();
      cmdResponse.saveCmdMsg('This was an error');
      cmdResponse.saveCmdAction('Try again');
      sessionConnectedSpy = sinon.stub(
        SessionService.prototype,
        'isConnected',
        () => {
          return true;
        }
      );

      adapter.finalizeDisconnectReq(response, cmdResponse);

      expect(adapter.getResponse().success).to.equal(false);
      expect(adapter.getResponse().message).to.equal('This was an error');
      expect(adapter.getEvents()[0].event).to.equal('output');
      expect(
        (adapter.getEvents()[0] as OutputEvent).body.output
      ).to.have.string('Try again');
    });
  });
});
