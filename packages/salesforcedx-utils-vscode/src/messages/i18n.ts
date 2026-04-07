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
 * If omitted, we will assume _message.
 */
export const messages = {

  progress_notification_text: 'Running %s',
  notification_successful_execution_text: '%s successfully ran',
  notification_canceled_execution_text: '%s was canceled',
  notification_unsuccessful_execution_text: '%s failed to run',
  notification_show_button_text: 'Show',
  notification_show_in_status_bar_button_text: 'Show Only in Status Bar',
  notification_make_default_dev: 'Authorize a Dev Hub',
  error_no_target_org:
    'No default org is set. Run "SFDX: Create a Default Scratch Org" or "SFDX: Authorize an Org" to set one.',
  error_no_target_dev_hub: 'No target Dev Hub is set. Run "SFDX: Authorize a Dev Hub" to set one.',

  error_access_token_expired: 'Access token expired or invalid.',
  error_access_token_expired_detail:
    'Please reauthenticate using the login button or the `SFDX Authorize an Org` command.  See the output channel for more details on the auth error',
  error_access_token_expired_login_button: 'Login',

  channel_starting_message: 'Starting ',
  channel_end_with_exit_code: 'ended with exit code %s',
  channel_end_with_sfdx_not_found:
    'Salesforce CLI is not installed. Install it from https://developer.salesforce.com/tools/salesforcecli',
  channel_end_with_error: 'ended with error %s',
  channel_end: 'Ended',
  warning_using_global_username:
    'No target org found in the local project config; using the global target org. Run "SFDX: Authorize an Org" to set the username for the local project config.'
} as const;

export type MessageKey = keyof typeof messages;
