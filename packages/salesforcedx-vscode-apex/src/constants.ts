/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from './messages';

export const DEBUGGER_LINE_BREAKPOINTS = 'debugger/lineBreakpoints';
export const DEBUGGER_EXCEPTION_BREAKPOINTS = 'debugger/exceptionBreakpoints';

export const LIGHT_BLUE_BUTTON = path.join(
  __filename,
  '..',
  '..',
  '..',
  'resources',
  'light',
  'testNotRun.svg'
);

export const LIGHT_RED_BUTTON = path.join(
  __filename,
  '..',
  '..',
  '..',
  'resources',
  'light',
  'testFail.svg'
);
export const LIGHT_GREEN_BUTTON = path.join(
  __filename,
  '..',
  '..',
  '..',
  'resources',
  'light',
  'testPass.svg'
);
export const LIGHT_ORANGE_BUTTON = path.join(
  __filename,
  '..',
  '..',
  '..',
  'resources',
  'light',
  'testSkip.svg'
);

export const DARK_BLUE_BUTTON = path.join(
  __filename,
  '..',
  '..',
  '..',
  'resources',
  'dark',
  'testNotRun.svg'
);
export const DARK_RED_BUTTON = path.join(
  __filename,
  '..',
  '..',
  '..',
  'resources',
  'dark',
  'testFail.svg'
);
export const DARK_GREEN_BUTTON = path.join(
  __filename,
  '..',
  '..',
  '..',
  'resources',
  'dark',
  'testPass.svg'
);
export const DARK_ORANGE_BUTTON = path.join(
  __filename,
  '..',
  '..',
  '..',
  'resources',
  'dark',
  'testSkip.svg'
);

const startPos = new vscode.Position(0, 0);
const endPos = new vscode.Position(0, 1);
export const APEX_GROUP_RANGE = new vscode.Range(startPos, endPos);
export const SET_JAVA_DOC_LINK =
  'https://forcedotcom.github.io/salesforcedx-vscode/articles/getting-started/java-setup';
export const SFDX_APEX_CONFIGURATION_NAME = 'salesforcedx-vscode-apex';
export const ENABLE_SOBJECT_REFRESH_ON_STARTUP =
  'enable-sobject-refresh-on-startup';
export const APEX_EXTENSION_NAME = 'salesforcedx-vscode-apex';
export const LSP_ERR = 'apexLSPError';
export const OUTPUT_CHANNEL = vscode.window.createOutputChannel(
  nls.localize('channel_name')
);
