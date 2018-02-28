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
  command_error_help_text: 'Command returned the following error',
  session_language_server_error_text:
    'Apex language server could not provide information about valid breakpoints.',
  session_no_entity_access_text:
    "Either your org or user doesn't have the permission to debug Apex.",
  session_started_text: 'Apex Debugger session started with ID %s.',
  session_terminated_text: 'Apex Debugger session terminated with ID %s.',
  streaming_connected_text: 'Connected to Streaming API channel %s.',
  streaming_disconnected_text: 'Disconnected from Streaming API channel %s.',
  streaming_handshake_error_text:
    'Streaming API handshake failed with the following error',
  streaming_handshake_timeout_text:
    'Streaming API handshake failed due to a socket timeout. Check your connection and try again.',
  hotswap_warn_text:
    "You can't modify Apex classes or triggers during an Apex Debugger session. Save your changes after you're done debugging.",
  created_exception_breakpoint_text: 'Created exception breakpoint for %s.',
  removed_exception_breakpoint_text: 'Removed exception breakpoint for %s.',
  idle_warn_text:
    'You have been idle for %s minutes. To prevent your debugger session from being terminated, run or step through code, or inspect your variables, in the next %s minutes.',
  idle_terminated_text:
    'Your debugger session is being terminated because it has been idle for %s minutes.',
  invalid_isv_project_config:
    'Your project configuration is invalid/incomplete for ISV debugging. Create a new ISV project and try again.'
};
