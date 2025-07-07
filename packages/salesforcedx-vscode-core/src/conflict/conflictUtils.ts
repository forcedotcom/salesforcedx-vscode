/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { readFile } from '@salesforce/salesforcedx-utils-vscode';

/**
 * Compares two files to determine if they differ in content.
 * Reads both files in parallel for better performance.
 * @param one Path to the first file
 * @param two Path to the second file
 * @returns Promise<boolean> True if files differ, false if they are identical
 */
export const filesDiffer = async (one: string, two: string): Promise<boolean> => {
  const [buffer1, buffer2] = await Promise.all([readFile(one), readFile(two)]);
  return buffer1 !== buffer2;
};
