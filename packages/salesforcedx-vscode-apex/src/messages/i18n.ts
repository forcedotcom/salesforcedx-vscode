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
  apex_execute_compile_success: 'Compiled successfully.',
  apex_execute_runtime_success: 'Executed successfully.',
  apex_execute_text: 'Execute Anonymous Apex',
  apex_execute_unexpected_error: 'Unexpected error',
  apex_language_server_loading:
    'Indexing Apex files. Hold tight, almost ready… $(sync~spin)',
  apex_language_server_loaded: 'Indexing complete $(check)',
  apex_language_server_failed_activate:
    'Unable to activate the Apex Language Server',
  apex_language_server_quit_and_restarting:
    'Apex Language Server has stopped. Restarting… $N of 5',
  apex_test_run_text: 'Run Apex Tests',
  cannot_determine_workspace:
    'Unable to determine workspace folders for workspace',
  channel_name: 'Apex',
  client_name: 'Apex Language Server',
  colorizer_no_code_coverage_on_project:
    'No test run information was found for this project. Set "salesforcedx-vscode-core.retrieve-test-code-coverage": true in your user or workspace settings, then run Apex tests from the Apex Tests sidebar or using the Run Tests or Run All Tests code lens within a test class file.',
  colorizer_no_code_coverage_on_test_results:
    'No code coverage information was found for test run %s. Set "salesforcedx-vscode-core.retrieve-test-code-coverage": true in your user or workspace settings, then run Apex tests from the Apex Tests sidebar or using the Run Tests or Run All Tests code lens within a test class file.',
  colorizer_out_of_sync_code_coverage_data:
    'It looks like this file has been updated. To update your code coverage numbers, run the tests in this file.',
  colorizer_no_code_coverage_current_file:
    'No code coverage information was found for this file. Set "salesforcedx-vscode-core.retrieve-test-code-coverage": true in your user or workspace settings. Then, run Apex tests that include methods in this file. You can run tests from the Apex Tests sidebar or using the Run Tests or Run All Tests code lens within the file.',
  colorizer_statusbar_hover_text: 'Highlight Apex Code Coverage',
  force_anon_apex_execute_document_text:
    'SFDX: Execute Anonymous Apex with Editor Contents',
  force_anon_apex_execute_selection_text:
    'SFDX: Execute Anonymous Apex with Currently Selected Text',
  force_apex_log_get_text: 'SFDX: Get Apex Debug Logs',
  force_apex_log_get_no_logs_text: 'No Apex debug logs were found',
  force_apex_log_get_pick_log_text: 'Pick an Apex debug log to get',
  force_apex_log_list_text: 'Getting Apex debug logs',
  force_apex_test_run_all_test_label: 'All Tests',
  force_apex_test_run_all_local_test_label: 'All Local Tests',
  force_apex_test_run_all_tests_description_text:
    'Runs all tests in the current org',
  force_apex_test_run_all_local_tests_description_text:
    'Runs all tests in the current org except the ones that originate from installed managed packages',
  force_apex_test_run_description_text: 'Run Apex test(s)',
  force_apex_test_run_codeAction_no_class_test_param_text:
    'Test class not provided. Run the code action on a class annotated with @isTest.',
  force_apex_test_run_codeAction_no_method_test_param_text:
    'Test method not provided. Run the code action on a method annotated with @isTest or testMethod.',
  force_apex_test_run_text: 'SFDX: Run Apex Tests',
  force_test_view_loading_message: 'Loading Apex tests ...',
  force_test_view_no_tests_message: 'No Apex Tests Found',
  force_test_view_show_error_title: 'Show Error',
  force_test_view_no_tests_description:
    "Your project doesn't contain any Apex test methods. To run Apex tests, open a project that contains methods with @istest annotations or the testMethod keyword",
  java_runtime_missing_text:
    'Java runtime could not be located. Set one using the salesforcedx-vscode-apex.java.home VS Code setting. For more information, go to [Set Your Java Version](%s).',
  java_runtime_local_text:
    'Local Java runtime (%s) is unsupported. Set the salesforcedx-vscode-apex.java.home VS Code setting to a runtime outside of the current project. For more information, go to [Set Your Java Version](%s).',
  source_java_home_env_var_text: 'The JAVA_HOME environment variable',
  source_jdk_home_env_var_text: 'The JDK_HOME environment variable',
  source_java_home_setting_text:
    'The salesforcedx-vscode-apex.java.home setting defined in VS Code settings',
  source_missing_text:
    '%s points to a missing folder. For information on how to setup the Salesforce Apex extension, see [Set Your Java Version](%s).',
  wrong_java_version_text:
    'An unsupported Java version was detected. Download and install [Java 11](https://www.oracle.com/technetwork/java/javase/downloads/jdk11-downloads-5066655.html) or [Java 17](https://www.oracle.com/java/technologies/downloads/#java17) to run the extensions. For more information, see [Set Your Java Version](%s).',
  wrong_java_version_short:
    'Unsupported Java version',
  force_apex_test_suite_build_text: 'SFDX: Build Apex Test Suite',
  unable_to_locate_editor: 'You can run this command only on a source file.',
  unable_to_locate_document: 'You can run this command only on a source file.',
  launch_apex_replay_debugger_unsupported_file:
    'You can only run this command with Anonymous Apex files, Apex Test files, or Apex Debug Log files.',
  unknown_error: 'Unknown error'
};
