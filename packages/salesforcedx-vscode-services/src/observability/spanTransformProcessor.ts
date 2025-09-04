/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Context } from '@opentelemetry/api';
import { Span, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as os from 'node:os';
import { env, UIKind, version, workspace } from 'vscode';
import { defaultOrgRef } from '../core/defaultOrgService';

/** Custom span processor that transforms spans before they're exported */
export class SpanTransformProcessor extends BatchSpanProcessor {
  public onStart(span: Span, parentContext: Context): void {
    getAdditionalAttributes()
      .concat(Effect.runSync(memoized('everySpanIsTheSame'))) // it seems to want a key
      .filter(isNotUndefined)
      .map(([key, value]) => span.setAttribute(key, value));
    super.onStart(span, parentContext);
  }
}

const getAdditionalAttributes = (): [string, string | undefined][] => {
  const { orgId, devHubOrgId, isSandbox, isScratch, tracksSource } = Effect.runSync(SubscriptionRef.get(defaultOrgRef));
  return [
    ['orgId', orgId],
    ['devHubOrgId', devHubOrgId],
    ['isSandbox', optionalBooleanToString(isSandbox)],
    ['isScratch', optionalBooleanToString(isScratch)],
    ['tracksSource', optionalBooleanToString(tracksSource)],
    ['telemetryTag', workspace.getConfiguration('salesforcedx-vscode-core')?.get('telemetry-tag')]
  ];
};

const getPermanentAttributes = (): Effect.Effect<[string, string | undefined][]> => {
  const { machineId, sessionId, uiKind } = env ?? {};
  const uiKindString = uiKind ? UIKind[uiKind] : undefined;
  return Effect.succeed([
    ['common.vscodemachineid', machineId],
    ['common.vscodesessionid', sessionId],
    ['common.vscodeuikind', uiKindString],
    ['common.vscodeversion', version],
    // things that only make sense on desktop
    ...((uiKindString === 'Desktop'
      ? [
          ['common.platformversion', (os?.release?.() ?? '').replace(/^(\d+)(\.\d+)?(\.\d+)?(.*)/, '$1$2$3')],
          ['common.systemmemory', `${(os?.totalmem?.() ?? 0 / (1024 * 1024 * 1024)).toFixed(2)} GB`],
          ['common.cpus', getCPUs()]
        ]
      : []) satisfies [string, string][])
  ]);
};

const memoized = Effect.runSync(Effect.cachedFunction(getPermanentAttributes));

const isNotUndefined = (item: [string, string | undefined]): item is [string, string] => typeof item[1] === 'string';

const getCPUs = (): string => {
  const cpus = os?.cpus() ?? [];
  return cpus?.length > 0 ? `${cpus[0].model}(${cpus.length} x ${cpus[0].speed})` : 'unknown';
};

const optionalBooleanToString = (value: boolean | undefined): string | undefined =>
  value !== undefined ? (value ? 'true' : 'false') : undefined;
