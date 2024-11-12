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
  sfdx_cli_not_found: 'Salesforce CLI is not installed. Install it from [%s](%s)',
  telemetry_legal_dialog_message:
    'You agree that Salesforce Extensions for VS Code may collect usage information, user environment, and crash reports for product improvements. Learn how to [opt out](%s).',
  telemetry_legal_dialog_button_text: 'Read more',

  progress_notification_text: 'Running %s',
  notification_successful_execution_text: '%s successfully ran',
  notification_canceled_execution_text: '%s was canceled',
  notification_unsuccessful_execution_text: '%s failed to run',
  notification_show_button_text: 'Show',
  notification_show_in_status_bar_button_text: 'Show Only in Status Bar',

  error_no_target_org:
    'No default org is set. Run "SFDX: Create a Default Scratch Org" or "SFDX: Authorize an Org" to set one.',
  cannot_determine_workspace: 'Unable to determine workspace folders for workspace',

  channel_name: 'Salesforce CLI',
  channel_starting_message: 'Starting ',
  channel_end_with_exit_code: 'ended with exit code %s',
  channel_end_with_sfdx_not_found:
    'Salesforce CLI is not installed. Install it from https://developer.salesforce.com/tools/salesforcecli',
  channel_end_with_error: 'ended with error %s',
  channel_end: 'ended',
  predicates_no_folder_opened_text: 'No folder opened. Open a Salesforce DX project in VS Code.',
  predicates_no_salesforce_project_found_text:
    'No sfdx-project.json found in the root directory of your open project. Open a Salesforce DX project in VS Code.',
  trace_flags_unknown_user: 'Unknown user',
  trace_flags_failed_to_create_debug_level: 'Failed to create a debug level',
  no_local_or_remote_changes_found: 'No local or remote changes found.',
  state: 'STATE',
  full_name: 'FULL NAME',
  type: 'TYPE',
  project_path: 'PROJECT PATH',
  ignored: 'IGNORED'
};
