/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import * as Duration  from 'effect/Duration';

export const RETRIEVE_TIMEOUT = Duration.toMillis(Duration.minutes(10));
export const DEPLOY_TIMEOUT = Duration.toMillis(Duration.minutes(10));
