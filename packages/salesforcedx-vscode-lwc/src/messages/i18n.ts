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
  lightning_lwc_test_navigate_to_test: 'SFDX: Navigate to Lightning Web Component Test',
  no_lwc_jest_found_text: 'LWC Jest is not installed. Run npm install in your project.',
  no_lwc_testrunner_found_text: 'LWC Test Runner is not installed. Install @salesforce/lwc-testrunner.',
  no_workspace_folder_found_for_test_text: 'Unable to determine workspace folder for this test',
  run_test_title: 'Run Test',
  debug_test_title: 'Debug Test',
  run_all_tests_title: 'Run All Tests',
  debug_all_tests_title: 'Debug All Tests',
  run_test_task_name: 'Run Test',
  watch_test_task_name: 'Watch Test',
  default_task_name: 'LWC Test',
  task_windows_command_prompt_messaging: 'Default shell for running tasks is set to cmd.exe',
  lwc_component_name_empty_error: 'Component name cannot be empty',
  lwc_component_name_format_error:
    'Component name must start with a lowercase letter and contain only alphanumeric characters and underscores',
  lwc_component_name_prompt: 'Enter Lightning Web Component name',
  lwc_component_name_placeholder: 'e.g. myComponent',
  lwc_output_dir_prompt: 'Select output directory',
  lwc_select_component_type: 'Select component type',
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
