/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as FetchHttpClient from '@effect/platform/FetchHttpClient';
import * as ManagedRuntime from 'effect/ManagedRuntime';

/** Own a Fetch client runtime for the lifetime of a local telemetry exporter. */
export const makeLocalHttpRuntime = () => ManagedRuntime.make(FetchHttpClient.layer);
