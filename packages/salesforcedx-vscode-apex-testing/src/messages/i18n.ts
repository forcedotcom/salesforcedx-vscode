/*
 * Copyright (c) 2025, salesforce.com, inc.
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
  apex_test_suite_add_text: 'SFDX: Add Tests to Apex Test Suite',
  apex_test_suite_create_text: 'SFDX: Create Apex Test Suite',
  apex_test_suite_run_text: 'SFDX: Run Apex Test Suite',
  apex_test_class_run_text: 'SFDX: Run Apex Test Class',
  apex_test_last_class_run_text: 'SFDX: Re-Run Last Run Apex Test Class',
  apex_test_last_method_run_text: 'SFDX: Re-Run Last Run Apex Test Method',
  apex_test_method_run_text: 'SFDX: Run Apex Test Method',
  cannot_determine_workspace: 'Unable to determine workspace folders for workspace',
  channel_name: 'Apex Testing',
  collapse_tests_title: 'SFDX: Collapse All Apex Tests',
  configuration_title: 'Salesforce Apex Testing Configuration',
  error_no_connection_found_message: 'No connection found',
  go_to_definition_title: 'Go to Definition',
  refresh_test_title: 'Refresh Tests',
  run_single_test_title: 'Run Single Test',
  run_tests_title: 'Run Tests',
  debug_tests_title: 'Debug Tests',
  show_error_title: 'Display Error',
  test_view_container_title: 'Test Viewer',
  test_view_loading_message: 'Loading Apex tests ...',
  test_view_name: 'Apex Tests',
  test_view_no_tests_description:
    "Your project doesn't contain any Apex test methods. To run Apex tests, open a project that contains methods with @istest annotations or the testMethod keyword",
  test_view_no_tests_message: 'No Apex Tests Found',
  test_view_show_error_title: 'Show Error',
  apex_test_run_concise: 'Display only failed test results.',
  apex_testing_discovery_source_description: 'Select the source for Apex test discovery.',
  apex_testing_discovery_source_ls_description: 'Use the Language Server (LS) for discovery.',
  apex_testing_discovery_source_api_description: 'Use the Tooling API Test Discovery endpoint for discovery.',
  apex_test_suite_debug_not_supported_message:
    'Test suites cannot be debugged. Please debug individual test classes or methods.',
  apex_test_payload_build_failed_message: 'Failed to build test payload',
  apex_test_suite_name_not_determined_message: 'Suite name could not be determined for suite execution'
} as const;

export type MessageKey = keyof typeof messages;
