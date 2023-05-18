import * as vscode from 'vscode';

import { nls } from '../messages';

export const OUTPUT_CHANNEL = vscode.window.createOutputChannel(
  nls.localize('channel_name')
);
