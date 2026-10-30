/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TargetOrgRef, type DefaultOrgInfo } from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as PubSub from 'effect/PubSub';
import * as SubscriptionRef from 'effect/SubscriptionRef';

/** One carrier per graph; connection/org coordination composes this same layer in W-24615059. */
export const TargetOrgRefLayer = Layer.effect(
  TargetOrgRef,
  Effect.acquireRelease(SubscriptionRef.make<DefaultOrgInfo>({}), ref => PubSub.shutdown(ref.pubsub))
);
