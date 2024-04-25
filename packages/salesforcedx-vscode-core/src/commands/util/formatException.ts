/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getRootWorkspacePath } from '@salesforce/salesforcedx-utils-vscode';

/**
 * Reformats errors thrown by beta deploy/retrieve logic.
 *
 * @param e Error to reformat
 * @returns A newly formatted error
 */
export const formatException = (e: Error): Error => {
  e.message = e.message.replace(getRootWorkspacePath(), '');
  return e;
};
