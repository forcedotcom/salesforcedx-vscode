/*
 * Copyright (c) 2025, salesforce.com, inc.
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
  auth_custom_detail: 'Enter a custom login URL',
  auth_custom_label: 'Custom',
  auth_invalid_url: 'URL must begin with http:// or https://',
  auth_prod_detail: 'login.salesforce.com',
  auth_prod_label: 'Production',
  auth_project_detail: 'Use login URL defined in sfdx-project.json',
  auth_project_label: 'Project Default',
  auth_sandbox_detail: 'test.salesforce.com',
  auth_sandbox_label: 'Sandbox',
  channel_name: 'Salesforce Org Management',
  config_set_name: 'Set Config',
  config_set_org_text: 'SFDX: Set a Default Org',
  default_org_expired:
    'Your default org has expired. Some of the command palette commands may no longer work. Switch your default org and try again.',
  error_invalid_org_alias: 'Alias can only contain underscores, spaces and alphanumeric characters',
  error_invalid_expiration_days: 'Number of days should be between 1 and 30',
  error_no_scratch_def:
    'No scratch definition files found. These files must be in the "config" folder and end with "-scratch-def.json". See [Scratch Org Definition File](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_scratch_orgs_def_file.htm) for help.',
  error_no_target_dev_hub: 'No target Dev Hub is set. Run "SFDX: Authorize a Dev Hub" to set one.',
  error_no_target_org:
    'No default org is set. Run "SFDX: Create a Default Scratch Org" or "SFDX: Authorize an Org" to set one.',
  invalid_default_org: "The org you've chosen as your default org isn't valid. Please choose a different one.",
  missing_default_org: 'No Default Org Set',
  notification_make_default_dev: 'Authorize a Dev Hub',
  org_create_default_scratch_org_text: 'SFDX: Create a Default Scratch Org...',
  org_create_result_parsing_error: 'An unexpected error occurred while processing the org create response.',
  org_delete_default_text: 'SFDX: Delete Default Org',
  org_delete_username_text: 'SFDX: Delete Org...',
  org_display_default_text: 'SFDX: Display Org Details for Default Org',
  org_display_username_text: 'SFDX: Display Org Details...',
  org_expired: 'Expired',
  org_list_clean_failed_to_remove_org: 'Failed to remove org %s: %s',
  org_list_clean_error_checking_org: 'Error checking org %s: %s',
  org_list_clean_general_error: 'General error during org cleanup: %s',
  org_list_clean_skipping_org_with_error: 'Skipping org %s with error: %s',
  org_list_clean_removing_expired_org: 'Removing expired org %s (expired: %s)',
  org_list_clean_removing_invalid_org: 'Removing invalid/deleted org %s (error: %s)',
  org_list_clean_success_message: 'Successfully removed %d expired and deleted orgs.',
  org_list_clean_no_orgs_message: 'No expired or deleted orgs found to remove.',
  org_list_clean_text: 'SFDX: Remove Deleted and Expired Orgs',
  org_list_no_orgs_found: 'No orgs found.',
  org_list_display_error: 'Error displaying org list: %s',
  org_login_access_token_bad_oauth_token_message:
    'The session ID that you are trying to use is not valid. Check if it has expired, or use a valid session ID.',
  org_login_access_token_text: 'SFDX: Authorize an Org using Session ID',
  org_login_web_authorize_dev_hub_text: 'SFDX: Authorize a Dev Hub',
  org_login_web_authorize_org_text: 'SFDX: Authorize an Org',
  org_logout_all_text: 'SFDX: Log Out from All Authorized Orgs',
  org_logout_default_text: 'SFDX: Log Out from Default Org',
  org_logout_no_default_org: 'No default org to logout from',
  org_logout_scratch_logout: 'Logout',
  org_logout_scratch_prompt:
    'Log out of this scratch org?\n\nBefore logging out, ensure that you or someone on your team has a username and password for %s scratch org. Otherwise you might lose all access to this scratch org.',
  org_open_default_scratch_org_container_error: 'There was an unexpected error when processing the org open response.',
  org_open_default_scratch_org_text: 'SFDX: Open Default Org',
  org_open_container_mode_message_text: 'Access org %s as user %s with the following URL: %s',
  org_select_text: 'Select an org to set as default',
  parameter_gatherer_enter_alias_name: 'Enter an org alias or use the default alias',
  parameter_gatherer_enter_custom_url: 'Enter a custom login URL or use the default URL',
  parameter_gatherer_enter_instance_url: 'Enter Instance URL',
  parameter_gatherer_enter_scratch_org_def_files:
    'Select scratch definition file. Matched files with format: "config/**/*-scratch-def.json"',
  parameter_gatherer_enter_scratch_org_expiration_days:
    'Enter the number of days (1–30) until scratch org expiration or use the default value (7)',
  parameter_gatherer_enter_session_id: 'Enter Session ID',
  parameter_gatherer_enter_session_id_diagnostic_message: 'Enter a valid Session ID',
  parameter_gatherer_enter_session_id_placeholder: 'Session ID',
  parameter_gatherer_placeholder_delete_selected_org: 'Confirm to continue deleting the selected org',
  parameter_gatherer_placeholder_delete_default_org: 'Confirm to continue deleting the default org',
  parameter_gatherer_placeholder_org_list_clean: 'Confirm to continue removing deleted and expired scratch orgs',
  pending_org_expiration_expires_on_message: '%s\n(expires on %s)',
  pending_org_expiration_notification_message:
    'Warning: One or more of your orgs expire in the next %d days. For more details, review the Output panel.',
  pending_org_expiration_output_channel_message:
    'Warning: The following orgs expire in the next %d days:\n\n%s\n\nIf these orgs contain critical data or settings, back them up before the org expires.',
  status_bar_open_org_tooltip: 'Open Default Org in Browser',
  status_bar_org_picker_tooltip: 'Click to change your default org',
  table_header_name: 'Name',
  table_header_value: 'Value',
  table_header_success: 'Success',
  warning_using_global_username:
    'No target org found in the local project config; using the global target org. Run "SFDX: Authorize an Org" to set the username for the local project config.'
} as const;

export type MessageKey = keyof typeof messages;
