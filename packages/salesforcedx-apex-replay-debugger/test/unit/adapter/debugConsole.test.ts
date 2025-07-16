/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Mock DebugSession.run to prevent it from executing during tests
jest.mock('@vscode/debugadapter', () => ({
  ...jest.requireActual('@vscode/debugadapter'),
  DebugSession: {
    ...jest.requireActual('@vscode/debugadapter').DebugSession,
    run: jest.fn()
  }
}));

import { Source } from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import { ApexReplayDebug } from '../../../src/adapter/apexReplayDebug';
import { LaunchRequestArguments } from '../../../src/adapter/types';
import { MockApexReplayDebug } from './apexReplayDebug.test';

describe('Debug console', () => {
  let sendEventSpy: jest.SpyInstance;
  let adapter: MockApexReplayDebug;
  const logFileName = 'foo.log';
  const logFilePath = `path/${logFileName}`;

  describe('Logger', () => {
    let args: LaunchRequestArguments = {
      logFileContents: 'test log content',
      logFilePath,
      logFileName,
      projectPath: undefined
    };

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      args = {
        logFileContents: 'test log content',
        logFilePath,
        logFileName,
        projectPath: undefined
      };
    });

    it('Should accept boolean true', () => {
      args.trace = true;

      adapter.setupLogger(args);

      expect(adapter.getTraceConfig()).toEqual(['all']);
      expect(adapter.getTraceAllConfig()).toBe(true);
      expect(adapter.shouldTraceLogFile()).toBe(true);
    });

    it('Should accept boolean false', () => {
      args.trace = false;

      adapter.setupLogger(args);

      expect(adapter.getTraceConfig()).toEqual([]);
      expect(adapter.getTraceAllConfig()).toBe(false);
      expect(adapter.shouldTraceLogFile()).toBe(false);
    });

    it('Should accept multiple trace categories', () => {
      args.trace = 'all,launch,breakpoints';

      adapter.setupLogger(args);

      expect(adapter.getTraceConfig()).toEqual(['all', 'launch', 'breakpoints']);
      expect(adapter.getTraceAllConfig()).toBe(true);
    });

    it('Should accept logfile category', () => {
      args.trace = 'logfile';

      adapter.setupLogger(args);

      expect(adapter.getTraceConfig()).toEqual(['logfile']);
      expect(adapter.getTraceAllConfig()).toBe(false);
      expect(adapter.shouldTraceLogFile()).toBe(true);
    });
  });

  describe('Print', () => {
    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      sendEventSpy = jest.spyOn(ApexReplayDebug.prototype, 'sendEvent');
    });

    afterEach(() => {
      sendEventSpy.mockRestore();
    });

    it('Should not print is message is empty', () => {
      adapter.printToDebugConsole('');

      expect(sendEventSpy).not.toHaveBeenCalled();
    });

    it('Should send Output event', () => {
      const source = new Source(logFileName, encodeURI(`file://${logFilePath}`));
      adapter.printToDebugConsole('test', source, 5, 'stdout');

      expect(sendEventSpy).toHaveBeenCalledTimes(1);
      const outputEvent: DebugProtocol.OutputEvent = sendEventSpy.mock.calls[0][0];
      expect(outputEvent.body.output).toContain('test');
      expect(outputEvent.body.category).toBe('stdout');
      expect(outputEvent.body.line).toBe(5);
      expect(outputEvent.body.column).toBe(0);
      expect(outputEvent.body.source).toEqual(source);
    });
  });

  describe('Warn', () => {
    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      sendEventSpy = jest.spyOn(ApexReplayDebug.prototype, 'sendEvent');
    });

    afterEach(() => {
      sendEventSpy.mockRestore();
    });

    it('Should not warn is message is empty', () => {
      adapter.warnToDebugConsole('');

      expect(sendEventSpy).not.toHaveBeenCalled();
    });

    it('Should send Output event', () => {
      adapter.warnToDebugConsole('test');

      expect(sendEventSpy).toHaveBeenCalledTimes(1);
      const outputEvent: DebugProtocol.OutputEvent = sendEventSpy.mock.calls[0][0];
      expect(outputEvent.body.output).toContain('test');
      expect(outputEvent.body.category).toBe('console');
    });
  });

  describe('Error', () => {
    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      sendEventSpy = jest.spyOn(ApexReplayDebug.prototype, 'sendEvent');
    });

    afterEach(() => {
      sendEventSpy.mockRestore();
    });

    it('Should not error is message is empty', () => {
      adapter.errorToDebugConsole('');

      expect(sendEventSpy).not.toHaveBeenCalled();
    });

    it('Should send Output event', () => {
      adapter.errorToDebugConsole('test');

      expect(sendEventSpy).toHaveBeenCalledTimes(1);
      const outputEvent: DebugProtocol.OutputEvent = sendEventSpy.mock.calls[0][0];
      expect(outputEvent.body.output).toContain('test');
      expect(outputEvent.body.category).toBe('stderr');
    });
  });
});
