/*
 * Copyright (c) 2019, salesforce.com, inc.
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
  client_name: 'Aura Language Server',
  aura_language_server_loading: 'Indexing Aura files. Hold tight, almost ready… $(sync~spin)',
  aura_language_server_loaded: 'Indexing complete $(check)',
  aura_component_name_prompt: 'Enter Aura component name',
  aura_component_name_empty_error: 'Name cannot be empty',
  aura_component_name_format_error:
    'Name must start with a letter and contain only alphanumeric characters and underscores',
  aura_output_dir_prompt: 'Select output directory',
  aura_generate_app_success: 'Aura app created successfully',
  aura_generate_component_success: 'Aura component created successfully',
  aura_generate_event_success: 'Aura event created successfully',
  aura_generate_interface_success: 'Aura interface created successfully'
} as const;

export type MessageKey = keyof typeof messages;
