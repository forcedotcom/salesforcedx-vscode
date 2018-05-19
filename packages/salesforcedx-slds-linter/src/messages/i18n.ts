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
  fix_problem: 'Fix this problem: %s',
  fix_same: 'Fix all instances of: %s',
  fix_same_default: 'same problems',
  fix_all: 'Fix all auto-fixable problems',
  fix_error: 'Failed to apply SLDS Validator fixes to the document.',
  general_deprecated_class_name: 'Deprecated SLDS class name',
  deprecated_class_name: 'Deprecated SLDS class name (v2.3.1): Change %s to %s'
};
