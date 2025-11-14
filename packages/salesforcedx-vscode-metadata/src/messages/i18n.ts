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
  source_tracking_remote_text: '$(arrow-down)%s',
  source_tracking_local_text: '$(arrow-up)%s',
  source_tracking_conflicts_text: '$(warning)%s',

  source_tracking_status_bar_local_changes: 'Local Changes',
  source_tracking_status_bar_remote_changes: 'Remote Changes',
  source_tracking_status_bar_conflicts: 'Conflicts',
  source_tracking_status_bar_click_to_push: '💡 Click to deploy these changes to the org',
  source_tracking_status_bar_click_to_retrieve: '💡 Click to retrieve these changes from the org',
  source_tracking_status_bar_click_to_view_details: '💡 Click to view full details in the output channel'
};
