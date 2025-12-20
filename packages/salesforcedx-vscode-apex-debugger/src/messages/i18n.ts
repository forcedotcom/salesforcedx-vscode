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
  config_name_text: 'Launch Apex Debugger',
  select_exception_text: 'Select an exception',
  select_break_option_text: 'Select break option',
  always_break_text: 'Always break',
  never_break_text: 'Never break',
  language_client_not_ready: 'Unable to retrieve breakpoint info from language server, language server is not ready',
  isv_debug_config_environment_error:
    'Salesforce Extensions for VS Code encountered a problem while configuring your environment. Some features might not work. For details, click Help > Toggle Developer Tools or check the Salesforce CLI logs in ~/.sfdx/sfdx.log.',
  parameter_gatherer_enter_project_name: 'Enter project name',
  parameter_gatherer_paste_forceide_url: 'Paste forceide:// URL from Setup',
  parameter_gatherer_paste_forceide_url_placeholder: 'forceide:// URL from Setup',
  parameter_gatherer_invalid_forceide_url:
    "The forceide:// URL is invalid. From your subscriber's org, copy and paste the forceide:// URL shown on the Apex Debugger page in Setup.",
  isv_debug_bootstrap_create_project: 'SFDX: ISV Debugger Setup, Step 1 of 5: Creating project',
  isv_debug_bootstrap_configure_project: 'SFDX: ISV Debugger Setup, Step 2 of 5: Configuring project',
  isv_debug_bootstrap_configure_project_retrieve_namespace:
    'SFDX: ISV Debugger Setup, Step 2 of 5: Configuring project: Retrieving namespace',
  isv_debug_bootstrap_retrieve_org_source: 'SFDX: ISV Debugger Setup, Step 3 of 5: Retrieving unpackaged Apex code',
  isv_debug_bootstrap_list_installed_packages: 'SFDX: ISV Debugger Setup, Step 4 of 5: Querying for installed packages',
  isv_debug_bootstrap_retrieve_package_source: 'SFDX: ISV Debugger Setup, Step 5 of 5: Retrieving package: %s',
  isv_debug_bootstrap_processing_package: 'Processing package: %s',
  isv_debug_bootstrap_generate_launchjson: 'Creating launch configuration',
  isv_debug_bootstrap_open_project: 'Opening project in Visual Studio Code',
  error_creating_packagexml: 'Error creating package.xml. %s',
  error_updating_salesforce_project: 'Error updating sfdx-project.json: %s',
  error_writing_installed_package_info: 'Error writing installed-package.json: %s',
  error_cleanup_temp_files: 'Error cleaning up temporary files: %s',
  error_creating_launchjson: 'Error creating launch.json: %s',
  warning_prompt_dir_overwrite:
    'A folder with the specified project name already exists in the selected directory. Do you want to overwrite it?',
  warning_prompt_overwrite: 'Overwrite',
  warning_prompt_overwrite_cancel: 'Cancel',
  project_generate_open_dialog_create_label: 'Create Project',
  debugger_query_session_text: 'query for Apex Debugger session',
  debugger_stop_text: 'SFDX: Stop Apex Debugger Session',
  debugger_stop_none_found_text: 'No Apex Debugger session found.'
} as const;

export type MessageKey = keyof typeof messages;
