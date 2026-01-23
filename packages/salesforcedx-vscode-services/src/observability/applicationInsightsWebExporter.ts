/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Azure has good support for otel in node-sdk, but not browser.
 * So we'll fall back to using CustomEvent (similar to pre-otel, pre-effect telemetry)
 * We want to send spans that have no parent span as CustomEvents, and capture their properties from the span.
 * Additionally, we want to send any failed spans as Exceptions (the parent span may not finish if a child span fails)
 */
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { TelemetryReporter } from '@vscode/extension-telemetry';
import * as Console from 'effect/Console';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { workspace } from 'vscode';
import {  getDefaultOrgRef } from '../core/defaultOrgRef';
import { unknownToErrorCause } from '../core/shared';
import { DEFAULT_AI_CONNECTION_STRING } from './appInsights';
import { convertAttributes, getExtensionNameAndVersionAttributes, isTopLevelSpan, spanDuration } from './spanUtils';
// TODO: should this be in Effect?
// Lazy initialization to avoid bundling issues
const _webAppInsightsReporter: { instance: TelemetryReporter | undefined } = { instance: undefined };
export const getWebAppInsightsReporter = (): TelemetryReporter => {
  _webAppInsightsReporter.instance ??= new TelemetryReporter(DEFAULT_AI_CONNECTION_STRING);
  return _webAppInsightsReporter.instance;
};

const getSpanKindName = (kind: SpanKind): string =>
  Match.value(kind).pipe(
    Match.when(SpanKind.INTERNAL, () => 'INTERNAL'),
    Match.when(SpanKind.SERVER, () => 'SERVER'),
    Match.when(SpanKind.CLIENT, () => 'CLIENT'),
    Match.when(SpanKind.PRODUCER, () => 'PRODUCER'),
    Match.when(SpanKind.CONSUMER, () => 'CONSUMER'),
    Match.orElse(() => 'UNKNOWN')
  );

const telemetryTag = workspace.getConfiguration()?.get<string>('salesforcedx-vscode-core.telemetry-tag');

/**
 * Custom OpenTelemetry span exporter that sends telemetry to Application Insights
 * using the web SDK since @azure/monitor-opentelemetry-exporter doesn't work in browsers.
 *
 * Maps all OpenTelemetry spans to Application Insights Dependencies for consistency
 * with the Node SDK behavior.
 */
export class ApplicationInsightsWebExporter implements SpanExporter {
  // eslint-disable-next-line class-methods-use-this
  public export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    void Effect.runPromise(
      Effect.all(spans.filter(isTopLevelSpan).map(exportSpan), { concurrency: 'unbounded' }).pipe(
        Effect.map(() => {
          resultCallback({ code: ExportResultCode.SUCCESS });
        }),
        Effect.catchAll(error => {
          console.error('ApplicationInsightsWebExporter export failed:', error);
          return Effect.sync(() => {
            resultCallback({
              code: ExportResultCode.FAILED,
              error: unknownToErrorCause(error).cause
            });
          });
        })
      )
    );
  }

  // eslint-disable-next-line class-methods-use-this
  public shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

const exportSpan = (span: ReadableSpan) =>
  Effect.gen(function* () {
    const success = !span.status || span.status.code !== SpanStatusCode.ERROR;

    // Create distributed trace context from OpenTelemetry span context
    const telemetryTrace = {
      traceID: span.spanContext().traceId,
      spanID: span.spanContext().spanId,
      parentID: span.parentSpanContext?.spanId
    };

    const { userId, webUserId } = yield* SubscriptionRef.get((yield* getDefaultOrgRef()));

    const props = {
      ...convertAttributes(span.resource.attributes),
      ...getExtensionNameAndVersionAttributes(span.resource.attributes),
      ...convertAttributes(span.attributes),
      ...telemetryTrace,
      spanKind: getSpanKindName(span.kind),
      telemetryTag,
      startTime: String(span.startTime[0] * 1000 + span.startTime[1] / 1_000_000),
      endTime: String(span.endTime[0] * 1000 + span.endTime[1] / 1_000_000),
      ...(userId ? { userId } : {}),
      ...(webUserId ? { webUserId } : {})
    };

    const measurements = {
      duration: spanDuration(span)
    };

    yield* Effect.try({
      try: () =>
        success
          ? getWebAppInsightsReporter().sendDangerousTelemetryEvent(span.name, props, measurements)
          : getWebAppInsightsReporter().sendDangerousTelemetryErrorEvent(span.name, props, measurements),
      catch: error => unknownToErrorCause(error)
    }).pipe(
      Effect.catchAll(error => Console.error('❌ Failed to send dangerous telemetry:', JSON.stringify(error.cause)))
    );
  });
