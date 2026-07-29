/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Context } from '@opentelemetry/api';
import { Span, BatchSpanProcessor, SpanExporter, BufferConfig } from '@opentelemetry/sdk-trace-base';
import * as Effect from 'effect/Effect';
import { isNotUndefined, isString } from 'effect/Predicate';
// aliased to Rec so the global `Record<K, V>` utility type stays usable in this file
import * as Rec from 'effect/Record';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as os from 'node:os';
import { env, UIKind, version, workspace } from 'vscode';
import { getDefaultOrgRef } from '../core/defaultOrgRef';

/** Custom span processor that transforms spans before they're exported */
export class SpanTransformProcessor extends BatchSpanProcessor {
  private readonly shouldEnrich: () => boolean;

  constructor(exporter: SpanExporter, options?: BufferConfig, shouldEnrich: () => boolean = () => true) {
    super(exporter, options);
    this.shouldEnrich = shouldEnrich;
  }

  public onStart(span: Span, parentContext: Context): void {
    // for top level spans, add additional attributes — skipped when the exporter gate is disabled
    // (the enrichment would be computed per-span then discarded by the gated exporter)
    if (!span.parentSpanContext && this.shouldEnrich()) {
      const resourceAttrs = span.resource.attributes;
      const extensionName = resourceAttrs['extension.name'];
      const extensionVersion = resourceAttrs['extension.version'];
      const [dynamic, permanent] = Effect.runSync(
        Effect.all([getAdditionalAttributes(extensionName, extensionVersion), memoized('everySpanIsTheSame')]) // it seems to want a key
      );
      // Rec.filter's refinement overload drops the undefined-valued attributes and narrows the rest to string
      Object.entries(Rec.filter({ ...permanent, ...dynamic }, isString)).map(([k, v]) => span.setAttribute(k, v));
    }
    super.onStart(span, parentContext);
  }
}

/** Attribute values are optional at build time; the undefined ones are dropped before they reach the span. */
type TelemetryAttributes = Record<string, string | undefined>;

const getAdditionalAttributes = (extensionName: unknown, extensionVersion: unknown) =>
  getDefaultOrgRef().pipe(
    Effect.flatMap(ref => SubscriptionRef.get(ref)),
    Effect.map(
      ({
        orgId,
        devHubOrgId,
        isSandbox,
        isScratch,
        tracksSource,
        userId,
        webUserId,
        cliId,
        orgEdition
      }): TelemetryAttributes => ({
        // Add common.* attributes for AppInsights (AzureMonitorTraceExporter includes span attributes)
        'common.extname': isString(extensionName) ? extensionName : undefined,
        'common.extversion': isString(extensionVersion) ? extensionVersion : undefined,
        orgId,
        devHubOrgId,
        isSandbox: optionalBooleanToString(isSandbox),
        isScratch: optionalBooleanToString(isScratch),
        tracksSource: optionalBooleanToString(tracksSource),
        userId,
        cliId,
        webUserId,
        orgEdition,
        telemetryTag: workspace.getConfiguration('salesforcedx-vscode-core')?.get('telemetry-tag')
      })
    )
  );

export const isInternalUser = (uiKindString: string | undefined): string | undefined => {
  if (uiKindString !== 'Desktop') return undefined;
  return (os?.hostname?.() ?? '').endsWith('internal.salesforce.com') ? 'true' : 'false';
};

const getPermanentAttributes = () => {
  const { machineId, sessionId, uiKind } = env ?? {};
  const uiKindString = uiKind ? UIKind[uiKind] : undefined;
  return Effect.succeed<TelemetryAttributes>({
    'common.vscodemachineid': machineId,
    'common.vscodesessionid': sessionId,
    'common.vscodeuikind': uiKindString,
    'common.vscodeversion': version,
    'common.isInternal': isInternalUser(uiKindString),
    // things that only make sense on desktop
    ...(uiKindString === 'Desktop'
      ? {
          'common.platformversion': (os?.release?.() ?? '').replace(/^(\d+)(\.\d+)?(\.\d+)?(.*)/, '$1$2$3'),
          'common.systemmemory': `${((os?.totalmem?.() ?? 0) / (1024 * 1024 * 1024)).toFixed(2)} GB`,
          'common.cpus': getCPUs()
        }
      : {})
  });
};

const memoized = Effect.runSync(Effect.cachedFunction(getPermanentAttributes));

const getCPUs = (): string => {
  const cpus = os?.cpus() ?? [];
  return cpus[0] ? `${cpus[0].model}(${cpus.length} x ${cpus[0].speed})` : 'unknown';
};

const optionalBooleanToString = (value: boolean | undefined): string | undefined =>
  isNotUndefined(value) ? (value ? 'true' : 'false') : undefined;
