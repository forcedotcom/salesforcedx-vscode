/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Effect, SubscriptionRef } from 'effect';

export type DefaultOrgInfo = {
  orgId?: string;
  devHubOrgId?: string;
  username?: string;
  devHubUsername?: string;
  tracksSource?: boolean;
  isScratch?: boolean;
  isSandbox?: boolean;
};

// A "global" ref that can be accessed anywhere in the program
export const defaultOrgRef = Effect.runSync(SubscriptionRef.make<DefaultOrgInfo>({}));
