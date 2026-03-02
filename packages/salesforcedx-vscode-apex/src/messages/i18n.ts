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
  apex_language_server_already_restarting: 'Apex Language Server is already restarting. Please wait.',
  apex_language_server_failed_activate: 'Unable to activate the Apex Language Server',
  apex_language_server_loaded: 'Indexing complete $(check)',
  apex_language_server_loading: 'Indexing Apex files. Hold tight, almost ready… $(sync~spin)',
  apex_language_server_quit_and_restarting: 'Apex Language Server has stopped. Restarting… %d of 5',
  apex_language_server_restart: 'Restart Apex Language Server',
  apex_language_server_restart_dialog_clean_and_restart: 'Clean Apex DB and Restart',
  apex_language_server_restart_dialog_prompt: 'Clean Apex DB and Restart? Or Restart Only?',
  apex_language_server_restart_dialog_restart_only: 'Restart Only',
  apex_language_server_restarting: 'Apex Language Server is restarting… $(sync~spin)',
  cancel: 'Cancel',
  cannot_determine_workspace: 'Unable to determine workspace folders for workspace',
  channel_name: 'Apex',
  client_name: 'Apex Language Server',
  java_binary_missing_text: 'Java binary %s not found at %s. Please check your Java installation.',
  java_bin_missing_text: 'Java bin directory not found at %s. Please check your Java installation.',
  java_home_expansion_failed_text: 'Failed to expand Java home path. Please check your Java installation.',
  java_runtime_local_text:
    'Local Java runtime (%s) is unsupported. Set the salesforcedx-vscode-apex.java.home VS Code setting to a runtime outside of the current project. For more information, go to [Set Your Java Version](%s).',
  java_runtime_missing_text:
    'Java runtime could not be located. Set one using the salesforcedx-vscode-apex.java.home VS Code setting. For more information, go to [Set Your Java Version](%s).',
  java_version_check_command_failed: 'Running java command %s failed with error: %s',
  orphan_process_advice:
    "The list of processes below are Apex Language Server instances that didn't properly shutdown. These\nprocesses can be stopped from the warning message that brought you here, or you can handle this\ntask yourself. If you choose to terminate these processes yourself, refer to relevant documentation\nto stop these processes.",
  parent_process_id: 'Parent Process ID',
  process_command: 'Process Command',
  process_id: 'Process ID',
  source_java_home_env_var_text: 'The JAVA_HOME environment variable',
  source_java_home_setting_text: 'The salesforcedx-vscode-apex.java.home setting defined in VS Code settings',
  source_jdk_home_env_var_text: 'The JDK_HOME environment variable',
  source_missing_text:
    '%s points to a missing folder. For information on how to setup the Salesforce Apex extension, see [Set Your Java Version](%s).',
  terminate_failed: 'Failed to terminate Apex Language Server process PID: %d: %s',
  terminate_processes: 'Terminate Processes',
  terminate_processes_confirm: '%d orphaned Apex Language Server process(es) found. Terminate them?',
  terminate_orphaned_language_server_instances: '%d orphaned Apex Language Server process(es) found.',
  terminate_show_processes: 'Show Processes',
  terminated_orphaned_process: 'Terminated Apex Language Server process PID: %d',
  unknown: 'Unknown',
  unknown_error: 'Unknown error',
  wrong_java_version_short: 'Unsupported Java version',
  wrong_java_version_text:
    'We detected an unsupported Java version. Java versions 11 or higher are supported. We recommend [Java 21](https://www.oracle.com/java/technologies/downloads/#java21) to run the extensions. For more information, see [Set Your Java Version](%s).',
  yes: 'Yes'
} as const;

export type MessageKey = keyof typeof messages;
