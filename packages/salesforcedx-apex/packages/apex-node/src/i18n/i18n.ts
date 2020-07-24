/*
 * Copyright (c) 2020, salesforce.com, inc.
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
  unexpected_execute_command_error:
    'Unexpected error while executing anonymous apex. %s',
  file_not_found_error: 'File not found at the specified path: %s',
  unexpected_log_get_command_error: 'Unexpected error while getting logs. %s',
  num_logs_error: 'Expected number of logs to be greater than 0.',
  option_exec_anon_error: 'Please specify an option to execute anonymous Apex.',
  unexpected_exec_anon_input_error:
    'Unexpected error while reading user input. %s',
  exec_anon_input_prompt:
    'Start typing Apex code. Press the Enter key after each line, then press CTRL+D when finished.\n',
  exec_anon_input_timeout: 'Timed out while waiting for user input.',
  no_test_result_summary: 'No test results were found for test run %s',
  no_test_queue_results: 'No test results were found in the queue for test run %s'
};
