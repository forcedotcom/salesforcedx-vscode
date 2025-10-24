/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { SALESFORCE_DX_SECTION } from '../constants';

/**
 * Get local traces enabled setting.  Sends traces to a locally running docker container.
 * See setting description for how to use
 */
export const getLocalTracesEnabled = (): boolean =>
  getOptionalBooleanConfiguration(SALESFORCE_DX_SECTION)('enableLocalTraces');

/** export spans/traces to console (browser or nodejs) */
export const getConsoleTracesEnabled = (): boolean =>
  getOptionalBooleanConfiguration(SALESFORCE_DX_SECTION)('enableConsoleTraces');

export const getOptionalBooleanConfiguration =
  (section: string) =>
  (configName: string): boolean => {
    // eslint-disable-next-line functional/no-try-statements
    try {
      const config = vscode.workspace.getConfiguration(section);
      return config.get(configName) ?? false;
    } catch {
      // Return false during tests or when VS Code API is not available
      return false;
    }
  };
