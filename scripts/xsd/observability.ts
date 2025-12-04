/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Effect Logging Configuration
 *
 * To configure Effect logging levels, provide a Logger layer when running your Effect program.
 * The default logger uses console output with different log levels.
 *
 * Example: Configure minimum log level to INFO (hides DEBUG messages)
 * ```typescript
 * import { Logger, LogLevel } from 'effect';
 *
 * const program = Effect.gen(function* () {
 *   yield* Effect.logInfo('This will be shown');
 *   yield* Effect.logDebug('This will be hidden');
 * });
 *
 * await Effect.runPromise(
 *   program.pipe(
 *     Effect.provide(Logger.withMinimumLogLevel(LogLevel.Info))
 *   )
 * );
 * ```
 *
 * Available log levels (from most to least verbose):
 * - LogLevel.All - Show all logs
 * - LogLevel.Trace - Very detailed tracing
 * - LogLevel.Debug - Debug information (default for development)
 * - LogLevel.Info - Informational messages
 * - LogLevel.Warning - Warning messages
 * - LogLevel.Error - Error messages only
 * - LogLevel.Fatal - Fatal errors only
 * - LogLevel.None - No logging
 *
 * To set log level via environment variable:
 * ```typescript
 * const logLevel = process.env.LOG_LEVEL === 'INFO' ? LogLevel.Info : LogLevel.Debug;
 * await Effect.runPromise(
 *   program.pipe(
 *     Effect.provide(Logger.withMinimumLogLevel(logLevel)),
 *     Effect.provide(MetricsLayer),
 *     Effect.provide(NodeSdkLayer)
 *   )
 * );
 * ```
 *
 * To use a custom logger (e.g., file, structured JSON):
 * ```typescript
 * import { Logger } from 'effect';
 *
 * const customLogger = Logger.make(({ logLevel, message, context }) => {
 *   // Your custom logging logic
 *   console.log(JSON.stringify({ level: logLevel, message, ...context }));
 * });
 *
 * await Effect.runPromise(
 *   program.pipe(
 *     Effect.provide(Logger.replace(Logger.defaultLogger, customLogger))
 *   )
 * );
 * ```
 */

import { Metrics, NodeSdk } from '@effect/opentelemetry';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  PeriodicExportingMetricReader
} from '@opentelemetry/sdk-metrics';
import { Layer } from 'effect';

/** OTEL Node SDK Layer for metadata scraper (traces only) */
export const NodeSdkLayer = NodeSdk.layer(() => ({
  resource: {
    serviceName: 'metadata-scraper',
    serviceVersion: '1.0.0',
    attributes: {
      'service.environment': 'development',
      'service.platform': 'node'
    }
  },
  spanProcessor: [
    // In-memory exporter (no console output)
    new SimpleSpanProcessor(new InMemorySpanExporter())
  ]
}));

/** Metrics Layer - stores metrics in memory (no console output) */
export const MetricsLayer = Metrics.layer(
  () =>
    new PeriodicExportingMetricReader({
      exporter: new InMemoryMetricExporter(AggregationTemporality.DELTA),
      exportIntervalMillis: 5000 // Export every 5 seconds
    })
);

/** Combined OTEL Layer with both traces and metrics */
export const OtelLayer = Layer.mergeAll(NodeSdkLayer, MetricsLayer);
