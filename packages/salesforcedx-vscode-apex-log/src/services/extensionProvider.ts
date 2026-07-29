/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  buildAllServicesLayer as buildBaseServicesLayer,
  NotificationModeServiceLayer
} from '@salesforce/effect-ext-utils';
import * as HashSet from 'effect/HashSet';
import * as Layer from 'effect/Layer';
import * as Ref from 'effect/Ref';
import type { ExtensionContext } from 'vscode';
import { TraceFlagsContentProviderService } from '../traceFlags/traceFlagsContentProvider';
import {
  getOrCreateLogCollectorStateRef,
  getOrCreateTraceFlagRefreshSubscriptionRef,
  KnownLogIdsRef,
  LogCollectorStateRef,
  CurrentTraceFlags
} from './apexLogState';

const apexLogServicesLayer = Layer.mergeAll(
  TraceFlagsContentProviderService.Default,
  Layer.sync(CurrentTraceFlags, getOrCreateTraceFlagRefreshSubscriptionRef),
  Layer.sync(LogCollectorStateRef, getOrCreateLogCollectorStateRef),
  Layer.effect(KnownLogIdsRef, Ref.make(HashSet.empty<string>()))
);

export const buildAllServicesLayer = (context: ExtensionContext, fallbackDisplayName: string) =>
  Layer.mergeAll(
    buildBaseServicesLayer(context, fallbackDisplayName),
    apexLogServicesLayer,
    NotificationModeServiceLayer(
      'salesforcedx-vscode-apex-log',
      'sf-apex-log-notifications',
      'Salesforce: Apex Log Notifications'
    )
  );
