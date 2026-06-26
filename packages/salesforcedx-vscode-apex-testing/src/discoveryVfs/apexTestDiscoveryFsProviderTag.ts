/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { ApexTestingDiscoveryFsProvider, getApexTestingDiscoveryFsProvider } from './apexTestingDiscoveryFsProvider';

/**
 * Context.Tag wrapping the vscode-owned in-memory `ApexTestingDiscoveryFsProvider` instance.
 * Acceptable per effect-best-practices "When Context.Tag is acceptable" — vscode-owned infra
 * injected at runtime, not business logic. Lets the service yield the provider from context
 * (rather than calling the module getter inside the effect) and lets tests inject a fresh
 * provider per case for true isolation.
 */
export class ApexTestingDiscoveryFsProviderTag extends Context.Tag('ApexTestingDiscoveryFsProvider')<
  ApexTestingDiscoveryFsProviderTag,
  ApexTestingDiscoveryFsProvider
>() {}

/** Production layer. The ONLY site that calls the module getter is layer-build time. */
export const ApexTestingDiscoveryFsProviderLive = Layer.sync(
  ApexTestingDiscoveryFsProviderTag,
  getApexTestingDiscoveryFsProvider
);
