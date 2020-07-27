/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { SOQLEditorProvider } from './editor/soqlEditorProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('SOQL Extension Activated');
  context.subscriptions.push(SOQLEditorProvider.register(context));
}

export function deactivate() {}
