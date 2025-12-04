/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

/**
 * Type definition for Apex test methods.
 * The actual conversion from LSP format is handled by the Apex extension's ApexLSPConverter.
 */
export type ApexTestMethod = {
  methodName: string;
  definingType: string;
  location: vscode.Location;
};
