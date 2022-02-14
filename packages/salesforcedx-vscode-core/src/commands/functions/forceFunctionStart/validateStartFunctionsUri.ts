import { Uri, window } from 'vscode';
import { nls } from '../../../messages';
import { notificationService } from '../../../notifications';
import { telemetryService } from '../../../telemetry';

export const WARNING_MSG_KEY =
  'force_function_start_warning_not_in_function_folder';
export const NO_FUNCTION_FOLDER_KEY =
  'force_function_start_not_in_function_folder';

export const validateStartFunctionsUri = (sourceUri?: Uri): Uri | undefined => {
  if (!sourceUri) {
    // Try to start function from current active editor, if running SFDX: start function from command palette
    sourceUri = window.activeTextEditor?.document.uri!;
  }
  if (!sourceUri) {
    const warningMessage = nls.localize(WARNING_MSG_KEY);
    notificationService.showWarningMessage(warningMessage);
    telemetryService.sendException(NO_FUNCTION_FOLDER_KEY, warningMessage);
    return;
  }

  return sourceUri;
};
