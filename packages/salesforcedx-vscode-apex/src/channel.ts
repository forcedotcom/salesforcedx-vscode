import { OutputChannel, window } from 'vscode';
import { nls } from './messages';

export const APEX_LANGUAGE_SERVER_CHANNEL = window.createOutputChannel(
  nls.localize('client_name')
);
