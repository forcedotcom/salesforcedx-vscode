import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { channelService } from '../../channels';
import { nls } from '../../messages';
import { notificationService } from '../../notifications';
import { telemetryService } from '../../telemetry';

type input =
  | {
      message: 'deploy_select_file_or_directory';
      exceptionKey: 'deploy_with_sourcepath';
    }
  | {
      message: 'retrieve_select_file_or_directory';
      exceptionKey: 'retrieve_with_sourcepath';
    };

export const getUriFromActiveEditor = ({ message, exceptionKey }: input): URI | undefined => {
  const editor = vscode.window.activeTextEditor;
  if (editor?.document.languageId !== 'forcesourcemanifest') {
    return editor?.document.uri;
  }

  const errorMessage = nls.localize(message);
  telemetryService.sendException(exceptionKey, errorMessage);
  notificationService.showErrorMessage(errorMessage);
  channelService.appendLine(errorMessage);
  channelService.showChannelOutput();

  return undefined;
};
