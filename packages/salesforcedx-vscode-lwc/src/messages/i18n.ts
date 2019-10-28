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
  salesforcedx_vscode_core_not_installed_text:
    'salesforce.salesforcedx-vscode-lwc failed to activate. Ensure that you have the latest version of salesforce.salesforcedx-vscode-core installed and activated',
  force_lightning_lwc_start_text: 'SFDX: Start Local Development Server'
};
