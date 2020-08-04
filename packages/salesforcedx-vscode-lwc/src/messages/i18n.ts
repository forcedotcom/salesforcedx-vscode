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
    'To run this command, install the @salesforce/lwc-dev-server plugin. For more info, see [https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.get_started_local_dev](https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.get_started_local_dev).',
  force_lightning_lwc_start_addr_in_use:
    "The local development server can't start because the address is already in use. To fix, try one of these options:\n 1) Stop the local dev server running on any another instance.\n or 2) Change the default port [Configuration for Projects (Optional)](https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.get_started_local_dev_setup).\n 3) Kill the process running on the specified port.",
  force_lightning_lwc_inactive_scratch_org:
    'The local development server can\'t start because your scratch org is not active. Run "SFDX: Create a Default Scratch Org" to create a scratch org, or run "SFDX: Set a Default Org" to select an active scratch org.',
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
    "Can't find the Lightning Web Components module. Check that %s is the correct file path.",
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
  force_lightning_lwc_no_mobile_plugin:
    'To run this command, install the @salesforce/lwc-dev-mobile plugin.',
  force_lightning_lwc_platform_selection:
    'Select the platform for previewing the component',
  force_lightning_lwc_android_target_default:
    'Enter a name for the Android emulator (leave blank for default)',
  force_lightning_lwc_ios_target_default:
    'Enter a name for the iOS simulator (leave blank for default)',
  force_lightning_lwc_android_target_remembered:
    "Enter a name for the Android emulator (leave blank for '%s')",
  force_lightning_lwc_ios_target_remembered:
    "Enter a name for the iOS simulator (leave blank for '%s')",
  force_lightning_lwc_operation_cancelled:
    'Preview operation cancelled by user.',
  force_lightning_lwc_ios_label: 'Use iOS Simulator',
  force_lightning_lwc_ios_description: 'Preview component on iOS',
  force_lightning_lwc_android_label: 'Use Android Emulator',
  force_lightning_lwc_android_description: 'Preview component on Android',
  force_lightning_lwc_android_failure: "Failed to start Android Emulator '%s'.",
  force_lightning_lwc_ios_failure: "Failed to start iOS Simulator '%s'.",
  force_lightning_lwc_android_start: "Starting Android Emulator '%s'.",
  force_lightning_lwc_ios_start: "Starting iOS Simulator '%s'.",
  force_lightning_lwc_browserapp_label: 'Browser',
  force_lightning_lwc_browserapp_description: 'Your mobile browser.',
  force_lightning_lwc_preview_create_virtual_device_label: 'New...',
  force_lightning_lwc_preview_create_virtual_device_detail:
    'Create a Virtual Device',
  force_lightning_lwc_preview_select_virtual_device:
    'Select a Virtual Device...',
  force_lightning_lwc_preview_select_target_app:
    'Select a Target Application...',
  force_lightning_lwc_preview_desktop_label: 'Use Desktop Browser',
  force_lightning_lwc_preview_desktop_description:
    'Preview component on desktop browser',
  lwc_output_channel_name: 'LWC Extension',
  force_lightning_lwc_no_redhat_extension_found:
    'Salesforce js-meta.xml intellisense requires RedHat XML Plugin',
  force_lightning_lwc_deprecated_redhat_extension:
    'Salesforce js-meta.xml intellisense requires RedHat XML Extension Version > 0.13.0. Please upgrade the extension',
  force_lightning_lwc_fail_redhat_extension: 'Failed to setup RedHat XML Plugin'
};
