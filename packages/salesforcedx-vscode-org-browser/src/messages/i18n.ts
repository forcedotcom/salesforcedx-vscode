/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const messages = {
  retrieve_canceled: 'Retrieve canceled',
  retrieve_failed: 'Retrieve failed: %s',
  confirm_overwrite: 'Overwrite local files for %s %s?'
} as const;

export type MessageKey = keyof typeof messages;

export const isValidMessageKey = (key: string): key is MessageKey => key in messages;
