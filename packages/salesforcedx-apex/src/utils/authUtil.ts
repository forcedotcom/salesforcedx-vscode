/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { xmlCharMap } from './types';

export function escapeXml(data: string): string {
  return data.replaceAll(/[<>&'"]/g, char => xmlCharMap[char]);
}
