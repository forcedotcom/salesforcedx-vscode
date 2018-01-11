/*
 * Copyright (c) 2018, salesforce.com, inc.
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
  config_name_text: 'Launch Apex Replay Debugger',
  config_request_type_text: 'launch',
  config_type_text: 'apex-replay',
  session_started_text: 'Apex Replay Debugger session started for log file %s.',
  session_terminated_text: 'Apex Replay Debugger session terminated.',
  no_log_file_text:
    'The log file either is missing or does not have any log lines in it.'
};
