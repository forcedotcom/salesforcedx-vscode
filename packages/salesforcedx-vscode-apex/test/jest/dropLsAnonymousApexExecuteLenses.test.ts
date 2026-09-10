/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import {
  dropLsAnonymousApexExecuteLenses,
  LS_ANON_APEX_EXECUTE_COMMAND
} from '../../src/dropLsAnonymousApexExecuteLenses';

const lens = (command: string): vscode.CodeLens => ({
  range: new vscode.Range(0, 0, 0, 0),
  isResolved: true,
  command: { title: command, command }
});

describe('dropLsAnonymousApexExecuteLenses', () => {
  it('drops Jorje Execute and keeps Debug and test lenses', () => {
    const debug = lens('sf.anon.apex.debug.delegate');
    const runTest = lens('sf.apex.test.class.run.delegate');
    const result = dropLsAnonymousApexExecuteLenses([
      lens(LS_ANON_APEX_EXECUTE_COMMAND),
      debug,
      runTest,
      { range: new vscode.Range(0, 0, 0, 0), isResolved: true }
    ]);
    expect(result.map(item => item.command?.command)).toEqual([
      'sf.anon.apex.debug.delegate',
      'sf.apex.test.class.run.delegate',
      undefined
    ]);
  });

  it('returns empty when every lens is Execute', () => {
    expect(dropLsAnonymousApexExecuteLenses([lens(LS_ANON_APEX_EXECUTE_COMMAND)])).toEqual([]);
  });
});
