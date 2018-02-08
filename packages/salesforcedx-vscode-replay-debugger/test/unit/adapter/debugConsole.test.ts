/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { Source } from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import {
  ApexReplayDebug,
  LaunchRequestArguments
} from '../../../src/adapter/apexReplayDebug';
import { MockApexReplayDebug } from './apexReplayDebug.test';

// tslint:disable:no-unused-expression
describe('Debug console', () => {
  let sendEventSpy: sinon.SinonSpy;
  let adapter: MockApexReplayDebug;
  const logFileName = 'foo.log';
  const logFilePath = `path/${logFileName}`;

  describe('Logger', () => {
    let args: LaunchRequestArguments = {
      logFile: logFilePath
    };

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      args = {
        logFile: logFilePath
      };
    });

    it('Should accept boolean true', () => {
      args.trace = true;

      adapter.setupLogger(args);

      expect(adapter.getTraceConfig()).to.be.eql(['all']);
      expect(adapter.getTraceAllConfig()).to.be.true;
      expect(adapter.shouldTraceLogFile()).to.be.true;
    });

    it('Should accept boolean false', () => {
      args.trace = false;

      adapter.setupLogger(args);

      expect(adapter.getTraceConfig()).to.be.empty;
      expect(adapter.getTraceAllConfig()).to.be.false;
      expect(adapter.shouldTraceLogFile()).to.be.false;
    });

    it('Should accept multiple trace categories', () => {
      args.trace = 'all,launch,breakpoints';

      adapter.setupLogger(args);

      expect(adapter.getTraceConfig()).to.be.eql([
        'all',
        'launch',
        'breakpoints'
      ]);
      expect(adapter.getTraceAllConfig()).to.be.true;
    });

    it('Should accept logfile category', () => {
      args.trace = 'logfile';

      adapter.setupLogger(args);

      expect(adapter.getTraceConfig()).to.be.eql(['logfile']);
      expect(adapter.getTraceAllConfig()).to.be.false;
      expect(adapter.shouldTraceLogFile()).to.be.true;
    });
  });

  describe('Print', () => {
    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      sendEventSpy = sinon.spy(ApexReplayDebug.prototype, 'sendEvent');
    });

    afterEach(() => {
      sendEventSpy.restore();
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
      adapter.printToDebugConsole('test', source, 5, 'stdout');

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
