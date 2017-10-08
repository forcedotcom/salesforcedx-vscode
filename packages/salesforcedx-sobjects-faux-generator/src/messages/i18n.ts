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
  faux_generation_cancelled_text: 'Faux class generation cancelled.',
  failure_fetching_sobjects_list_text:
    'Failure fetching list of SObjects from org %s.',
  failure_in_sobject_describe_text: 'Failure performing SObject describe %s.',
  no_sobject_output_folder_text: 'No output folder available %s.',
  fetched_sobjects_length_text:
    'Fetched %s %s SObjects from default scratch org\n'
};
