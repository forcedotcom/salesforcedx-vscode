/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Either from 'effect/Either';
import * as ParseResult from 'effect/ParseResult';

export const parseErrorToValidationMessage = Either.match({
  onLeft: ParseResult.TreeFormatter.formatErrorSync,
  onRight: () => undefined
});
