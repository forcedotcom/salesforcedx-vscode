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
    'Enter desired directory (Press Enter to confirm or Esc to cancel)',
  parameter_gatherer_enter_username_name: 'Enter target username',
  parameter_gatherer_enter_alias_name: 'Enter a scratch org alias',
  parameter_gatherer_enter_project_name: 'Enter project name',

  force_org_create_default_scratch_org_text:
    'SFDX: Create a Default Scratch Org...',

  force_org_open_default_scratch_org_text: 'SFDX: Open Default Scratch Org',

  force_source_pull_default_scratch_org_text:
    'SFDX: Pull Source from Default Scratch Org',
  force_source_pull_force_default_scratch_org_text:
    'SFDX: Pull Source from Default Scratch Org and Override Conflicts',

  force_source_push_default_scratch_org_text:
    'SFDX: Push Source to Default Scratch Org',
  force_source_push_force_default_scratch_org_text:
    'SFDX: Push Source to Default Scratch Org and Override Conflicts',

  force_source_status_text:
    'View All Changes (Local and in Default Scratch Org)',

  force_apex_test_run_text: 'SFDX: Invoke Apex Tests...',
  force_apex_test_run_all_test_label: 'All tests',
  force_apex_test_run_all_tests_desription_text:
    'Runs all tests in the current project',

  force_apex_class_create_text: 'SFDX: Create Apex Class',
  force_visualforce_component_create_text: 'SFDX: Create Visualforce Component',
  force_visualforce_page_create_text: 'SFDX: Create Visualforce Page',
  force_lightning_app_create_text: 'SFDX: Create Lightning App',
  force_lightning_component_create_text: 'SFDX: Create Lightning Component',
  force_lightning_event_create_text: 'SFDX: Create Lightning Event',
  force_lightning_interface_create_text: 'SFDX: Create Lightning Interface',
  force_source_status_local_text: 'SFDX: View Local Changes',
  force_source_status_remote_text: 'SFDX: View Changes in Default Scratch Org',
  warning_prompt_file_overwrite:
    'One or more files with the specified path already exist in your workspace. Do you want to overwrite them?',
  warning_prompt_dir_overwrite:
    'A folder with the specified project name already exists in the selected directory. Do you want to overwrite it?',
  warning_prompt_lightning_bundle_overwrite:
    'A Lightning bundle with the specified path already exists in your workspace. Do you want to overwrite any existing files in this bundle?',
  warning_prompt_yes: 'Yes',
  warning_prompt_no: 'No',
  force_config_list_text: 'SFDX: List All Config Variables',
  force_alias_list_text: 'SFDX: List All Aliases',
  force_org_display_default_text:
    'SFDX: Display Org Details for Default Scratch Org',
  force_org_display_username_text: 'SFDX: Display Org Details...',
  force_debugger_query_session_text: 'query for Apex Debugger session',
  force_debugger_stop_text: 'SFDX: Stop Apex Debugger Session',
  force_debugger_stop_none_found_text: 'No Apex Debugger session found.',
  force_data_soql_query_input_text: 'SFDX: Execute SOQL Query...',
  force_data_soql_query_selection_text:
    'SFDX: Execute SOQL Query with Currently Selected Text',
  parameter_gatherer_enter_soql_query: 'Enter the SOQL query',
  force_apex_execute_document_text:
    'SFDX: Execute Anonymous Apex with Editor Contents',
  force_apex_execute_selection_text:
    'SFDX: Execute Anonymous Apex with Currently Selected Text',
  force_sobjects_refresh: 'SFDX: Refresh SObject Definitions',
  force_project_create_text: 'SFDX: Create Project',
  force_project_create_open_dialog_create_label: 'Create Project',
  force_apex_trigger_create_text: 'SFDX: Create Apex Trigger'
};
