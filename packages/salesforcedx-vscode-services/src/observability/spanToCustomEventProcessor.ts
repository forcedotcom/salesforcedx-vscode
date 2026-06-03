/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Context, SpanStatusCode } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { ReadableSpan, Span, SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { convertAttributes, isSpanValidForProductionTelemetry, spanDuration } from './spanUtils';

/**
 * SpanProcessor that emits OTEL LogRecords for "business spans" to enable routing to App Insights customEvents table.
 *
 * When a span completes and passes the production telemetry filter, this processor emits a LogRecord with the special
 * attribute "microsoft.custom_event.name" which triggers the Azure Monitor OTEL exporter to route the event to the
 * customEvents table instead of dependencies/traces.
 *
 * This preserves existing App Insights dashboards when migrating from the old TelemetryService API to Effect-based observability.
 */
export class SpanToCustomEventProcessor implements SpanProcessor {
  private logger = logs.getLoggerProvider().getLogger('span-to-customevent', '1.0.0');

  // eslint-disable-next-line class-methods-use-this
  public onStart(_span: Span, _parentContext: Context): void {
    // No-op: we only act on span completion
  }

  public onEnd(span: ReadableSpan): void {
    // Filter: only emit LogRecords for top-level/command spans
    if (!isSpanValidForProductionTelemetry(span)) {
      return;
    }

    const isError = span.status?.code === SpanStatusCode.ERROR;

    // Emit LogRecord with MAGIC ATTRIBUTE that triggers customEvents routing
    this.logger.emit({
      severityNumber: isError ? SeverityNumber.ERROR : SeverityNumber.INFO,
      severityText: isError ? 'ERROR' : 'INFO',
      body: JSON.stringify({
        measurements: {
          duration: spanDuration(span)
        }
      }),
      attributes: {
        // THIS IS THE MAGIC ATTRIBUTE that routes to customEvents table
        // The Azure Monitor OTEL exporter detects this attribute in logUtils.js
        // and converts the LogRecord to EventData envelope -> customEvents table
        'microsoft.custom_event.name': span.name,

        // Copy all span attributes to customDimensions
        ...convertAttributes(span.attributes),

        // Copy resource attributes (extension name, version, etc.)
        ...convertAttributes(span.resource.attributes)
      },
      // Azure exporter will read spanContext from the LogRecord for distributed tracing
      // The SDK will automatically set this when we emit from the logger
      timestamp: span.startTime
    });
  }

  // eslint-disable-next-line class-methods-use-this
  public forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  // eslint-disable-next-line class-methods-use-this
  public shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
