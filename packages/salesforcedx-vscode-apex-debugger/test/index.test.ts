/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  DEBUGGER_TYPE,
  EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS,
  EXCEPTION_BREAKPOINT_BREAK_MODE_NEVER,
  LIVESHARE_DEBUGGER_TYPE
} from '@salesforce/salesforcedx-apex-debugger/out/src';
import { expect } from 'chai';
import * as vscode from 'vscode';
import {
  ApexDebuggerConfigurationProvider,
  ExceptionBreakpointItem,
  getDebuggerType,
  getExceptionBreakpointCache,
  mergeExceptionBreakpointInfos,
  updateExceptionBreakpointCache
} from '../src/index';
import { nls } from '../src/messages';

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

  describe('Custom request', () => {
    it('Should extract underlying debugger type', async () => {
      const session = {
        type: LIVESHARE_DEBUGGER_TYPE,
        customRequest: async (command: string) => {
          return Promise.resolve(DEBUGGER_TYPE);
        }
      };

      const realType = await getDebuggerType(
        (session as any) as vscode.DebugSession
      );

      expect(realType).to.be.equal(DEBUGGER_TYPE);
    });
  });
});
