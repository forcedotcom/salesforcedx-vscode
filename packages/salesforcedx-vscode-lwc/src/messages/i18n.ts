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
  command_failure: '%s failed to run.',
  lwc_test_run_description_text: 'Run LWC test(s)',
  lightning_lwc_test_navigate_to_test:
    'SFDX: Navigate to Lightning Web Component Test',
  no_lwc_jest_found_text:
    'sfdx-lwc-jest is not installed. Install it from https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.unit_testing_using_jest_installation',
  no_lwc_testrunner_found_text: 'lwc-testrunner is not installed.',
  no_workspace_folder_found_for_test_text:
    'Unable to determine workspace folder for this test',
  run_test_title: 'Run Test',
  debug_test_title: 'Debug Test',
  run_test_task_name: 'Run Test',
  watch_test_task_name: 'Watch Test',
  default_task_name: 'LWC Test',
  task_windows_command_prompt_messaging:
    'Default shell for running tasks is set to cmd.exe',
  lwc_output_channel_name: 'LWC Extension',
  lightning_lwc_no_redhat_extension_found:
    'Salesforce js-meta.xml IntelliSense requires the Red Hat XML extension',
  lightning_lwc_deprecated_redhat_extension:
    'Salesforce js-meta.xml IntelliSense requires the Red Hat XML extension version >= 0.14.0. Upgrade the Red Hat XML extension.',
  lightning_lwc_redhat_extension_regression:
    'Salesforce js-meta.xml IntelliSense does not work with Red Hat XML extension version 0.15.0. Upgrade the Red Hat XML extension.',
  lightning_lwc_fail_redhat_extension: 'Failed to setup Red Hat XML extension'
};
