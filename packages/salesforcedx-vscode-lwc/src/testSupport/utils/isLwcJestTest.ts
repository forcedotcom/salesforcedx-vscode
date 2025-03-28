/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { LWC_TEST_DOCUMENT_SELECTOR } from '../types/constants';

/**
 * Determine if the text document is an LWC Jest test
 * @param textDocument vscode text document
 */
export const isLwcJestTest = (textDocument: vscode.TextDocument) =>
  vscode.languages.match(LWC_TEST_DOCUMENT_SELECTOR, textDocument);
