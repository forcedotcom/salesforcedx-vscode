/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const messages = {
  create_script_name_empty_error: 'Script name cannot be empty',
  create_script_name_format_error:
    'Name must start with a letter and contain only letters, numbers, and underscores',
  create_script_name_prompt: 'Enter script name',
  create_script_name_placeholder: 'Anonymous',
  create_script_already_exists: 'File already exists. Overwrite?',
  overwrite_button: 'Overwrite',
  cancel_button: 'Cancel',
  log_get_no_logs: 'No Apex debug logs found',
  log_get_pick_log: 'Select an Apex debug log to open',
  log_get_size_bytes: '%s B',
  log_get_size_kb: '%s KB',
  log_get_size_mb: '%s MB',
  trace_flag_active: 'Tracing until %s',
  trace_flag_inactive: 'No Tracing',
  trace_flags_no_org: 'No target org selected. Set a default org to manage trace flags.',
  trace_flag_codelens_create: 'Create trace flag for current user',
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
  trace_flag_codelens_create_log_level: 'Create Debug level',
  trace_flag_create_log_level_master_label: 'Master label (display name)',
  trace_flag_create_log_level_developer_name: 'Developer name (API name)',
  trace_flag_create_log_level_use_defaults: 'Use default levels?',
  trace_flag_create_log_level_use_defaults_yes: 'Yes (Apex=DEBUG, VF=INFO, DB=INFO)',
  trace_flag_create_log_level_use_defaults_no: 'No, customize each category',
  trace_flag_create_log_level_pick: 'Select level for %s',
  trace_flag_create_log_level_failed: 'Failed to create debug level',
  trace_flag_create_log_level_title: 'Create Debug level',
  trace_flag_tooltip_add_user: 'Add trace for another user',
  trace_flag_tooltip_stop: 'Remove',
  trace_flag_codelens_change_debug_level: 'Change',
  log_auto_collect_fetched: 'Auto-collected log %s (%s - %s)',
  log_auto_collect_tooltip: 'Auto-collected: %s logs',
  log_auto_collect_open_folder: 'Open logs folder',
  exec_anon_compile_error: 'Line %s, Column %s: %s',
  exec_anon_compile_unknown: 'Unknown compile error',
  exec_anon_progress_title: 'Executing anonymous Apex...',
  exec_anon_success: 'Anonymous Apex executed successfully',
  open_log: 'Open Log'
} as const;
