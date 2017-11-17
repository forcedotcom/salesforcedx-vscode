import {
  DEFAULT_IDLE_QUESTION_TIMEOUT_MS,
  DEFAULT_IDLE_TIMEOUT_MS,
  EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS,
  EXCEPTION_BREAKPOINT_BREAK_MODE_NEVER,
  IDLE_SESSION_REQUEST,
  SEND_HEARTBEAT_REQUEST,
  TERMINATE_SESSION_REQUEST
} from '@salesforce/salesforcedx-apex-debugger/out/src';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { DebugSession } from 'vscode';
import {
  ApexDebuggerConfigurationProvider,
  areYouStillDebugging,
  ExceptionBreakpointItem,
  getExceptionBreakpointCache,
  mergeExceptionBreakpointInfos,
  updateExceptionBreakpointCache
} from '../src/index';
import { nls } from '../src/messages';

// tslint:disable:no-unused-expression
describe('Extension Setup', () => {
  describe('Configuration provider', () => {
    let provider: ApexDebuggerConfigurationProvider;

    beforeEach(() => {
      provider = new ApexDebuggerConfigurationProvider();
    });

    it('Should use context folder path', () => {
      const folder: vscode.WorkspaceFolder = {
        name: 'mySfdxProject',
        index: 0,
        uri: {
          fsPath: '/foo'
        } as vscode.Uri
      };
      const expectedConfig = {
        name: 'Launch Apex Debugger',
        type: 'apex',
        request: 'launch',
        userIdFilter: [],
        requestTypeFilter: [],
        entryPointFilter: '',
        sfdxProject: '/foo'
      } as vscode.DebugConfiguration;

      const configs = provider.provideDebugConfigurations(folder);

      expect(configs).to.deep.equal([expectedConfig]);
    });

    it('Should use default workspaceRoot', () => {
      const expectedConfig = {
        name: 'Launch Apex Debugger',
        type: 'apex',
        request: 'launch',
        userIdFilter: [],
        requestTypeFilter: [],
        entryPointFilter: '',
        sfdxProject: '${workspaceRoot}'
      } as vscode.DebugConfiguration;

      const configs = provider.provideDebugConfigurations(undefined);

      expect(configs).to.deep.equal([expectedConfig]);
    });
  });

  describe('Exception breakpoint', () => {
    describe('Merge breakpoint infos', () => {
      let breakpointInfos: ExceptionBreakpointItem[] = [];

      beforeEach(() => {
        breakpointInfos = [
          {
            typeref: 'barexception',
            label: 'barexception',
            uri: 'file:///barexception.cls',
            breakMode: EXCEPTION_BREAKPOINT_BREAK_MODE_NEVER,
            description: ''
          },
          {
            typeref: 'fooexception',
            label: 'fooexception',
            uri: 'file:///fooexception.cls',
            breakMode: EXCEPTION_BREAKPOINT_BREAK_MODE_NEVER,
            description: ''
          },
          {
            typeref: 'com/salesforce/api/exception/NullPointerException',
            label: 'System.NullPointerException',
            breakMode: EXCEPTION_BREAKPOINT_BREAK_MODE_NEVER,
            description: ''
          }
        ];
      });
      it('Should order breakpoints by enabled first', () => {
        const exceptionBreakpointQuickPicks = mergeExceptionBreakpointInfos(
          breakpointInfos,
          ['com/salesforce/api/exception/NullPointerException']
        );

        expect(exceptionBreakpointQuickPicks.length).to.equal(3);
        expect(exceptionBreakpointQuickPicks[0].typeref).to.equal(
          'com/salesforce/api/exception/NullPointerException'
        );
        expect(exceptionBreakpointQuickPicks[0].breakMode).to.equal(
          EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS
        );
        expect(exceptionBreakpointQuickPicks[0].description).to.equal(
          `$(stop) ${nls.localize('always_break_text')}`
        );
        expect(exceptionBreakpointQuickPicks[1].typeref).to.equal(
          'barexception'
        );
        expect(exceptionBreakpointQuickPicks[1].breakMode).to.equal(
          EXCEPTION_BREAKPOINT_BREAK_MODE_NEVER
        );
        expect(exceptionBreakpointQuickPicks[2].typeref).to.equal(
          'fooexception'
        );
        expect(exceptionBreakpointQuickPicks[2].breakMode).to.equal(
          EXCEPTION_BREAKPOINT_BREAK_MODE_NEVER
        );
      });

      it('Should not modify breakpoint infos if enabled breakpoints has empty typerefs', () => {
        const exceptionBreakpointQuickPicks = mergeExceptionBreakpointInfos(
          breakpointInfos,
          []
        );

        expect(exceptionBreakpointQuickPicks).to.deep.equal(breakpointInfos);
      });
    });

    describe('Update cache', () => {
      beforeEach(() => {
        getExceptionBreakpointCache().clear();
      });

      it('Should add new breakpoint', () => {
        updateExceptionBreakpointCache({
          typeref: 'barexception',
          label: 'barexception',
          uri: 'file:///barexception.cls',
          breakMode: EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS,
          description: ''
        });

        expect(getExceptionBreakpointCache().size).to.equal(1);
      });

      it('Should not add existing breakpoint', () => {
        updateExceptionBreakpointCache({
          typeref: 'barexception',
          label: 'barexception',
          uri: 'file:///barexception.cls',
          breakMode: EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS,
          description: ''
        });

        expect(getExceptionBreakpointCache().size).to.equal(1);

        updateExceptionBreakpointCache({
          typeref: 'barexception',
          label: 'barexception',
          uri: 'file:///barexception.cls',
          breakMode: EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS,
          description: ''
        });

        expect(getExceptionBreakpointCache().size).to.equal(1);
      });

      it('Should remove existing breakpoint', () => {
        updateExceptionBreakpointCache({
          typeref: 'barexception',
          label: 'barexception',
          uri: 'file:///barexception.cls',
          breakMode: EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS,
          description: ''
        });

        expect(getExceptionBreakpointCache().size).to.equal(1);

        updateExceptionBreakpointCache({
          typeref: 'barexception',
          label: 'barexception',
          uri: 'file:///barexception.cls',
          breakMode: EXCEPTION_BREAKPOINT_BREAK_MODE_NEVER,
          description: ''
        });

        expect(getExceptionBreakpointCache().size).to.equal(0);
      });

      it('Should not remove nonexisting breakpoint', () => {
        updateExceptionBreakpointCache({
          typeref: 'barexception',
          label: 'barexception',
          uri: 'file:///barexception.cls',
          breakMode: EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS,
          description: ''
        });

        expect(getExceptionBreakpointCache().size).to.equal(1);

        updateExceptionBreakpointCache({
          typeref: 'fooexception',
          label: 'fooexception',
          uri: 'file:///fooexception.cls',
          breakMode: EXCEPTION_BREAKPOINT_BREAK_MODE_NEVER,
          description: ''
        });

        expect(getExceptionBreakpointCache().size).to.equal(1);
      });
    });
  });

  describe('Idle session timer', () => {
    class MockDebugSession implements DebugSession {
      public id = '123';
      public type = 'mock';
      public name = 'mocksession';
      private customRequestCommand: string;

      public customRequest(command: string, args?: any): Thenable<string> {
        this.customRequestCommand = command;
        return Promise.resolve(command);
      }

      public getCommand(): string {
        return this.customRequestCommand;
      }
    }

    let clock: sinon.SinonFakeTimers;
    let showWarningBoxSpy: sinon.SinonStub;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
      showWarningBoxSpy = sinon.stub(vscode.window, 'showWarningMessage');
    });

    afterEach(() => {
      clock.restore();
      showWarningBoxSpy.restore();
    });

    it('Should send heartbeat request', () => {
      showWarningBoxSpy.onCall(0).returns(nls.localize('answer_yes'));
      const mockSession = new MockDebugSession();

      const timer = areYouStillDebugging(mockSession);

      setTimeout(async () => {
        await Promise.resolve();
        expect(mockSession.getCommand()).to.equal(SEND_HEARTBEAT_REQUEST);
      }, DEFAULT_IDLE_TIMEOUT_MS);
      clock.tick(DEFAULT_IDLE_TIMEOUT_MS + 1);
      expect(timer).to.not.be.undefined;
    });

    it('Should send terminate request', () => {
      showWarningBoxSpy.onCall(0).returns(nls.localize('answer_no'));
      const mockSession = new MockDebugSession();

      const timer = areYouStillDebugging(mockSession);

      setTimeout(async () => {
        await Promise.resolve();
        expect(mockSession.getCommand()).to.equal(TERMINATE_SESSION_REQUEST);
      }, DEFAULT_IDLE_TIMEOUT_MS);
      clock.tick(DEFAULT_IDLE_TIMEOUT_MS + 1);
      expect(timer).to.not.be.undefined;
    });

    it('Should send idle session request', () => {
      const mockSession = new MockDebugSession();

      const timer = areYouStillDebugging(mockSession);

      setTimeout(() => {
        setTimeout(async () => {
          expect(mockSession.getCommand()).to.equal(IDLE_SESSION_REQUEST);
          await Promise.resolve();
        }, DEFAULT_IDLE_QUESTION_TIMEOUT_MS);
        clock.tick(DEFAULT_IDLE_QUESTION_TIMEOUT_MS + 1);
      }, DEFAULT_IDLE_TIMEOUT_MS);
      clock.tick(DEFAULT_IDLE_TIMEOUT_MS + 1);
      expect(timer).to.not.be.undefined;
    });
  });
});
