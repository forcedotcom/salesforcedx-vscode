import * as vscode from 'vscode';
import { SETTING_CLEAR_OUTPUT_TAB, SFDX_CORE_CONFIGURATION_NAME, SETTING_SUPRESS_OUTPUT_TAB } from '../constants';

export class SfdxSettingsService {
  public static getEnableClearOutputBeforeEachCommand(): boolean {
    return vscode.workspace
      .getConfiguration(SFDX_CORE_CONFIGURATION_NAME)
      .get<boolean>(SETTING_CLEAR_OUTPUT_TAB, false);
  }

  public static getSuppressOutputAfterEachCommand(): boolean {
    return vscode.workspace
      .getConfiguration(SFDX_CORE_CONFIGURATION_NAME)
      .get<boolean>(SETTING_SUPRESS_OUTPUT_TAB, false);
  }
}
