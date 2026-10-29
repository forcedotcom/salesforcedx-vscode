/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { DefaultOrgInfo } from './defaultOrgInfo.js';
import * as Context from 'effect/Context';
import type * as SubscriptionRef from 'effect/SubscriptionRef';

export class TargetOrgRef extends Context.Service<TargetOrgRef, SubscriptionRef.SubscriptionRef<DefaultOrgInfo>>()(
  '@salesforce/vscode-services-v2/TargetOrgRef'
) {}
