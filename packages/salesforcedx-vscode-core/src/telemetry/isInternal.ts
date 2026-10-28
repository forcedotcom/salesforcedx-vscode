/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'node:os';

const INTERNAL_FILTER = 'internal.salesforce.com';

export const isInternalHost = (): boolean => (os.hostname().endsWith(INTERNAL_FILTER) ? true : false);
