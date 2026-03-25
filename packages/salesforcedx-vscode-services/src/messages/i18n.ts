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
  checking_for_conflicts: 'Checking for conflicts',
  deploying_one_component: 'Deploying 1 component',
  deploying_n_components: 'Deploying %s components',
  retrieve_on_load_failed: 'Retrieve on load failed: %s',
  view_suggestions: 'View Suggestions',
  // Media/icon descriptions (accessibility)
  icon_sf_default_org: 'Default Scratch Org',
  icon_sf_default_hub: 'Default Dev Hub',
  icon_org_type_devhub: 'Dev Hub',
  icon_org_type_sandbox: 'Sandbox',
  icon_org_type_scratch: 'Scratch',
  icon_org_type_org: 'Production',
  icon_add: 'Run Command',
  icon_browser: 'Open Org in Browser',
  icon_warning: 'Expired',
  metadata_overwrite_confirmation: '"%s" already exists. Do you want to overwrite it?',
  overwrite_button: 'Overwrite',
  choose_different_folder: 'Choose a different folder...',
  select_folder: 'Select'
} as const;

export type MessageKey = keyof typeof messages;
