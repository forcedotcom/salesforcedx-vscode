/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Brand from 'effect/Brand';

/** a branded string type to indicate successful cancellation */
export type SuccessfulCancelResult = string & Brand.Brand<'SuccessfulCancelResult'>;
