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
  no_workspace_found_message: 'No workspace found',
  initialization_unsuccessful_message: 'Aura Language Server initialization unsuccessful. Error message: %s',
  invalid_filesystem_provider_message: 'Invalid fileSystemProvider in initializationOptions',
  no_filesystem_provider_message:
    'No fileSystemProvider provided in initializationOptions. Static Aura resources will not be available for the language server.',
  initialize_indexer_error_message: 'AuraServer initializeIndexer: Error: %s',
  indexer_initialization_error_message: 'AuraServer initializeIndexer: Error: %s',
  delayed_initialization_error_message: 'AuraServer performDelayedInitialization: Error: %s',
  file_not_found_message: 'File not found',
  failed_to_load_browser_json_message: 'Failed to load browser.json from %s: %s',
  failed_to_load_ecmascript_json_message: 'Failed to load ecmascript.json from %s: %s',
  invalid_browser_definition_message: 'Invalid browser definition: type=%s, isNull=%s, isUndefined=%s, keys=%s',
  invalid_ecmascript_definition_message: 'Invalid ecmascript definition: type=%s, isNull=%s, isUndefined=%s, keys=%s'
} as const;

export type MessageKey = keyof typeof messages;
