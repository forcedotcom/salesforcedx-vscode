/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { extensionUris } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'path';
import * as vscode from 'vscode';
import { VSCODE_LWC_EXTENSION_NAME } from '../../constants';
import { TestResult, TestResultStatus } from '../types';

const extensionPath = extensionUris.extensionUri(VSCODE_LWC_EXTENSION_NAME);
const LIGHT_BLUE_BUTTON = extensionUris.join(extensionPath, path.join('resources', 'light', 'testNotRun.svg'));

const LIGHT_RED_BUTTON = extensionUris.join(extensionPath, path.join('resources', 'light', 'testFail.svg'));

const LIGHT_GREEN_BUTTON = extensionUris.join(extensionPath, path.join('resources', 'light', 'testPass.svg'));
const LIGHT_ORANGE_BUTTON = extensionUris.join(extensionPath, path.join('resources', 'light', 'testSkip.svg'));

const DARK_BLUE_BUTTON = extensionUris.join(extensionPath, path.join('resources', 'dark', 'testNotRun.svg'));
const DARK_RED_BUTTON = extensionUris.join(extensionPath, path.join('resources', 'dark', 'testFail.svg'));
const DARK_GREEN_BUTTON = extensionUris.join(extensionPath, path.join('resources', 'dark', 'testPass.svg'));
const DARK_ORANGE_BUTTON = extensionUris.join(extensionPath, path.join('resources', 'dark', 'testSkip.svg'));

type IconPath = { light: vscode.Uri; dark: vscode.Uri };

/**
 * Get icon path in the test explorer for test result
 * @param testResult test result
 */
export const getIconPath = (testResult?: TestResult): IconPath => {
  if (testResult) {
    if (testResult.status === TestResultStatus.PASSED) {
      return {
        light: LIGHT_GREEN_BUTTON,
        dark: DARK_GREEN_BUTTON
      };
    } else if (testResult.status === TestResultStatus.FAILED) {
      return {
        light: LIGHT_RED_BUTTON,
        dark: DARK_RED_BUTTON
      };
    } else if (testResult.status === TestResultStatus.SKIPPED) {
      return {
        light: LIGHT_ORANGE_BUTTON,
        dark: DARK_ORANGE_BUTTON
      };
    } else {
      return {
        light: LIGHT_BLUE_BUTTON,
        dark: DARK_BLUE_BUTTON
      };
    }
  } else {
    return {
      light: LIGHT_BLUE_BUTTON,
      dark: DARK_BLUE_BUTTON
    };
  }
};
