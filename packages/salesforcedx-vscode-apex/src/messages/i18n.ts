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
  anon_apex_execute_document_text: 'SFDX: Execute Anonymous Apex with Editor Contents',
  anon_apex_execute_selection_text: 'SFDX: Execute Anonymous Apex with Currently Selected Text',
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
  cancel: 'Cancel',
  cannot_determine_workspace: 'Unable to determine workspace folders for workspace',
  channel_name: 'Apex',
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
  error_no_connection_found_message: 'No connection found',
  java_binary_not_executable_text: 'Java binary %s at %s is not executable. Please check the file permissions.',
  java_binary_missing_text: 'Java binary %s not found at %s. Please check your Java installation.',
  java_bin_missing_text: 'Java bin directory not found at %s. Please check your Java installation.',
  java_home_expansion_failed_text: 'Failed to expand Java home path. Please check your Java installation.',
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
  launch_apex_replay_debugger_with_selected_file: 'Launch Apex Replay Debugger with Selected File',
  orphan_process_advice:
    "The list of processes below are Apex Language Server instances that didn't properly shutdown. These\nprocesses can be stopped from the warning message that brought you here, or you can handle this\ntask yourself. If you choose to terminate these processes yourself, refer to relevant documentation\nto stop these processes.",
  parent_process_id: 'Parent Process ID',
  process_command: 'Process Command',
  process_id: 'Process ID',
  sobjects_no_refresh_if_already_active_error_text:
    'sObject definitions refresh is already running. If you need to restart the process, cancel the running task.',
  source_java_home_env_var_text: 'The JAVA_HOME environment variable',
  source_java_home_setting_text: 'The salesforcedx-vscode-apex.java.home setting defined in VS Code settings',
  source_jdk_home_env_var_text: 'The JDK_HOME environment variable',
  source_missing_text:
    '%s points to a missing folder. For information on how to setup the Salesforce Apex extension, see [Set Your Java Version](%s).',
  terminate_failed: 'Failed to terminate Apex Language Server process PID: %d: %s',
  terminate_orphaned_language_server_instances:
    'Found %d orphaned Apex Language Server processes.\nWould you like to terminate them?',
  terminate_processes: 'Terminate Processes',
  terminate_processes_confirm: 'Terminate %d Orphaned Processes',
  terminate_processes_title: 'Terminate Orphaned Processes',
  terminate_show_processes: 'Show Processes',
  terminated_orphaned_process: 'Terminated Apex Language Server process PID: %d',
  terminated_orphaned_processes: 'Terminated %d orphaned processes.',
  unable_to_locate_document: 'You can run this command only on a source file.',
  unable_to_locate_editor: 'You can run this command only on a source file.',
  unknown: 'Unknown',
  unknown_error: 'Unknown error',
  wrong_java_version_short: 'Unsupported Java version',
  wrong_java_version_text:
    'We detected an unsupported Java version. Java versions 11 or higher are supported. We recommend [Java 21](https://www.oracle.com/java/technologies/downloads/#java21) to run the extensions. For more information, see [Set Your Java Version](%s).',
  yes: 'Yes'
} as const;

export type MessageKey = keyof typeof messages;
