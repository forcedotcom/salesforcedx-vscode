/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Context from 'effect/Context';
import type * as SubscriptionRef from 'effect/SubscriptionRef';

export class ActiveMetadataOperationRef extends Context.Service<
  ActiveMetadataOperationRef,
  SubscriptionRef.SubscriptionRef<number>
>()('@salesforce/vscode-services-v2/ActiveMetadataOperationRef') {}
