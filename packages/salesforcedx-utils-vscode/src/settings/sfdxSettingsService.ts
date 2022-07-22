import * as vscode from 'vscode';
import { ENABLE_CLEAR_OUTPUT_BEFORE_EACH_COMMAND, SFDX_CORE_CONFIGURATION_NAME } from '../constants';

export class SfdxSettingsService {
  public static getEnableClearOutputBeforeEachCommand(): boolean {
    return vscode.workspace
      .getConfiguration(SFDX_CORE_CONFIGURATION_NAME)
      .get<boolean>(ENABLE_CLEAR_OUTPUT_BEFORE_EACH_COMMAND, false);
  }
}
