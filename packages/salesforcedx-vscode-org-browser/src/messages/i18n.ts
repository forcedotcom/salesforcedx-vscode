/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const messages = {
  confirm_overwrite: 'Overwrite local files for %s %s?',
  yes_button: 'Yes',
  retrieve_metadata_text: 'Retrieve Metadata',
  command_succeeded_text: '%s succeeded.',
  filter_text_placeholder: 'Search names (Broker or Apex*), or filter types (Apex*:); empty to clear',
  search_all_types_button: 'Search All Types',
  use_loaded_results_button: 'Use Loaded Results',
  filter_discovery_confirmation:
    'Search all %d metadata types in the org? This may take longer and make additional requests.'
} as const;
