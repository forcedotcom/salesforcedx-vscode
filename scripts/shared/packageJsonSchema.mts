/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Schema } from 'effect';

export const PackageJsonTextSchema = Schema.parseJson(Schema.Record({ key: Schema.String, value: Schema.Unknown }));
