/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Order from 'effect/Order';
import { FieldDeclaration } from './types/general';

export const byFieldName = Order.mapInput(Order.string, (d: FieldDeclaration) => d.name);
