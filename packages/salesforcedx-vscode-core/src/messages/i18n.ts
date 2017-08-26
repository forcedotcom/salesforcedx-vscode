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
  channel_name: 'Salesforce DX CLI',
  channel_starting_message: 'Starting ',
  channel_end_with_exit_code: 'ended with exit code %s',
  channel_end_with_sfdx_not_found:
    'The SFDX CLI is not installed. Install it from https://developer.salesforce.com/tools/sfdxcli',
  channel_end_with_error: 'ended with error %s',
  channel_end: 'ended',

  notification_successful_execution_text: '%s successfully ran',
  notification_canceled_execution_text: '%s was canceled',
  notification_unsuccessful_execution_text: '%s failed to run',
  notification_show_button_text: 'Show',

  predicates_no_folder_opened_text:
    'No folder opened. Open a Salesforce DX project in VS Code.',
  predicates_no_sfdx_project_found_text:
    'No sfdx-project.json found in the root directory of your open project. Open a Salesforce DX project in VS Code.',

  task_view_running_message: '[Running] %s',

  status_bar_text: `$(x) %s`,
  status_bar_tooltip: 'Click to cancel the command',

  force_auth_web_login_authorize_dev_hub_text: 'SFDX: Authorize a Dev Hub',

  parameter_gatherer_enter_file_name: 'Enter desired filename',
  parameter_gatherer_enter_dir_name:
    "Enter desired directory (Press 'Enter' to confirm or 'Escape' to cancel)",

  force_org_create_default_scratch_org_text:
    'SFDX: Create a Default Scratch Org...',

  force_org_open_default_scratch_org_text: 'SFDX: Open Default Scratch Org',

  force_source_pull_default_scratch_org_text:
    'SFDX: Pull Source from Default Scratch Org',

  force_source_push_default_scratch_org_text:
    'SFDX: Push Source to Default Scratch Org',

  force_source_status_text:
    'View All Changes (Local and in Default Scratch Org)',

  force_apex_test_run_text: 'SFDX: Invoke Apex Tests...',
  force_apex_test_run_all_test_label: 'All tests',
  force_apex_test_run_all_tests_desription_text:
    'Runs all tests in the current project',

  force_apex_class_create_text: 'SFDX: Create Apex Class',
  force_visualforce_component_create_text: 'SFDX: Create Visualforce Component',
  force_visualforce_page_create_text: 'SFDX: Create Visualforce Page',
  force_lightning_app_create_text: 'SFDX: Create Lightning App'
};
