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
  command_failure: '%s failed to run',
  command_canceled: '%s was canceled',
  force_lightning_lwc_start_text: 'SFDX: Start Local Development Server',
  force_lightning_lwc_start_not_found:
    'This command requires installing the @salesforce/lwc-dev-server plugin. For detailed instructions go to https://developer.salesforce.com/tools/vscode/en/lwc/localdev',
  force_lightning_lwc_start_failed:
    'The local development server was not able to start',
  force_lightning_lwc_start_exited:
    'The local development server exited unexpectedly with code %s',
  force_lightning_lwc_start_already_running:
    'The local development server is already running',
  force_lightning_lwc_start_stopping: 'Stopping the local development server',
  force_lightning_lwc_stop_text: 'SFDX: Stop Local Development Server',
  force_lightning_lwc_stop_not_running:
    'The local development server is not running',
  force_lightning_lwc_stop_in_progress: 'Stopping local development server',
  force_lightning_lwc_preview_text: 'SFDX: Preview Component Locally',
  force_lightning_lwc_preview_no_file:
    'The LWC module is not specified or does not exist: %s',
  force_lightning_lwc_preview_unsupported:
    "'%s' is not a recognizable LWC module",
  force_lightning_lwc_open_text:
    'SFDX: Open Local Development Server in Browser',
  prompt_option_open_browser: 'Open Browser',
  prompt_option_restart: 'Restart'
};
