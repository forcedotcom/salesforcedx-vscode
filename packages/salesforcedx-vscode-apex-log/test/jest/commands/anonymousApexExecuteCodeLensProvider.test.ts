/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { provideAnonymousApexExecuteLenses } from '../../../src/commands/anonymousApexExecuteCodeLensProvider';

const documentWith = (text: string): vscode.TextDocument => ({ getText: () => text }) as unknown as vscode.TextDocument;

describe('provideAnonymousApexExecuteLenses', () => {
  it('returns Execute lens for non-empty script with a target org', () => {
    const lenses = provideAnonymousApexExecuteLenses(documentWith("System.debug('hi');\n"), true);
    expect(lenses).toHaveLength(1);
    expect(lenses[0].command).toEqual({
      command: 'sf.anon.apex.execute.document',
      title: 'Execute',
      tooltip: 'Execute'
    });
  });

  it('returns no lens when the script is empty or whitespace', () => {
    expect(provideAnonymousApexExecuteLenses(documentWith(''), true)).toEqual([]);
    expect(provideAnonymousApexExecuteLenses(documentWith('  \n\t'), true)).toEqual([]);
  });

  it('returns no lens when there is no target org', () => {
    expect(provideAnonymousApexExecuteLenses(documentWith("System.debug('hi');"), false)).toEqual([]);
  });
});
