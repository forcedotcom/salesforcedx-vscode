/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Conventions:
 * _message: is for unformatted text that will be shown as-is to
 * the user.
 * _text: is for text that will appear in the UI, possibly with
 * decorations, e.g., $(x) uses the https://octicons.github.com/ and should not
 * be localized
 *
 * If ommitted, we will assume _message.
 */
export const messages = {
  salesforcedx_vscode_core_not_installed_text:
    'salesforce.salesforcedx-vscode-lwc failed to activate. Ensure that you have the latest version of salesforce.salesforcedx-vscode-core installed and activated',
  force_lightning_lwc_start_not_found:
    'This command requires installing the @salesforce/lwc-dev-server plugin. For detailed instructions go to https://developer.salesforce.com/tools/vscode/en/lwc/localdev',
  force_lightning_lwc_start_failed:
    'The local development server failed to start',
  force_lightning_lwc_start_text: 'SFDX: Start Local Development Server',
  force_lightning_lwc_stop_text: 'SFDX: Stop Local Development Server',
  force_lightning_lwc_preview_text: 'SFDX: Preview Component Locally',
  force_lightning_lwc_open_text:
    'SFDX: Open Local Development Server in Browser',
  force_lightning_lwc_server_stopping: 'Stopping local development server',
  warning_message_server_running:
    'The local development server is already running',
  prompt_option_open_browser: 'Open Browser',
  prompt_option_restart: 'Restart',
  warning_message_server_exited:
    'The local development server exited because of an error'
};
