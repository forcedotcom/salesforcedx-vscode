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
  command_failure: '%s failed to run.',
  command_canceled: '%s was canceled.',
  force_lightning_lwc_start_text: 'SFDX: Start Local Development Server',
  force_lightning_lwc_start_not_found:
    'To run this command, first install the @salesforce/lwc-dev-server plugin. For more info, see [https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.get_started_local_dev](https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.get_started_local_dev).',
  force_lightning_lwc_start_addr_in_use:
    'The local development server could not start because the address is already in use. To resolve: \n1) Stop the local dev server if it is running in another instance.\n2) Change the default port [Configuration for Projects (Optional)](https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.get_started_local_dev_setup).\n3) Kill the process running on the specified port.',
  force_lightning_lwc_start_failed:
    'The local development server was not able to start.',
  force_lightning_lwc_start_exited:
    'The local development server exited unexpectedly with code %s.',
  force_lightning_lwc_start_already_running:
    'The local development server is already running.',
  force_lightning_lwc_stop_text: 'SFDX: Stop Local Development Server',
  force_lightning_lwc_stop_not_running:
    'The local development server is not running.',
  force_lightning_lwc_stop_in_progress: 'Stopping local development server',
  force_lightning_lwc_preview_text: 'SFDX: Preview Component Locally',
  force_lightning_lwc_preview_file_undefined:
    "Can't find the Lightning Web Components module. Check that %s is the correct filepath.",
  force_lightning_lwc_preview_file_nonexist:
    "Can't find the Lightning Web Components module in %s. Check that the module exists.",
  force_lightning_lwc_preview_unsupported:
    "Something's not right with the filepath. The local development server doesn't recognize the Lightning Web Components module '%s.'",
  force_lightning_lwc_open_text:
    'SFDX: Open Local Development Server in Browser',
  prompt_option_open_browser: 'Open Browser',
  prompt_option_restart: 'Restart',
  force_lwc_test_run_description_text: 'Run LWC test(s)',
  force_lightning_lwc_test_navigate_to_test:
    'SFDX: Navigate to Lightning Web Component Test',
  no_lwc_jest_found_text:
    'sfdx-lwc-jest is not installed. Install it from https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.unit_testing_using_jest_installation',
  no_workspace_folder_found_for_test_text:
    'Unable to determine workspace folder for this test',
  run_test_title: 'Run Test',
  debug_test_title: 'Debug Test',
  run_test_task_name: 'Run Test',
  watch_test_task_name: 'Watch Test',
  default_task_name: 'LWC Test'
};
