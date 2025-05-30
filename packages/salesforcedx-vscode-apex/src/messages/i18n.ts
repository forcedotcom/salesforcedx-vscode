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
  active_text_editor_not_apex: 'The active text editor is not an Apex Class file',
  anon_apex_execute_document_text: 'SFDX: Execute Anonymous Apex with Editor Contents',
  anon_apex_execute_selection_text: 'SFDX: Execute Anonymous Apex with Currently Selected Text',
  apex_class_not_valid: 'The Apex Class %s is not valid for OpenAPI document generation.',
  apex_execute_compile_success: 'Compiled successfully.',
  apex_execute_runtime_success: 'Executed successfully.',
  apex_execute_text: 'Execute Anonymous Apex',
  apex_execute_unexpected_error: 'Unexpected error',
  apex_language_server_already_restarting: 'Apex Language Server is already restarting. Please wait.',
  apex_language_server_failed_activate: 'Unable to activate the Apex Language Server',
  apex_language_server_loaded: 'Indexing complete $(check)',
  apex_language_server_loading: 'Indexing Apex files. Hold tight, almost ready… $(sync~spin)',
  apex_language_server_quit_and_restarting: 'Apex Language Server has stopped. Restarting… %d of 5',
  apex_language_server_restart: 'Restart Apex Language Server',
  apex_language_server_restart_dialog_clean_and_restart: 'Clean Apex DB and Restart',
  apex_language_server_restart_dialog_prompt: 'Clean Apex DB and Restart? Or Restart Only?',
  apex_language_server_restart_dialog_restart_only: 'Restart Only',
  apex_language_server_restart_failed: 'Failed to restart Apex Language Server: ',
  apex_language_server_restarting: 'Apex Language Server is restarting… $(sync~spin)',
  apex_log_get_no_logs_text: 'No Apex debug logs were found',
  apex_log_get_pick_log_text: 'Pick an Apex debug log to get',
  apex_log_get_text: 'SFDX: Get Apex Debug Logs',
  apex_log_list_text: 'Getting Apex debug logs',
  apex_test_run_all_local_test_label: 'All Local Tests',
  apex_test_run_all_local_tests_description_text:
    'Runs all tests in the current org except the ones that originate from installed managed packages',
  apex_test_run_all_test_label: 'All Tests',
  apex_test_run_all_tests_description_text: 'Runs all tests in the current org',
  apex_test_run_codeAction_description_text: 'Run Apex test(s)',
  apex_test_run_codeAction_no_class_test_param_text:
    'Test class not provided. Run the code action on a class annotated with @isTest.',
  apex_test_run_codeAction_no_method_test_param_text:
    'Test method not provided. Run the code action on a method annotated with @isTest or testMethod.',
  apex_test_run_description_text: 'Run Apex test(s)',
  apex_test_run_text: 'SFDX: Run Apex Tests',
  apex_test_suite_build_text: 'SFDX: Build Apex Test Suite',
  artifact_failed: 'Failed to save the artifact: %s',
  cancel: 'Cancel',
  cannot_determine_workspace: 'Unable to determine workspace folders for workspace',
  cannot_gather_context: 'An error occurred while gathering context for the Apex class.',
  cannot_get_apexoaseligibility_response: 'Failed to get response through apexoas/isEligible from Apex Language Server',
  channel_name: 'Apex',
  check_openapi_doc_failed: 'Failed to check OpenAPI Document',
  check_openapi_doc_succeeded: 'Validated OpenAPI Document %s successfully',
  class_validation_failed: 'Failed to validate eligibility from %s',
  cleanup_openapi_doc_failed: 'Could not find OpenAPI document in the source:\n',
  client_name: 'Apex Language Server',
  colorizer_no_code_coverage_current_file:
    'No code coverage information was found for file %s. Set "salesforcedx-vscode-core.retrieve-test-code-coverage": true in your user or workspace settings. Then, run Apex tests that include methods in this file. You can run tests from the Apex Tests sidebar or using the Run Tests or Run All Tests code lens within the file.',
  colorizer_no_code_coverage_on_project:
    'No test run information was found for this project. Set "salesforcedx-vscode-core.retrieve-test-code-coverage": true in your user or workspace settings, then run Apex tests from the Apex Tests sidebar or using the Run Tests or Run All Tests code lens within a test class file.',
  colorizer_no_code_coverage_on_test_results:
    'No code coverage information was found for test run %s. Set "salesforcedx-vscode-core.retrieve-test-code-coverage": true in your user or workspace settings, then run Apex tests from the Apex Tests sidebar or using the Run Tests or Run All Tests code lens within a test class file.',
  colorizer_out_of_sync_code_coverage_data:
    'It looks like this file has been updated. To update your code coverage numbers, run the tests in this file.',
  colorizer_statusbar_hover_text: 'Highlight Apex Code Coverage',
  create_openapi_doc_failed: 'Failed to create OpenAPI Document',
  eligible_method_not_in_doc: 'Methods %s are eligible for OAS generation, but not present in the document',
  enter_new_nc: 'Enter a custom Named Credential...',
  enter_nc_name: 'Enter the name of the Named Credential',
  error_parsing_nc: 'Error parsing named credentials result',
  error_parsing_yaml: 'Error parsing YAML',
  error_retrieving_org_version: 'Failed to retrieve org version',
  failed_to_combine_oas: 'Failed to combine yaml docs',
  failed_to_parse_yaml: 'Failed to parse the document as YAML: %s',
  file_exists: 'The file already exists. How do you want to proceed?',
  full_path_failed: 'Failed to determine the full path for the OpenAPI document.',
  gathering_context: 'Gathering context data.',
  generate_openapi_document: 'Generating OpenAPI document.',
  generating_oas_doc: 'Generating OpenAPI doc.',
  get_document_path: 'Get OpenAPI document folder name.',
  ineligible_method_in_doc: 'Method %s is not eligible for OAS generation, but present in the document',
  invalid_active_text_editor: 'The active text editor is missing or is an invalid file.',
  invalid_file_for_generating_oas_doc: 'Invalid file for generating OAS doc',
  invalid_file_for_processing_oas_doc: 'Invalid file for processing OAS doc',
  invalid_named_credential: 'The named credential is either not provided or invalid.',
  java_binary_not_executable_text: 'Java binary %s at %s is not executable. Please check the file permissions.',
  java_home_invalid_text:
    'The Java home path %s is invalid. For information on how to setup the Salesforce Apex extension, see [Set Your Java Version](%s).',
  java_home_undefined_text:
    'Java home path is not set. Please set the Java home path in your settings or environment variables.',
  java_runtime_local_text:
    'Local Java runtime (%s) is unsupported. Set the salesforcedx-vscode-apex.java.home VS Code setting to a runtime outside of the current project. For more information, go to [Set Your Java Version](%s).',
  java_runtime_missing_text:
    'Java runtime could not be located. Set one using the salesforcedx-vscode-apex.java.home VS Code setting. For more information, go to [Set Your Java Version](%s).',
  java_version_check_command_failed: 'Running java command %s failed with error: %s',
  launch_apex_replay_debugger_unsupported_file:
    'You can only run this command with Anonymous Apex files, Apex Test files, or Apex Debug Log files.',
  merge: 'Manually merge with existing ESR',
  method_not_found_in_doc_symbols: 'Method %s is not found in the document symbols',
  no_eligible_method: 'No eligible methods found in the class',
  no_folder_selected: 'Operation canceled: No folder selected.',
  no_oas_doc_in_file: 'No OAS doc detected in the file',
  no_oas_generated: 'LLM did not return any content.',
  not_eligible_method:
    'Method %s is not eligible for OpenAPI Document creation. It is not annotated with an http annotator or has wrong access modifiers.',
  openapi_doc_created: 'OpenAPI Document created for %s: %s.',
  openapi_doc_created_merge:
    'A new OpenAPI Document %s %s is created for %s. Manually merge the two files using the diff editor.',
  operation_cancelled: 'Operation canceled',
  operations_element_not_found: 'The <operations> element was not found in the provided XML.',
  orphan_process_advice:
    "The list of processes below are Apex Language Server instances that didn't properly shutdown. These\nprocesses can be stopped from the warning message that brought you here, or you can handle this\ntask yourself. If you choose to terminate these processes yourself, refer to relevant documentation\nto stop these processes.",
  overwrite: 'Overwrite',
  parent_process_id: 'Parent Process ID',
  process_command: 'Process Command',
  process_id: 'Process ID',
  processing_generated_oas: 'Verifying generated OpenAPI doc.',
  registry_access_failed: 'Failed to retrieve ESR directory name from the registry.',
  schema_element_not_found: 'The <schema> element was not found in the provided XML.',
  select_folder_for_oas: 'Select folder to store OpenAPI Document',
  select_named_credential: 'Select a Named Credential',
  sobjects_no_refresh_if_already_active_error_text:
    'sObject definitions refresh is already running. If you need to restart the process, cancel the running task.',
  source_java_home_env_var_text: 'The JAVA_HOME environment variable',
  source_java_home_setting_text: 'The salesforcedx-vscode-apex.java.home setting defined in VS Code settings',
  source_jdk_home_env_var_text: 'The JDK_HOME environment variable',
  source_missing_text:
    '%s points to a missing folder. For information on how to setup the Salesforce Apex extension, see [Set Your Java Version](%s).',
  strategy_not_qualified: 'No generation strategy is qualified for the selected class or method.',
  terminate_failed: 'Failed to terminate Apex Language Server process PID: %d: %s',
  terminate_orphaned_language_server_instances:
    'Found %d orphaned Apex Language Server processes.\nWould you like to terminate them?',
  terminate_processes: 'Terminate Processes',
  terminate_processes_confirm: 'Terminate %d Orphaned Processes',
  terminate_processes_title: 'Terminate Orphaned Processes',
  terminate_show_processes: 'Show Processes',
  terminated_orphaned_process: 'Terminated Apex Language Server process PID: %d',
  terminated_orphaned_processes: 'Terminated %d orphaned processes.',
  test_view_loading_message: 'Loading Apex tests ...',
  test_view_no_tests_description:
    "Your project doesn't contain any Apex test methods. To run Apex tests, open a project that contains methods with @istest annotations or the testMethod keyword",
  test_view_no_tests_message: 'No Apex Tests Found',
  test_view_show_error_title: 'Show Error',
  unable_to_locate_document: 'You can run this command only on a source file.',
  unable_to_locate_editor: 'You can run this command only on a source file.',
  unknown: 'Unknown',
  unknown_error: 'Unknown error',
  validate_eligibility: 'Validating eligibility.',
  validation_failed: 'Failed to validate eligibility.',
  write_openapi_document: 'Writing OpenAPI Document.',
  wrong_java_version_short: 'Unsupported Java version',
  wrong_java_version_text:
    'We detected an unsupported Java version. Java versions 11 or higher are supported. We recommend [Java 21](https://www.oracle.com/java/technologies/downloads/#java21) to run the extensions. For more information, see [Set Your Java Version](%s).',
  yes: 'Yes'
};
