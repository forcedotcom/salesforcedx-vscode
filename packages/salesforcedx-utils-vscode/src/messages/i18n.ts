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
  sfdx_cli_not_found:
    'Salesforce CLI is not installed. Install it from [%s](%s)',
  telemetry_legal_dialog_message:
    'You agree that Salesforce Extensions for VS Code may collect usage information, user environment, and crash reports for product improvements. Learn how to [opt out](%s).',
  telemetry_legal_dialog_button_text: 'Read more',

  channel_name: 'Salesforce CLI',
  channel_starting_message: 'Starting ',
  channel_end_with_exit_code: 'ended with exit code %s',
  channel_end_with_sfdx_not_found:
    'Salesforce CLI is not installed. Install it from https://developer.salesforce.com/tools/sfdxcli',
  channel_end_with_error: 'ended with error %s',
  channel_end: 'ended'
};
