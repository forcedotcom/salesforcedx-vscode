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
  session_language_server_error_text:
    'Apex language server could not provide information about valid breakpoints.',
  session_started_text: 'Apex Replay Debugger session started for log file %s.',
  session_terminated_text: 'Apex Replay Debugger session terminated.',
  no_log_file_text:
    'The log file either is missing or does not have any log lines in it.',
  incorrect_log_levels_text:
    'The log must be generated with log categories Apex code at the FINEST level and Visualforce at the FINER level.',
  unable_to_retrieve_org_info: 'Unable to retrieve OrgInfo',
  heap_dump_error:
    'Problems were encountered while retrieving heap dump information. Message=%s, Error code=%s, Heap dump information=%s',
  heap_dump_error_wrap_up_text:
    'Problems were encountered while retrieving heap dump information. See the messages above this one for details. Detailed heap dump variable information is unavailable for the specified line or lines.',
  fetching_heap_dump:
    'Retrieving heap dump from server. Heap dump information=%s',
  malformed_log_line:
    "Encountered a malformed HEAP_DUMP log line, skipping. Log line number=%d, log line='%s'.",
  reconcile_heapdump_error:
    'Problems were encountered while using a heap dump: %s. Use Tooling API to delete the ApexExecutionOverlayResult record with the ID %s: From a terminal, run "sfdx force:data:record:delete -t -s ApexExecutionOverlayResult -i %s".'
};
