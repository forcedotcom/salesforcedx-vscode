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
import { workspace } from 'vscode';
import { DEFAULT_AI_CONNECTION_STRING } from './appInsights';

// TODO: should this be in Effect?
// Lazy initialization to avoid bundling issues
const _webAppInsightsReporter: { instance: TelemetryReporter | undefined } = { instance: undefined };
export const getWebAppInsightsReporter = (): TelemetryReporter => {
  _webAppInsightsReporter.instance ??= new TelemetryReporter(DEFAULT_AI_CONNECTION_STRING);
  return _webAppInsightsReporter.instance;
};

const getSpanKindName = (kind: SpanKind): string =>
  kind === SpanKind.INTERNAL
    ? 'INTERNAL'
    : kind === SpanKind.SERVER
      ? 'SERVER'
      : kind === SpanKind.CLIENT
        ? 'CLIENT'
        : kind === SpanKind.PRODUCER
          ? 'PRODUCER'
          : kind === SpanKind.CONSUMER
            ? 'CONSUMER'
            : 'UNKNOWN';

const convertAttributes = (attributes: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(attributes)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])
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
    const exportSpan = (span: ReadableSpan): void => {
      const duration = span.duration ? span.duration[0] * 1000 + span.duration[1] / 1000000 : 0;
      const success = !span.status || span.status.code !== SpanStatusCode.ERROR;

      // Create distributed trace context from OpenTelemetry span context
      const telemetryTrace = {
        traceID: span.spanContext().traceId,
        spanID: span.spanContext().spanId,
        parentID: span.parentSpanContext?.spanId
      };

      const props = {
        ...convertAttributes(span.resource.attributes),
        ...convertAttributes(span.attributes),
        ...telemetryTrace,
        spanKind: getSpanKindName(span.kind),
        telemetryTag,
        startTime: String(span.startTime[0] * 1000 + span.startTime[1] / 1000000),
        endTime: String(span.endTime[0] * 1000 + span.endTime[1] / 1000000)
      };
      const measurements = {
        duration
      };

      // eslint-disable-next-line functional/no-try-statements
      try {
        const reporter = getWebAppInsightsReporter();
        if (success) {
          // Use dangerous method to bypass telemetry level checks for development
          reporter.sendDangerousTelemetryEvent(span.name, props, measurements);
        } else {
          // Use dangerous method to bypass telemetry level checks for development
          reporter.sendDangerousTelemetryErrorEvent(span.name, props, measurements);
        }
      } catch (error) {
        console.error('❌ Failed to send dangerous telemetry:', error);
      }
    };

    const result = ((): ExportResult => {
      // eslint-disable-next-line functional/no-try-statements
      try {
        spans.filter(isTopLevelSpan).map(exportSpan);
        return { code: ExportResultCode.SUCCESS };
      } catch (error) {
        console.error('ApplicationInsightsWebExporter export failed:', error);
        return {
          code: ExportResultCode.FAILED,
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    })();

    resultCallback(result);
  }

  // eslint-disable-next-line class-methods-use-this
  public shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

// span filters
const isTopLevelSpan = (span: ReadableSpan): boolean => span.parentSpanContext === undefined;
