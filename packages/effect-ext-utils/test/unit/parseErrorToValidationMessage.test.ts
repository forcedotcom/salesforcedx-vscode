/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Either from 'effect/Either';
import * as Schema from 'effect/Schema';
import { parseErrorToValidationMessage } from '../../src/parseErrorToValidationMessage';

describe('parseErrorToValidationMessage', () => {
  it('returns undefined for a successful decode', () => {
    expect(Either.right('valid').pipe(parseErrorToValidationMessage)).toBeUndefined();
  });

  it('formats a schema parse error', () => {
    const result = Schema.decodeUnknownEither(Schema.Number)('not a number');

    expect(result.pipe(parseErrorToValidationMessage)).toBeTypeOf('string');
  });
});
