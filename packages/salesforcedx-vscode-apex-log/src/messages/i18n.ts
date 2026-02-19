/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const messages = {
  create_script_name_prompt: 'Enter script name',
  create_script_name_placeholder: 'Anonymous',
  create_script_already_exists: 'File already exists. Overwrite?',
  overwrite_button: 'Overwrite',
  cancel_button: 'Cancel',
  log_get_no_logs: 'No Apex debug logs found',
  log_get_pick_log: 'Select an Apex debug log to open',
  trace_flag_active: 'Tracing until %s',
  trace_flag_inactive: 'No Tracing',
  trace_flag_manage: 'Click to manage trace flags',
  trace_flags_no_org: 'No target org selected. Set a default org to manage trace flags.',
  trace_flag_created: 'Trace flag created for current user (24h).',
  trace_flag_codelens_create: 'Create trace flag for current user',
  trace_flag_tooltip_current_user: 'Current User',
  trace_flag_tooltip_turn_on: 'Turn on',
  trace_flag_tooltip_turn_off: 'Turn off',
  trace_flag_tooltip_developer_log: 'Developer Log',
  trace_flag_tooltip_user_debug: 'User Debug',
  trace_flag_tooltip_classes: 'Classes',
  trace_flag_tooltip_triggers: 'Triggers',
  trace_flag_tooltip_other: 'Other',
  trace_flag_tooltip_users: 'Users',
  trace_flag_tooltip_full_details: 'Full trace flag details',
  trace_flag_pick_user: 'Type to search for another user to trace',
  trace_flag_pick_debug_level: 'Select a debug level',
  trace_flag_codelens_create_for_user: 'Add trace for another user',
  trace_flag_tooltip_add_user: 'Add trace for another user',
  trace_flag_tooltip_stop: 'Remove',
  log_auto_collect_fetched: 'Auto-collected log %s (%s - %s)',
  log_auto_collect_tooltip: 'Auto-collected: %s logs',
  log_auto_collect_open_folder: 'Open logs folder'
} as const;
