/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

export const LetterStartNameSchema = Schema.String.pipe(Schema.pattern(/^[A-Za-z][A-Za-z0-9_]*$/));
