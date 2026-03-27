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
  invalid_config_format_message: 'Invalid config format',
  sfdx_project_file_invalid_message: 'SFDX project file %s is invalid: %s',
  forceignore_file_not_found_message: 'Forceignore file not found',
  existing_config_content_not_found_message: 'Existing config content not found',
  invalid_existing_config_format_message: 'Invalid existing config format',
  workspaceRoots_0_required_message: 'workspaceRoots[0] is required: value=%s, isUndefined=%s',
  invalid_paths_message: 'Invalid paths: fromPath=%s, toPath=%s'
} as const;
