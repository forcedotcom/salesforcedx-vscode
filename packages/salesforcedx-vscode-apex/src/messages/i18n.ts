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
  source_missing_text: '%s points to a missing folder',
  java_runtime_missing_text:
    'Java runtime could not be located. Set one using the salesforcedx-vscode-apex.java.home VS Code setting.',
  force_apex_test_run_codeAction_description_text: 'Run Apex test(s)',
  force_test_view_loading_message: 'Loading Apex tests ...',
  force_test_view_no_tests_message: 'No Apex Tests Found',
  force_test_view_show_error_title: 'Show Error',
  force_test_view_no_tests_description:
    "Your project doesn't contain any Apex test methods. To run Apex tests, open a project that contains methods with @istest annotations or the testMethod keyword",
  wrong_java_version_text:
    'Java 8 is required to run. Download and install it from https://java.com/en/download/.',

  client_name: 'Apex Language Server'
};
