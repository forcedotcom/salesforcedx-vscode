/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type * as vscode from 'vscode';

/** Jorje AnonymousApexCodeLensesProvider Execute lens. Apex Log owns Execute; Debug stays. */
export const LS_ANON_APEX_EXECUTE_COMMAND = 'sf.anon.apex.run.delegate';

export const dropLsAnonymousApexExecuteLenses = (lenses: readonly vscode.CodeLens[]): vscode.CodeLens[] =>
  lenses.filter(lens => lens.command?.command !== LS_ANON_APEX_EXECUTE_COMMAND);
