/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Context } from '@opentelemetry/api';
import { Span, BatchSpanProcessor, SpanExporter, BufferConfig } from '@opentelemetry/sdk-trace-base';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as os from 'node:os';
import { env, UIKind, version, workspace } from 'vscode';
import { defaultOrgRef } from '../core/defaultOrgService';

/** Custom span processor that transforms spans before they're exported */
export class SpanTransformProcessor extends BatchSpanProcessor {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(exporter: SpanExporter, options?: BufferConfig) {
    super(exporter, options);
  }

  public onStart(span: Span, parentContext: Context): void {
    // for top level spans, add additional attributes
    if (!span.parentSpanContext) {
      const resourceAttrs = span.resource.attributes;
      const extensionName = resourceAttrs['extension.name'];
      const extensionVersion = resourceAttrs['extension.version'];
      getAdditionalAttributes(extensionName, extensionVersion)
        .concat(Effect.runSync(memoized('everySpanIsTheSame'))) // it seems to want a key
        .filter(isNotUndefined)
        .map(([k, v]) => span.setAttribute(k, v));
    }
    super.onStart(span, parentContext);
  }
}

type TelemetryAttribute = [string, string | undefined];

const getAdditionalAttributes = (extensionName: unknown, extensionVersion: unknown): TelemetryAttribute[] => {
  const { orgId, devHubOrgId, isSandbox, isScratch, tracksSource, webUserId, cliId } = Effect.runSync(
    SubscriptionRef.get(defaultOrgRef)
  );
  const commonAttrs: TelemetryAttribute[] = [];
  if (typeof extensionName === 'string') {
    commonAttrs.push(['common.extname', extensionName]);
  }
  if (typeof extensionVersion === 'string') {
    commonAttrs.push(['common.extversion', extensionVersion]);
  }
  return [
    // Add common.* attributes for AppInsights (AzureMonitorTraceExporter includes span attributes)
    ...commonAttrs,
    ['orgId', orgId],
    ['devHubOrgId', devHubOrgId],
    ['isSandbox', optionalBooleanToString(isSandbox)],
    ['isScratch', optionalBooleanToString(isScratch)],
    ['tracksSource', optionalBooleanToString(tracksSource)],
    ['userId', cliId],
    ['webUserId', webUserId],
    ['telemetryTag', workspace.getConfiguration('salesforcedx-vscode-core')?.get('telemetry-tag')]
  ];
};

const getPermanentAttributes = () => {
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
      : []) satisfies TelemetryAttribute[])
  ] satisfies TelemetryAttribute[]);
};

const memoized = Effect.runSync(Effect.cachedFunction(getPermanentAttributes));

const isNotUndefined = (item: [string, string | undefined]): item is [string, string] => typeof item[1] === 'string';

const getCPUs = (): string => {
  const cpus = os?.cpus() ?? [];
  return cpus?.length > 0 ? `${cpus[0].model}(${cpus.length} x ${cpus[0].speed})` : 'unknown';
};

const optionalBooleanToString = (value: boolean | undefined): string | undefined =>
  value !== undefined ? (value ? 'true' : 'false') : undefined;
