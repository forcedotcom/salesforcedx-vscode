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
  apex_test_run_codeAction_no_class_test_param_text:
    'Test class not provided. Run the code action on a class annotated with @isTest.',
  apex_test_run_codeAction_no_method_test_param_text:
    'Test method not provided. Run the code action on a method annotated with @isTest or testMethod.',
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
  configuration_title: 'Salesforce Apex Testing Configuration',
  run_tests_title: 'Run All Tests in Org',
  run_tests_in_workspace_title: 'Run In-Workspace Tests',
  debug_tests_title: 'Debug Tests',
  test_view_name: 'Apex Tests',
  apex_test_run_concise: 'Display only failed test results.',
  apex_testing_discovery_source_description: 'Select the source for Apex test discovery.',
  apex_testing_discovery_source_ls_description: 'Use the Language Server (LS) for discovery.',
  apex_testing_discovery_source_api_description: 'Use the Tooling API Test Discovery endpoint for discovery.',
  apex_test_suite_debug_not_supported_message:
    'Test suites cannot be debugged. Please debug individual test classes or methods.',
  apex_test_payload_build_failed_message: 'Failed to build test payload',
  apex_test_suite_name_not_determined_message: 'Suite name could not be determined for suite execution',
  apex_test_suite_empty_message_notification:
    'The following test suite(s) are empty and cannot be run: %s. Add test classes to the suite before running.',
  apex_test_suite_empty_message:
    'This test suite is empty and cannot be run. Add test classes to the suite before running.',
  apex_test_resolve_suite_children_failed_message: 'Failed to resolve suite children for suite: %s. Error: %s',
  apex_test_connection_failed_message: 'Failed to get connection',
  apex_test_service_not_initialized_message: 'TestService not initialized. Call ensureInitialized() first.',
  apex_test_connection_not_initialized_message: 'Connection not initialized. Call ensureInitialized() first.',
  apex_test_populate_suite_items_failed_message: 'Failed to populate suite items: %s',
  apex_test_debug_failed_message: 'Debug failed: %s',
  apex_test_update_results_failed_message: 'Failed to update test results: %s',
  apex_test_discovery_partial_warning:
    'Test discovery encountered URL length limits. Some tests may not be visible. Try refreshing or filtering by namespace.',
  apex_generate_unit_test_class_text: 'SFDX: Create Apex Unit Test Class',
  apex_test_class_output_dir_prompt: 'Select output directory',
  apex_test_class_name_prompt: 'Enter Apex test class name',
  apex_test_class_name_placeholder: 'MyTest',
  apex_unit_test_template_description: 'Template with sample test method',
  basic_unit_test_template_description: 'Minimal template',
  apex_test_template_prompt: 'Select template type',
  apex_generate_class_success: 'Apex class created successfully',
  apex_test_open_org_class_failed_message: 'Failed to open class %s from org: %s',
  apex_test_debug_org_only_warning_message:
    'Debugging is not supported for tests that exist only in the org and not in your local workspace. Please retrieve the class to your local project first.',
  apex_test_report_open_action: 'Open Report',
  apex_test_report_ready_message: 'Apex test report is ready: %s',
  apex_test_report_written_to_message: 'Apex test report saved to: %s',
  apex_test_report_markdown_preview_tip:
    'Tip: For the best experience viewing the markdown file, open it and run "Markdown: Open Preview" from the Command Palette.\n\n',
  apex_test_successful_execution_message: '%s successfully ran',
  apex_test_failed_execution_message: '%s failed to run',
  apex_class_source_hidden:
    "// Source code for class '%s' is hidden.\n// This is common for managed package classes whose source is protected.",
  test_explorer_local_namespace_label: 'Local Namespace',
  test_explorer_unpackaged_metadata_label: '(Unpackaged Metadata)',
  test_explorer_1gp_package_label: '%s (1GP)'
} as const;

export type MessageKey = keyof typeof messages;
