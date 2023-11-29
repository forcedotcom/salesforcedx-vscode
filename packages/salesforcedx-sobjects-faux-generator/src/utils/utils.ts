/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const getMessageFromError = (err: any): string => {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  if (err) {
    return `Unexpected error: ${JSON.stringify(err)}`;
  }
  return 'Unknown error';
};

export const utils = {
  getMessageFromError
};