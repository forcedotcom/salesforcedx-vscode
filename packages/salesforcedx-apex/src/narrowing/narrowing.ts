/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { isNullable } from 'effect/Predicate';

export const isEmpty = (value: string | number): boolean =>
  isNullable(value) || (typeof value === 'string' && value.length === 0);
