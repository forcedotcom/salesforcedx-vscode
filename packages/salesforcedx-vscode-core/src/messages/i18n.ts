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
  channel_name: 'Salesforce CLI',
  channel_starting_message: 'Starting ',
  channel_end_with_exit_code: 'ended with exit code %s',
  channel_end_with_sfdx_not_found:
    'Salesforce CLI is not installed. Install it from https://developer.salesforce.com/tools/sfdxcli',
  channel_end_with_error: 'ended with error %s',
  channel_end: 'ended',

  progress_notification_text: 'Running %s',

  notification_successful_execution_text: '%s successfully ran',
  notification_canceled_execution_text: '%s was canceled',
  notification_unsuccessful_execution_text: '%s failed to run',
  notification_show_button_text: 'Show',
  notification_show_in_status_bar_button_text: 'Show Only in Status Bar',

  predicates_no_folder_opened_text:
    'No folder opened. Open a Salesforce DX project in VS Code.',
  predicates_no_sfdx_project_found_text:
    'No sfdx-project.json found in the root directory of your open project. Open a Salesforce DX project in VS Code.',

  task_view_running_message: '[Running] %s',

  status_bar_text: `$(x) %s`,
  status_bar_tooltip: 'Click to cancel the command',

  force_auth_web_login_authorize_dev_hub_text: 'SFDX: Authorize a Dev Hub',
  force_auth_web_login_authorize_org_text: 'SFDX: Authorize an Org',

  parameter_directory_strict_not_available:
    'A required metadata folder named "%s" does not exist in this workspace.',

  parameter_gatherer_enter_file_name: 'Enter desired filename',
  parameter_gatherer_enter_dir_name:
    'Enter desired directory (Press Enter to confirm or Esc to cancel)',
  parameter_gatherer_enter_username_name: 'Enter target username',
  parameter_gatherer_enter_alias_name:
    'Enter an org alias or use default alias',
  parameter_gatherer_enter_custom_url:
    'Enter a custom login URL or use default URL',
  parameter_gatherer_enter_scratch_org_expiration_days:
    'Enter the number of days (1–30) until scratch org expiration or use the default value (7)',
  parameter_gatherer_enter_project_name: 'Enter project name',
  parameter_gatherer_paste_forceide_url: 'Paste forceide:// URL from Setup',
  parameter_gatherer_paste_forceide_url_placeholder:
    'forceide:// URL from Setup',
  parameter_gatherer_invalid_forceide_url:
    "The forceide:// URL is invalid. From your subscriber's org, copy and paste the forceide:// URL shown on the Apex Debugger page in Setup.",

  force_org_create_default_scratch_org_text:
    'SFDX: Create a Default Scratch Org...',

  force_org_open_default_scratch_org_text: 'SFDX: Open Default Org',

  force_source_pull_default_scratch_org_text:
    'SFDX: Pull Source from Default Scratch Org',
  force_source_pull_force_default_scratch_org_text:
    'SFDX: Pull Source from Default Scratch Org and Override Conflicts',

  force_source_push_default_scratch_org_text:
    'SFDX: Push Source to Default Scratch Org',
  force_source_push_force_default_scratch_org_text:
    'SFDX: Push Source to Default Scratch Org and Override Conflicts',

  force_source_deploy_text: 'SFDX: Deploy Source to Org',
  force_source_deploy_select_file_or_directory:
    'You can run SFDX: Deploy Source to Org only on a source file or directory.',
  force_source_deploy_select_manifest:
    'You can run SFDX: Deploy Source in Manifest to Org only on a manifest file.',
  force_source_retrieve_text: 'SFDX: Retrieve Source from Org',
  force_source_retrieve_select_file_or_directory:
    'You can run SFDX: Retrieve Source from Org only on a source file or directory.',
  force_source_retrieve_select_manifest:
    'You can run SFDX: Retrieve Source in Manifest from Org only on a manifest file.',
  force_source_delete_text: 'SFDX: Delete from Project and Org',
  force_source_delete_manifest_unsupported_message:
    'SFDX: Delete from Project and Org is not supported for manifest files. Select a source file or directory to delete.',
  force_source_delete_select_file_or_directory:
    'You can run SFDX: Delete from Project and Org only on a source file or directory.',
  force_source_delete_confirmation_message:
    'Deleting source files deletes the files from your computer and removes the corresponding metadata from your default org. Are you sure you want to delete this source from your project and your org?',
  confirm_delete_source_button_text: 'Delete Source',
  cancel_delete_source_button_text: 'Cancel',

  force_source_status_text:
    'View All Changes (Local and in Default Scratch Org)',

  force_apex_test_run_text: 'SFDX: Invoke Apex Tests...',
  force_apex_test_run_all_test_label: 'All tests',
  force_apex_test_run_all_tests_description_text:
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
    'One or more %s files with the specified path already exist in your workspace. Do you want to overwrite them?',
  warning_prompt_dir_overwrite:
    'A folder with the specified project name already exists in the selected directory. Do you want to overwrite it?',
  warning_prompt_overwrite_confirm: 'Overwrite',
  warning_prompt_overwrite_cancel: 'Cancel',
  force_config_list_text: 'SFDX: List All Config Variables',
  force_alias_list_text: 'SFDX: List All Aliases',
  force_org_display_default_text: 'SFDX: Display Org Details for Default Org',
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
  force_project_create_text: 'SFDX: Create Project',
  force_project_create_open_dialog_create_label: 'Create Project',
  force_apex_trigger_create_text: 'SFDX: Create Apex Trigger',
  force_start_apex_debug_logging:
    'SFDX: Turn On Apex Debug Log for Replay Debugger',
  force_apex_debug_log_status_bar_text:
    '$(file-text) Recording detailed logs until %s',
  force_apex_debug_log_status_bar_hover_text:
    'Writing debug logs for Apex and Visualforce at the %s log level until %s on %s',
  force_stop_apex_debug_logging:
    'SFDX: Turn Off Apex Debug Log for Replay Debugger',
  isv_debug_bootstrap_step1_create_project:
    'SFDX: ISV Debugger Setup, Step 1 of 7: Creating project',
  isv_debug_bootstrap_step2_configure_project:
    'SFDX: ISV Debugger Setup, Step 2 of 7: Configuring project',
  isv_debug_bootstrap_step2_configure_project_retrieve_namespace:
    'SFDX: ISV Debugger Setup, Step 2 of 7: Configuring project: Retrieving namespace',
  isv_debug_bootstrap_step3_retrieve_org_source:
    'SFDX: ISV Debugger Setup, Step 3 of 7: Retrieving unpackaged Apex code',
  isv_debug_bootstrap_step4_convert_org_source:
    'SFDX: ISV Debugger Setup, Step 4 of 7: Converting unpackaged Apex code',
  isv_debug_bootstrap_step5_list_installed_packages:
    'SFDX: ISV Debugger Setup, Step 5 of 7: Querying for installed packages',
  isv_debug_bootstrap_step6_retrieve_packages_source:
    'SFDX: ISV Debugger Setup, Step 6 of 7: Retrieving packages',
  isv_debug_bootstrap_step7_convert_package_source:
    'SFDX: ISV Debugger Setup, Step 7 of 7: Converting package: %s',
  isv_debug_bootstrap_processing_package: 'Processing package: %s',
  isv_debug_bootstrap_generate_launchjson: 'Creating launch configuration',
  isv_debug_bootstrap_open_project:
    'Opening project in new Visual Studio Code window',

  force_apex_log_get_text: 'SFDX: Get Apex Debug Logs...',
  force_apex_log_get_no_logs_text: 'No Apex debug logs were found',
  force_apex_log_get_pick_log_text: 'Pick an Apex debug log to get',
  force_apex_log_list_text: 'Getting Apex debug logs',

  error_creating_packagexml: 'Error creating package.xml. %s',
  error_extracting_org_source: 'Error extracting downloaded Apex source. %s',
  error_extracting_packages: 'Error extracting packages: %s',
  error_updating_sfdx_project: 'Error updating sfdx-project.json: %s',
  error_writing_installed_package_info:
    'Error writing installed-package.json: %s',
  error_cleanup_temp_files: 'Error cleaning up temporary files: %s',

  demo_mode_status_text: `$(gist-secret) SFDX DEMO`,
  demo_mode_status_tooltip:
    'You are running Salesforce Extensions for VS Code in demo mode. You will be prompted for confirmation when connecting to production orgs.',
  demo_mode_prompt:
    'Authorizing a business or production org is not recommended on a demo or shared machine. If you continue with the authentication, be sure to run "SFDX: Log Out from All Authorized Orgs" when you\'re done using this org.',
  force_auth_logout_all_text: 'SFDX: Log Out from All Authorized Orgs',
  manifest_editor_title_message: 'Manifest Editor',
  REST_API: 'REST API',
  tooling_API: 'Tooling API',
  REST_API_description: 'Execute the query with REST API',
  tooling_API_description: 'Execute the query with Tooling API',
  telemetry_legal_dialog_message:
    'You agree that Salesforce Extensions for VS Code may collect usage information, user environment, and crash reports for product improvements. Learn how to [opt out](%s).',
  telemetry_legal_dialog_button_text: 'Read more',
  invalid_debug_level_id_error:
    'At least one trace flag in your org doesn\'t have an associated debug level. Before you run this command again, run "sfdx force:data:soql:query -t -q "SELECT Id FROM TraceFlag WHERE DebugLevelId = null"". Then, to delete each invalid trace flag, run "sfdx force:data:record:delete -t -s TraceFlag -i 7tfxxxxxxxxxxxxxxx", replacing 7tfxxxxxxxxxxxxxxx with the ID of each trace flag without a debug level.',
  auth_project_label: 'Project Default',
  auth_project_detail: 'Use login URL defined in sfdx-project.json',
  auth_prod_label: 'Production',
  auth_prod_detail: 'login.salesforce.com',
  auth_sandbox_label: 'Sandbox',
  auth_sandbox_detail: 'test.salesforce.com',
  auth_custom_label: 'Custom',
  auth_custom_detail: 'Enter a custom login URL',
  auth_invalid_url: 'URL must begin with http:// or https://',
  error_fetching_auth_info_text:
    'Error running push or deploy on save: We couldn\'t connect to your default org. Run "SFDX: Create a Default Scratch Org" or "SFDX: Authorize an Org", then push or deploy the source that you just saved. Or, to disable push or deploy on save, set "salesforcedx-vscode-core.push-or-deploy-on-save.enabled" to false in your user or workspace settings for VS Code.',
  error_no_package_directories_found_on_setup_text:
    'Error setting up push or deploy on save: Your sfdx-project.json file doesn\'t contain a "packageDirectories" property. Add this property, or, to disable push or deploy on save, set "salesforcedx-vscode-core.push-or-deploy-on-save.enabled" to false in your user or workspace settings for VS Code. For details about sfdx-project.json, see: https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm',
  error_no_package_directories_paths_found_text:
    'Error setting up push or deploy on save: The "packageDirectories" property in your sfdx-project.json file doesn\'t contain a "path" value. Add a value for the "path" property, or, to disable push or deploy on save, set "salesforcedx-vscode-core.push-or-deploy-on-save.enabled" to false in your user or workspace settings for VS Code. For details about sfdx-project.json, see: https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm',
  error_push_or_deploy_on_save_no_default_username:
    'Error running push or deploy on save: No default org is set. Run "SFDX: Create a Default Scratch Org" or "SFDX: Authorize an Org", then push or deploy the changes that you just saved. Or, to disable push or deploy on save, set "salesforcedx-vscode-core.push-or-deploy-on-save.enabled" to false in your user or workspace settings for VS Code.',
  error_source_path_not_in_package_directory_text:
    'Error deploying or retrieving source: The file or directory that you tried to deploy or retrieve isn\'t in a package directory that\'s specified in your sfdx-project.json file. Add this location to your "packageDirectories" value, or deploy or retrieve a different file or directory. For details about sfdx-project.json, see: https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm',
  org_select_text: 'Select an org to set as default',
  missing_default_org: 'No Default Org Set',
  force_config_set_org_text: 'SFDX: Set a Default Org',
  error_parsing_sfdx_project_file:
    "Couldn't parse sfdx-project.json file (%s). Parse error: %s",
  sfdx_cli_not_found:
    'Salesforce CLI is not installed. Install it from [%s](%s)',
  table_header_errors: 'ERRORS',
  table_header_project_path: 'PROJECT PATH',
  table_header_type: 'TYPE',
  table_header_full_name: 'FULL NAME',
  table_header_state: 'STATE',
  table_no_results_found: 'No results found',
  table_title_deployed_source: 'Deployed Source',
  table_title_deploy_errors: 'Deploy Errors',
  table_title_pushed_source: 'Pushed Source',
  table_title_push_errors: 'Push Errors',
  push_conflicts_error:
    'We couldn’t push your source due to conflicts. Make sure that you want to overwrite the metadata in your org with your local files, then run "SFDX: Push Source to Default Scratch Org and Override Conflicts".',
  error_no_default_username:
    'No default org is set. Run "SFDX: Create a Default Scratch Org" or "SFDX: Authorize an Org" to set one.',
  error_no_default_devhubusername:
    'No default Dev Hub is set. Run "SFDX: Authorize a Dev Hub" to set one.',
  custom_output_directory: 'Choose a Custom Directory',
  warning_using_global_username:
    'No default username found in the local project config; using the global default username. Run "SFDX: Authorize an Org" to set the username for the local project config.',
  apex_class_message_name: 'Apex Class',
  apex_trigger_message_name: 'Apex Trigger',
  visualforce_component_message_name: 'Visualforce Component',
  visualforce_page_message_name: 'Visualforce Page',
  aura_bundle_message_name: 'Aura Bundle',
  lwc_message_name: 'Lightning Web Component',
  force_lightning_lwc_create_text: 'SFDX: Create Lightning Web Component'
};
