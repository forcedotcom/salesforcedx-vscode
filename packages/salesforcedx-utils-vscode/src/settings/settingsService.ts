/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import {
  ADVANCED,
  SETTING_CLEAR_OUTPUT_TAB,
  SFDX_CORE_CONFIGURATION_NAME,
  TRUE
} from '../constants';
import { AdvancedSettings } from './AdvancedSettings';

export class SettingsService {
  public static getEnableClearOutputBeforeEachCommand(): boolean {
    return vscode.workspace
      .getConfiguration(SFDX_CORE_CONFIGURATION_NAME)
      .get<boolean>(SETTING_CLEAR_OUTPUT_TAB, false);
  }

  public static isAdvancedSettingEnabledFor(
    extensionName: string,
    advancedSetting: AdvancedSettings
  ): boolean {
    const isAdvancedSettingEnabled = vscode.workspace
      .getConfiguration()
      .get<string>(`${extensionName}.${ADVANCED}.${advancedSetting}`);
    // if the setting doesn't exist for this extension, false will be returned
    const booleanVal = isAdvancedSettingEnabled === TRUE;
    return booleanVal;
  }
}
