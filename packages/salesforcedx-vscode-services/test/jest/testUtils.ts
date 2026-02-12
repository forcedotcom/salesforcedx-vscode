/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

/**
 * Creates a mock OutputChannel for use in tests.
 * Only includes the properties that are actually used/verified in tests.
 */
export const createMockOutputChannel = (): vscode.OutputChannel =>
  ({
    appendLine: jest.fn(),
    show: jest.fn()
  }) as unknown as vscode.OutputChannel;
