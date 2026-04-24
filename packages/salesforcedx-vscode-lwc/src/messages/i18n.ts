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
  no_lwc_jest_found_text: 'LWC Jest is not installed. Run npm install in your project.',
  no_lwc_testrunner_found_text: 'LWC Test Runner is not installed. Install @salesforce/lwc-testrunner.',
  no_workspace_folder_found_for_test_text: 'Unable to determine workspace folder for this test',
  lwc_test_controller_label: 'LWC Tests',
  lwc_test_run_profile_title: 'SFDX: Run All LWC Tests',
  lwc_test_debug_profile_title: 'SFDX: Debug All LWC Tests',
  run_test_title: 'Run Test',
  debug_test_title: 'Debug Test',
  run_all_tests_title: 'Run All Tests',
  debug_all_tests_title: 'Debug All Tests',
  run_test_task_name: 'Run Test',
  watch_test_task_name: 'Watch Test',
  default_task_name: 'LWC Test',
  lwc_one_or_more_tests_failed_in_this_file_message: 'One or more tests failed in this file.',
  no_test_results_produced_message: 'No test results produced.',
  lwc_test_failed_message: 'Test failed',
  task_windows_command_prompt_messaging: 'Default shell for running tasks is set to cmd.exe',
  lwc_output_channel_name: 'LWC Extension',
  lightning_lwc_no_redhat_extension_found: 'Salesforce js-meta.xml IntelliSense requires the Red Hat XML extension',
  lightning_lwc_deprecated_redhat_extension:
    'Salesforce js-meta.xml IntelliSense requires the Red Hat XML extension version >= 0.14.0. Upgrade the Red Hat XML extension.',
  lightning_lwc_redhat_extension_regression:
    'Salesforce js-meta.xml IntelliSense does not work with Red Hat XML extension version 0.15.0. Upgrade the Red Hat XML extension.',
  lightning_lwc_fail_redhat_extension: 'Failed to setup Red Hat XML extension',
  lwc_language_server_loading: 'Indexing LWC files. Hold tight, almost ready… $(sync~spin)',
  lwc_language_server_loaded: 'Indexing complete $(check)'
} as const;

export type MessageKey = keyof typeof messages;
