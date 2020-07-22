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
  source_java_home_setting_text:
    'The salesforcedx-vscode-apex.java.home setting defined in VS Code settings',
  source_jdk_home_env_var_text: 'The JDK_HOME environment variable',
  source_java_home_env_var_text: 'The JAVA_HOME environment variable',
  source_missing_text:
    '%s points to a missing folder. For information on how to setup the Salesforce Apex extension, see [Set Your Java Version](%s).',
  java_runtime_missing_text:
    'Java runtime could not be located. Set one using the salesforcedx-vscode-apex.java.home VS Code setting. For more information, go to [Set Your Java Version](%s).',
  force_sobjects_refresh: 'SFDX: Refresh SObject Definitions',
  force_apex_test_run_codeAction_description_text: 'Run Apex test(s)',
  force_apex_test_run_codeAction_no_class_test_param_text:
    'Test class not provided. Run the code action on a class annotated with @isTest.',
  force_apex_test_run_codeAction_no_method_test_param_text:
    'Test method not provided. Run the code action on a method annotated with @isTest or testMethod.',
  force_apex_test_run_description_text: 'Run Apex test(s)',
  force_test_view_loading_message: 'Loading Apex tests ...',
  force_test_view_no_tests_message: 'No Apex Tests Found',
  force_test_view_show_error_title: 'Show Error',
  force_test_view_no_tests_description:
    "Your project doesn't contain any Apex test methods. To run Apex tests, open a project that contains methods with @istest annotations or the testMethod keyword",
  wrong_java_version_text:
    'An unsupported Java version was detected. Download and install [Java 8](https://java.com/en/download/) or [Java 11](https://www.oracle.com/technetwork/java/javase/downloads/jdk11-downloads-5066655.html) to run the extensions. For more information, see [Set Your Java Version](%s).',
  client_name: 'Apex Language Server',
  cannot_determine_workspace:
    'Unable to determine workspace folders for workspace',
  colorizer_no_code_coverage_on_project:
    'No test run information was found for this project. Set "salesforcedx-vscode-core.retrieve-test-code-coverage": true in your user or workspace settings, then run Apex tests from the Apex Tests sidebar or using the Run Tests or Run All Tests code lens within a test class file.',
  colorizer_no_code_coverage_on_test_results:
    'No code coverage information was found for test run %s. Set "salesforcedx-vscode-core.retrieve-test-code-coverage": true in your user or workspace settings, then run Apex tests from the Apex Tests sidebar or using the Run Tests or Run All Tests code lens within a test class file.',
  colorizer_out_of_sync_code_coverage_data:
    'It looks like this file has been updated. To update your code coverage numbers, run the tests in this file.',
  colorizer_no_code_coverage_current_file:
    'No code coverage information was found for this file. Set "salesforcedx-vscode-core.retrieve-test-code-coverage": true in your user or workspace settings. Then, run Apex tests that include methods in this file. You can run tests from the Apex Tests sidebar or using the Run Tests or Run All Tests code lens within the file.',
  colorizer_statusbar_hover_text: 'Highlight Apex Code Coverage',
  force_sobjects_no_refresh_if_already_active_error_text:
    'A refresh of your sObject definitions is already underway. If you need to restart the process, cancel the running task.',
  apex_language_server_failed_activate:
    'Unable to activate the Apex Language Server',
  sobject_refresh_all: 'All SObjects',
  sobject_refresh_custom: 'Custom SObjects',
  sobject_refresh_standard: 'Standard SObjects',
  sobjects_refresh_needed: "You don't have any sObjects cached locally. To take advantage of autocompletion for sObjects in Apex code, run SFDX: Refresh SObject Definitions.",
  sobjects_refresh_now: 'Run SFDX: Refresh SObject Definitions'
};
