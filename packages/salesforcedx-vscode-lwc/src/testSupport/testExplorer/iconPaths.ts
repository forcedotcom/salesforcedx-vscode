/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { extensionUris } from '@salesforce/salesforcedx-utils-vscode';
import { URI, Utils } from 'vscode-uri';
import { VSCODE_LWC_EXTENSION_NAME } from '../../constants';
import { TestResult, TestResultStatus } from '../types';

const extensionPath = extensionUris.extensionUri(VSCODE_LWC_EXTENSION_NAME);
const LIGHT_BLUE_BUTTON = Utils.joinPath(extensionPath, 'resources', 'light', 'testNotRun.svg');

const LIGHT_RED_BUTTON = Utils.joinPath(extensionPath, 'resources', 'light', 'testFail.svg');

const LIGHT_GREEN_BUTTON = Utils.joinPath(extensionPath, 'resources', 'light', 'testPass.svg');
const LIGHT_ORANGE_BUTTON = Utils.joinPath(extensionPath, 'resources', 'light', 'testSkip.svg');

const DARK_BLUE_BUTTON = Utils.joinPath(extensionPath, 'resources', 'dark', 'testNotRun.svg');
const DARK_RED_BUTTON = Utils.joinPath(extensionPath, 'resources', 'dark', 'testFail.svg');
const DARK_GREEN_BUTTON = Utils.joinPath(extensionPath, 'resources', 'dark', 'testPass.svg');
const DARK_ORANGE_BUTTON = Utils.joinPath(extensionPath, 'resources', 'dark', 'testSkip.svg');

type IconPath = { light: URI; dark: URI };

/**
 * Get icon path in the test explorer for test result
 * @param testResult test result
 */
export const getIconPath = (testResult?: TestResult): IconPath => {
  switch (testResult?.status) {
    case TestResultStatus.PASSED:
      return {
        light: LIGHT_GREEN_BUTTON,
        dark: DARK_GREEN_BUTTON
      };
    case TestResultStatus.FAILED:
      return {
        light: LIGHT_RED_BUTTON,
        dark: DARK_RED_BUTTON
      };
    case TestResultStatus.SKIPPED:
      return {
        light: LIGHT_ORANGE_BUTTON,
        dark: DARK_ORANGE_BUTTON
      };
    default:
      return {
        light: LIGHT_BLUE_BUTTON,
        dark: DARK_BLUE_BUTTON
      };
  }
};
